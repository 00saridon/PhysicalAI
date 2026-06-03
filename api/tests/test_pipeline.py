import asyncio
import json
import pytest
from httpx import AsyncClient, ASGITransport
from api.main import app
from api.event_bus import EventBus
from api.subprocess_runner import SubprocessRunner


@pytest.mark.anyio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


@pytest.mark.anyio
async def test_event_bus_fanout():
    bus = EventBus()
    q1 = bus.subscribe()
    q2 = bus.subscribe()
    await bus.publish({"event": "log", "data": "hello"})
    assert await asyncio.wait_for(q1.get(), timeout=1) == {"event": "log", "data": "hello"}
    assert await asyncio.wait_for(q2.get(), timeout=1) == {"event": "log", "data": "hello"}
    bus.unsubscribe(q1)
    bus.unsubscribe(q2)


@pytest.mark.anyio
async def test_event_bus_backfills_history_on_subscribe():
    bus = EventBus(history_size=10, history_events={"metric"})
    await bus.publish({"event": "metric", "data": '{"step": 1, "stage": "rl"}'})
    await bus.publish({"event": "metric", "data": '{"step": 2, "stage": "rl"}'})
    # control events are not retained
    await bus.publish({"event": "done", "data": "{}"})

    # a late joiner is backfilled with the metric points it missed
    q = bus.subscribe()
    assert (await asyncio.wait_for(q.get(), timeout=1))["data"] == '{"step": 1, "stage": "rl"}'
    assert (await asyncio.wait_for(q.get(), timeout=1))["data"] == '{"step": 2, "stage": "rl"}'
    assert q.empty()  # the "done" event was excluded from history
    bus.unsubscribe(q)


@pytest.mark.anyio
async def test_event_bus_clear_history_by_stage():
    bus = EventBus(history_size=10, history_events={"metric"})
    await bus.publish({"event": "metric", "data": '{"step": 1, "stage": "il"}'})
    await bus.publish({"event": "metric", "data": '{"step": 2, "stage": "rl"}'})
    bus.clear_history("rl")  # re-running RL wipes only the rl curve

    q = bus.subscribe()
    ev = await asyncio.wait_for(q.get(), timeout=1)
    assert ev["data"] == '{"step": 1, "stage": "il"}'  # il curve survives
    assert q.empty()
    bus.unsubscribe(q)


@pytest.mark.anyio
async def test_event_bus_disabled_history_has_no_backfill():
    bus = EventBus()  # default: history disabled
    await bus.publish({"event": "log", "data": "early"})
    q = bus.subscribe()
    assert q.empty()  # late joiner gets nothing retroactively
    bus.unsubscribe(q)


@pytest.mark.anyio
async def test_log_history_backfills_with_unique_ids():
    bus = EventBus(history_size=300, history_events={"log"})
    await bus.publish({"event": "log", "data": '{"line": "a", "ts": 1}'})
    await bus.publish({"event": "log", "data": '{"line": "b", "ts": 2}'})
    await bus.publish({"event": "done", "data": "{}"})  # control event: not retained

    q = bus.subscribe()
    e1 = await asyncio.wait_for(q.get(), timeout=1)
    e2 = await asyncio.wait_for(q.get(), timeout=1)
    assert (e1["data"], e2["data"]) == ('{"line": "a", "ts": 1}', '{"line": "b", "ts": 2}')
    # each retained event carries a unique SSE id for client-side dedupe
    assert e1["id"] != e2["id"]
    assert q.empty()  # the "done" event was excluded from history
    bus.unsubscribe(q)


def test_emit_and_parse_metric_roundtrip(capsys):
    from pipeline_metrics import emit_metric, parse_metric, METRIC_PREFIX
    emit_metric(stage="rl", step=42, rew_mean=0.5)
    out = capsys.readouterr().out.strip()
    assert out.startswith(METRIC_PREFIX)
    assert parse_metric(out) == {"stage": "rl", "step": 42, "rew_mean": 0.5}


