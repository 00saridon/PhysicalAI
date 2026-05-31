import asyncio
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
async def test_get_status_idle():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/status")
    assert r.status_code == 200
    body = r.json()
    assert body["running"] is False
    assert body["stage"] is None


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