def test_parse_metric_ignores_non_metric_lines():
    from pipeline_metrics import parse_metric, METRIC_PREFIX
    assert parse_metric("[RL] Step 1000 | rew=-0.312") is None
    assert parse_metric("plain log line") is None
    # malformed JSON after the prefix is ignored rather than raising
    assert parse_metric(METRIC_PREFIX + "{not json}") is None


@pytest.mark.anyio
async def test_runner_not_running_initially():
    runner = SubprocessRunner()
    assert runner.is_running() is False
    assert runner.current_stage is None


@pytest.mark.anyio
async def test_runner_raises_if_already_running(monkeypatch):
    runner = SubprocessRunner()

    class FakeProc:
        returncode = None
    runner._process = FakeProc()
    with pytest.raises(RuntimeError, match="already running"):
        await runner.run("env")


@pytest.mark.anyio
async def test_stop_when_idle_returns_409():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/stop")
    assert r.status_code == 409


@pytest.mark.anyio
async def test_stop_mock_run_emits_terminal_and_clears_state():
    runner = SubprocessRunner()
    runner.mock_mode = True
    q = runner.log_bus.subscribe()
    await runner.run("rl")
    assert runner.is_running() is True

    await runner.stop()

    # state is cleared and a terminal "done" (flagged stopped) is broadcast
    assert runner.is_running() is False
    assert runner.current_stage is None
    seen_stopped = False
    while not q.empty():
        ev = q.get_nowait()
        if ev["event"] == "done":
            payload = json.loads(ev["data"])
            if payload.get("stopped"):
                seen_stopped = True
    assert seen_stopped


@pytest.mark.anyio
async def test_get_status_idle():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/status")
    assert r.status_code == 200
    body = r.json()
    assert body["running"] is False
    assert body["stage"] is None


def test_runner_forces_mock_when_real_unavailable(monkeypatch):
    import api.subprocess_runner as sr
    monkeypatch.setattr(sr, "real_mode_available", lambda: False)
    monkeypatch.setenv("MOCK_PIPELINE", "false")  # env asks for REAL...
    runner = sr.SubprocessRunner()
    assert runner.real_available is False
    assert runner.mock_mode is True  # ...but it's clamped to MOCK


@pytest.mark.anyio
async def test_set_mode_rejects_real_when_unavailable():
    runner = app.state.runner
    prev = runner.real_available
    runner.real_available = False
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            r = await client.post("/api/mode", json={"mock": False})
        assert r.status_code == 422
        assert "REAL mode is unavailable" in r.json()["detail"]
    finally:
        runner.real_available = prev


@pytest.mark.anyio
async def test_colab_register_and_latest():
    app.state.colab = {"url": None, "ts": 0}
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/api/colab/latest")).json()["url"] is None
        r = await client.post("/api/colab/register", json={"url": "https://x.ngrok-free.dev/"})
        assert r.status_code == 200
        assert r.json()["url"] == "https://x.ngrok-free.dev"  # trailing slash trimmed
        assert (await client.get("/api/colab/latest")).json()["url"] == "https://x.ngrok-free.dev"


@pytest.mark.anyio
async def test_colab_register_rejects_non_http():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/colab/register", json={"url": "ftp://nope"})
    assert r.status_code == 422


@pytest.mark.anyio
async def test_run_unknown_stage_returns_422():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/run/unknown_stage")
    assert r.status_code == 422


@pytest.mark.anyio
async def test_run_env_validate_starts(monkeypatch):
    started = []

    async def fake_run(stage, extra_args=None):
        started.append(stage)
    monkeypatch.setattr(app.state.runner, "run", fake_run)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.post("/api/run/env?validate=true")
    assert r.status_code == 200
    assert started == ["env"]


@pytest.mark.anyio
async def test_logs_stream_returns_sse_content_type():
    import anyio
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        with anyio.move_on_after(2):
            async with client.stream("GET", "/api/logs/stream") as r:
                assert r.status_code == 200
                assert "text/event-stream" in r.headers["content-type"]
