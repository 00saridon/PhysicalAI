# PhysicalAI Dashboard UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** React+Vite 프론트엔드 + FastAPI 백엔드로 파이프라인 제어·실시간 모니터링·아티팩트 뷰어를 하나로 통합한 대시보드를 구축한다.

**Architecture:** FastAPI가 `run.py`를 asyncio subprocess로 실행하고 stdout을 SSE로 스트리밍한다. React는 REST로 파이프라인을 제어하고 SSE EventSource로 로그·메트릭을 실시간 수신한다. Vite 프록시가 `/api/*`를 `:8000`으로 포워딩한다.

**Tech Stack:** React 18, TypeScript, Vite, TailwindCSS, Recharts, React Query v5, FastAPI, uvicorn, sse-starlette, pytest, httpx, Vitest, @testing-library/react

---

## 파일 구조 (생성 순서)

```
api/__init__.py
api/main.py
api/event_bus.py
api/subprocess_runner.py
api/routes/__init__.py
api/routes/pipeline.py
api/routes/logs.py
api/routes/artifacts.py
api/tests/__init__.py
api/tests/test_pipeline.py
api/tests/test_artifacts.py

dashboard/package.json
dashboard/vite.config.ts
dashboard/tailwind.config.ts
dashboard/tsconfig.json
dashboard/index.html
dashboard/src/main.tsx
dashboard/src/App.tsx
dashboard/src/types/pipeline.ts
dashboard/src/api/client.ts
dashboard/src/hooks/useSSELogs.ts
dashboard/src/hooks/useSSEMetrics.ts
dashboard/src/hooks/usePipeline.ts
dashboard/src/components/ui/KPICard.tsx
dashboard/src/components/ui/StatusBadge.tsx
dashboard/src/components/pipeline/PipelineBar.tsx
dashboard/src/components/pipeline/StageButton.tsx
dashboard/src/components/monitoring/LogPanel.tsx
dashboard/src/components/monitoring/RewardChart.tsx
dashboard/src/components/artifacts/ArtifactList.tsx
dashboard/src/components/layout/Sidebar.tsx
dashboard/src/components/layout/TopBar.tsx
dashboard/src/pages/Overview.tsx
dashboard/src/__tests__/PipelineBar.test.tsx
dashboard/src/__tests__/LogPanel.test.tsx
dashboard/src/__tests__/useSSELogs.test.ts
```

---

## Task 1: FastAPI 스캐폴딩 + Health Check

**Files:**
- Create: `api/__init__.py`
- Create: `api/main.py`
- Create: `api/routes/__init__.py`
- Create: `api/tests/__init__.py`
- Create: `api/tests/test_pipeline.py`

- [ ] **Step 1: 백엔드 의존성 설치**

```bash
pip install fastapi uvicorn sse-starlette httpx pytest pytest-asyncio anyio
```

Expected: `Successfully installed fastapi ...`

- [ ] **Step 2: failing test 작성**

`api/tests/test_pipeline.py`:
```python
import pytest
from httpx import AsyncClient, ASGITransport
from api.main import app

@pytest.mark.anyio
async def test_health():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```bash
python -m pytest api/tests/test_pipeline.py::test_health -v
```

Expected: `FAILED` — `ModuleNotFoundError: No module named 'api'`

- [ ] **Step 4: `api/__init__.py` 생성**

```python
```
(빈 파일)

- [ ] **Step 5: `api/routes/__init__.py` 생성**

```python
```
(빈 파일)

- [ ] **Step 6: `api/main.py` 작성**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="PhysicalAI Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 7: 테스트 통과 확인**

```bash
python -m pytest api/tests/test_pipeline.py::test_health -v
```

Expected: `PASSED`

- [ ] **Step 8: pytest.ini 설정 (anyio 백엔드 설정)**

프로젝트 루트에 `pytest.ini` 파일 생성:
```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Step 9: 커밋**

```bash
git add api/ pytest.ini
git commit -m "feat: FastAPI scaffold with health check"
```

---

## Task 2: EventBus + SubprocessRunner

**Files:**
- Create: `api/event_bus.py`
- Create: `api/subprocess_runner.py`

- [ ] **Step 1: failing test 작성 — EventBus**

`api/tests/test_pipeline.py`에 추가:
```python
import asyncio
from api.event_bus import EventBus

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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
python -m pytest api/tests/test_pipeline.py::test_event_bus_fanout -v
```

Expected: `FAILED` — `ModuleNotFoundError: No module named 'api.event_bus'`

- [ ] **Step 3: `api/event_bus.py` 작성**

```python
import asyncio


class EventBus:
    """Simple fan-out event bus for SSE broadcasting."""

    def __init__(self):
        self._subscribers: list[asyncio.Queue] = []

    async def publish(self, event: dict) -> None:
        for q in list(self._subscribers):
            await q.put(event)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.append(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        if q in self._subscribers:
            self._subscribers.remove(q)
```

- [ ] **Step 4: EventBus 테스트 통과 확인**

```bash
python -m pytest api/tests/test_pipeline.py::test_event_bus_fanout -v
```

Expected: `PASSED`

- [ ] **Step 5: failing test 작성 — SubprocessRunner**

`api/tests/test_pipeline.py`에 추가:
```python
from api.subprocess_runner import SubprocessRunner

@pytest.mark.anyio
async def test_runner_not_running_initially():
    runner = SubprocessRunner()
    assert runner.is_running() is False
    assert runner.current_stage is None

@pytest.mark.anyio
async def test_runner_raises_if_already_running(monkeypatch):
    runner = SubprocessRunner()
    # mock _process as alive
    class FakeProc:
        returncode = None
    runner._process = FakeProc()
    with pytest.raises(RuntimeError, match="already running"):
        await runner.run("env")
```

- [ ] **Step 6: `api/subprocess_runner.py` 작성**

```python
import asyncio
import json
import re
import time
from pathlib import Path

from api.event_bus import EventBus

_RL_RE = re.compile(r"\[RL\]\s+Step\s+(\d+)\s*\|\s*rew=([\d.\-]+)")
_IL_RE = re.compile(r"\[IL\]\s+Epoch\s+(\d+)\s+loss=([\d.]+)")


class SubprocessRunner:
    def __init__(self):
        self._process: asyncio.subprocess.Process | None = None
        self.current_stage: str | None = None
        self.log_bus = EventBus()
        self.metric_bus = EventBus()
        self._project_root = Path(__file__).parent.parent  # PhysicalAI/

    def is_running(self) -> bool:
        return self._process is not None and self._process.returncode is None

    async def run(self, stage: str, extra_args: list[str] | None = None) -> None:
        if self.is_running():
            raise RuntimeError("already running")
        extra_args = extra_args or []
        self.current_stage = stage
        cmd = ["python", "run.py", stage] + extra_args
        self._process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=str(self._project_root),
        )
        asyncio.create_task(self._drain())

    async def _drain(self) -> None:
        assert self._process and self._process.stdout
        while True:
            raw = await self._process.stdout.readline()
            if not raw:
                break
            text = raw.decode(errors="replace").rstrip()
            ts = int(time.time())
            log_ev = {"event": "log", "data": json.dumps({"line": text, "ts": ts})}
            await self.log_bus.publish(log_ev)

            m = _RL_RE.search(text)
            if m:
                metric = {"step": int(m.group(1)), "rew_mean": float(m.group(2)), "stage": "rl", "ts": ts}
                await self.metric_bus.publish({"event": "metric", "data": json.dumps(metric)})
                continue
            m = _IL_RE.search(text)
            if m:
                metric = {"step": int(m.group(1)), "loss": float(m.group(2)), "stage": "il", "ts": ts}
                await self.metric_bus.publish({"event": "metric", "data": json.dumps(metric)})

        exit_code = await self._process.wait()
        stage = self.current_stage
        self._process = None
        self.current_stage = None
        if exit_code == 0:
            payload = {"stage": stage, "exit_code": 0}
            ev = {"event": "done", "data": json.dumps(payload)}
        else:
            payload = {"stage": stage, "exit_code": exit_code, "msg": f"process exited {exit_code}"}
            ev = {"event": "error", "data": json.dumps(payload)}
        await self.log_bus.publish(ev)
        await self.metric_bus.publish(ev)
```

- [ ] **Step 7: SubprocessRunner 테스트 통과 확인**

```bash
python -m pytest api/tests/test_pipeline.py -v
```

Expected: 3 tests `PASSED`

- [ ] **Step 8: runner를 app state에 등록 — `api/main.py` 수정**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.subprocess_runner import SubprocessRunner

app = FastAPI(title="PhysicalAI Dashboard API")
app.state.runner = SubprocessRunner()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 9: 커밋**

```bash
git add api/
git commit -m "feat: EventBus and SubprocessRunner with stdout parsing"
```

---

## Task 3: Pipeline Routes (POST /run/{stage}, GET /status)

**Files:**
- Create: `api/routes/pipeline.py`
- Modify: `api/main.py`

- [ ] **Step 1: failing tests 작성**

`api/tests/test_pipeline.py`에 추가:
```python
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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
python -m pytest api/tests/test_pipeline.py::test_get_status_idle -v
```

Expected: `FAILED` — 404

- [ ] **Step 3: `api/routes/pipeline.py` 작성**

```python
from typing import Literal
from fastapi import APIRouter, HTTPException, Request

router = APIRouter()

VALID_STAGES = {"env", "collect", "il", "rl", "export"}

PREREQS: dict[str, str | None] = {
    "env": None,
    "collect": None,
    "il": "demos/episode_0000.hdf5",
    "rl": "checkpoints/il/best.pt",
    "export": "checkpoints/rl/best.zip",
}


@router.get("/api/status")
async def get_status(request: Request):
    runner = request.app.state.runner
    return {"running": runner.is_running(), "stage": runner.current_stage}


@router.post("/api/run/{stage}")
async def run_stage(stage: str, request: Request, validate: bool = False):
    if stage not in VALID_STAGES:
        raise HTTPException(status_code=422, detail=f"Unknown stage: {stage}. Valid: {sorted(VALID_STAGES)}")
    runner = request.app.state.runner
    if runner.is_running():
        raise HTTPException(status_code=409, detail=f"Stage '{runner.current_stage}' is already running")

    prereq = PREREQS.get(stage)
    if prereq:
        import os
        if not os.path.exists(prereq):
            raise HTTPException(status_code=422, detail=f"Prerequisite missing: {prereq}")

    extra: list[str] = []
    if stage == "env" and validate:
        extra = ["--validate"]
    if stage == "collect":
        extra = ["--mode", "random", "--episodes", "10"]

    await runner.run(stage, extra_args=extra)
    return {"started": stage}
```

- [ ] **Step 4: router를 `api/main.py`에 등록**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.subprocess_runner import SubprocessRunner
from api.routes.pipeline import router as pipeline_router

app = FastAPI(title="PhysicalAI Dashboard API")
app.state.runner = SubprocessRunner()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipeline_router)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
python -m pytest api/tests/test_pipeline.py -v
```

Expected: 6 tests `PASSED`

- [ ] **Step 6: 커밋**

```bash
git add api/
git commit -m "feat: pipeline routes POST /run/{stage} and GET /status"
```

---

## Task 4: Logs SSE Route + Metrics SSE Route

**Files:**
- Create: `api/routes/logs.py`
- Modify: `api/main.py`

- [ ] **Step 1: failing test 작성**

`api/tests/test_pipeline.py`에 추가:
```python
@pytest.mark.anyio
async def test_logs_stream_returns_sse_content_type():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with client.stream("GET", "/api/logs/stream") as r:
            assert r.status_code == 200
            assert "text/event-stream" in r.headers["content-type"]
            break  # just check headers, don't consume stream
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
python -m pytest api/tests/test_pipeline.py::test_logs_stream_returns_sse_content_type -v
```

Expected: `FAILED` — 404

- [ ] **Step 3: `api/routes/logs.py` 작성**

```python
import asyncio
from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

router = APIRouter()


async def _generate(queue: asyncio.Queue, request: Request):
    try:
        while True:
            if await request.is_disconnected():
                break
            try:
                event = await asyncio.wait_for(queue.get(), timeout=15.0)
                yield event
                if event.get("event") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                yield {"event": "ping", "data": ""}
    finally:
        pass


@router.get("/api/logs/stream")
async def logs_stream(request: Request):
    runner = request.app.state.runner
    queue = runner.log_bus.subscribe()

    async def cleanup_gen():
        try:
            async for ev in _generate(queue, request):
                yield ev
        finally:
            runner.log_bus.unsubscribe(queue)

    return EventSourceResponse(cleanup_gen())


@router.get("/api/metrics/stream")
async def metrics_stream(request: Request):
    runner = request.app.state.runner
    queue = runner.metric_bus.subscribe()

    async def cleanup_gen():
        try:
            async for ev in _generate(queue, request):
                yield ev
        finally:
            runner.metric_bus.unsubscribe(queue)

    return EventSourceResponse(cleanup_gen())
```

- [ ] **Step 4: `api/main.py`에 logs router 등록**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.subprocess_runner import SubprocessRunner
from api.routes.pipeline import router as pipeline_router
from api.routes.logs import router as logs_router

app = FastAPI(title="PhysicalAI Dashboard API")
app.state.runner = SubprocessRunner()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipeline_router)
app.include_router(logs_router)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
python -m pytest api/tests/ -v
```

Expected: 7 tests `PASSED`

- [ ] **Step 6: 커밋**

```bash
git add api/
git commit -m "feat: SSE log and metrics stream endpoints"
```

---

## Task 5: Artifacts Route

**Files:**
- Create: `api/routes/artifacts.py`
- Create: `api/tests/test_artifacts.py`
- Modify: `api/main.py`

- [ ] **Step 1: failing tests 작성**

`api/tests/test_artifacts.py`:
```python
import pytest
from httpx import AsyncClient, ASGITransport
from api.main import app


@pytest.mark.anyio
async def test_list_artifacts_returns_list():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/artifacts")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.anyio
async def test_download_missing_artifact_404():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/artifacts/nonexistent_id/download")
    assert r.status_code == 404
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
python -m pytest api/tests/test_artifacts.py -v
```

Expected: `FAILED` — 404

- [ ] **Step 3: `api/routes/artifacts.py` 작성**

```python
import hashlib
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

_ROOT = Path(__file__).parent.parent.parent  # PhysicalAI/
_SCAN_DIRS = ["outputs/policy", "outputs/dataset", "checkpoints/il", "checkpoints/rl"]
_EXTENSIONS = {".onnx", ".hdf5", ".pt", ".zip"}
_TYPE_MAP = {".onnx": "onnx", ".hdf5": "hdf5", ".pt": "pt", ".zip": "zip"}


def _scan_artifacts() -> list[dict]:
    results = []
    for d in _SCAN_DIRS:
        base = _ROOT / d
        if not base.exists():
            continue
        for p in base.iterdir():
            if p.suffix in _EXTENSIONS:
                artifact_id = hashlib.md5(str(p).encode()).hexdigest()[:12]
                stat = p.stat()
                results.append({
                    "id": artifact_id,
                    "name": p.name,
                    "path": str(p.relative_to(_ROOT)),
                    "size_bytes": stat.st_size,
                    "type": _TYPE_MAP[p.suffix],
                    "created_at": str(int(stat.st_mtime)),
                })
    results.sort(key=lambda x: x["created_at"], reverse=True)
    return results


@router.get("/api/artifacts")
async def list_artifacts():
    return _scan_artifacts()


@router.get("/api/artifacts/{artifact_id}/download")
async def download_artifact(artifact_id: str):
    for art in _scan_artifacts():
        if art["id"] == artifact_id:
            full_path = _ROOT / art["path"]
            if not full_path.exists():
                raise HTTPException(status_code=404, detail="File not found on disk")
            return FileResponse(path=str(full_path), filename=art["name"])
    raise HTTPException(status_code=404, detail=f"Artifact {artifact_id!r} not found")
```

- [ ] **Step 4: `api/main.py`에 artifacts router 등록**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.subprocess_runner import SubprocessRunner
from api.routes.pipeline import router as pipeline_router
from api.routes.logs import router as logs_router
from api.routes.artifacts import router as artifacts_router

app = FastAPI(title="PhysicalAI Dashboard API")
app.state.runner = SubprocessRunner()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipeline_router)
app.include_router(logs_router)
app.include_router(artifacts_router)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: 모든 백엔드 테스트 통과 확인**

```bash
python -m pytest api/tests/ -v
```

Expected: 9 tests `PASSED`

- [ ] **Step 6: 커밋**

```bash
git add api/
git commit -m "feat: artifacts list and download endpoints"
```

---

## Task 6: React 스캐폴딩 (Vite + TailwindCSS + Recharts)

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/vite.config.ts`
- Create: `dashboard/tailwind.config.ts`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/index.html`
- Create: `dashboard/src/main.tsx`
- Create: `dashboard/src/App.tsx`

- [ ] **Step 1: dashboard 디렉토리 생성 및 package.json 작성**

```bash
mkdir dashboard
```

`dashboard/package.json`:
```json
{
  "name": "physicalai-dashboard",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tanstack/react-query": "^5.51.1",
    "recharts": "^2.12.7",
    "lucide-react": "^0.414.0",
    "clsx": "^2.1.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.3.4",
    "tailwindcss": "^3.4.7",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.40",
    "vitest": "^2.0.4",
    "@vitest/ui": "^2.0.4",
    "jsdom": "^24.1.1",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.6"
  }
}
```

- [ ] **Step 2: 의존성 설치**

```bash
cd dashboard && npm install
```

Expected: `added XXX packages`

- [ ] **Step 3: `dashboard/vite.config.ts` 작성**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
```

- [ ] **Step 4: `dashboard/tailwind.config.ts` 작성**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0f1117',
        panel: '#1a1d2e',
        border: '#2d3148',
        muted: '#64748b',
        accent: '#6366f1',
        'accent-light': '#a5b4fc',
      },
      fontFamily: {
        mono: ['Consolas', 'monospace'],
      },
    },
  },
} satisfies Config
```

- [ ] **Step 5: `dashboard/tsconfig.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: `dashboard/index.html` 작성**

```html
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PhysicalAI Dashboard</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: `dashboard/src/main.tsx` 작성**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
```

- [ ] **Step 8: `dashboard/src/index.css` 작성 (Tailwind directives)**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0f1117;
  color: #e2e8f0;
}
```

- [ ] **Step 9: `dashboard/postcss.config.js` 작성**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 10: `dashboard/src/App.tsx` 작성 (smoke test용 최소 구현)**

```typescript
export default function App() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-accent-light text-lg font-semibold">PhysicalAI Dashboard</p>
    </div>
  )
}
```

- [ ] **Step 11: test setup 파일 생성**

`dashboard/src/__tests__/setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 12: dev 서버 실행 확인**

```bash
cd dashboard && npm run dev
```

Expected: `Local: http://localhost:5173/` — 브라우저에서 보라색 텍스트 표시 확인

- [ ] **Step 13: 커밋**

```bash
cd ..
git add dashboard/
git commit -m "feat: React+Vite+Tailwind scaffold"
```

---

## Task 7: 타입 정의 + API 클라이언트

**Files:**
- Create: `dashboard/src/types/pipeline.ts`
- Create: `dashboard/src/api/client.ts`

- [ ] **Step 1: `dashboard/src/types/pipeline.ts` 작성**

```typescript
export type StageStatus = 'done' | 'running' | 'pending' | 'error'
export type StageId = 'env' | 'collect' | 'il' | 'rl' | 'export'
export type ArtifactType = 'onnx' | 'hdf5' | 'pt' | 'zip'

export interface Stage {
  id: StageId
  name: string
  status: StageStatus
  detail: string
}

export interface PipelineStatus {
  running: boolean
  stage: StageId | null
}

export interface Artifact {
  id: string
  name: string
  path: string
  size_bytes: number
  type: ArtifactType
  created_at: string
}

export interface LogLine {
  ts: number
  level: 'INFO' | 'WARN' | 'ERROR' | 'RL' | 'IL' | 'RAW'
  text: string
}

export interface MetricPoint {
  step: number
  rew_mean?: number
  loss?: number
  stage: 'rl' | 'il'
  ts: number
}

export function parseLogLevel(line: string): LogLine['level'] {
  if (line.includes('[WARN]') || line.includes('Warning')) return 'WARN'
  if (line.includes('[ERROR]') || line.includes('Error')) return 'ERROR'
  if (line.includes('[RL]')) return 'RL'
  if (line.includes('[IL]')) return 'IL'
  if (line.includes('[INFO]')) return 'INFO'
  return 'RAW'
}
```

- [ ] **Step 2: `dashboard/src/api/client.ts` 작성**

```typescript
import type { Artifact, PipelineStatus, StageId } from '../types/pipeline'

const BASE = '/api'

async function _fetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  health: () => _fetch<{ status: string }>('/health'),
  getStatus: () => _fetch<PipelineStatus>('/status'),
  runStage: (stage: StageId, options?: { validate?: boolean }) => {
    const params = new URLSearchParams()
    if (options?.validate) params.set('validate', 'true')
    const qs = params.toString() ? `?${params}` : ''
    return _fetch<{ started: string }>(`/run/${stage}${qs}`, { method: 'POST' })
  },
  getArtifacts: () => _fetch<Artifact[]>('/artifacts'),
  artifactDownloadUrl: (id: string) => `${BASE}/artifacts/${id}/download`,
}
```

- [ ] **Step 3: TypeScript 컴파일 확인**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: 오류 없음 (exit 0)

- [ ] **Step 4: 커밋**

```bash
cd ..
git add dashboard/src/types/ dashboard/src/api/
git commit -m "feat: TypeScript types and API client"
```

---

## Task 8: SSE Hooks (useSSELogs + useSSEMetrics)

**Files:**
- Create: `dashboard/src/hooks/useSSELogs.ts`
- Create: `dashboard/src/hooks/useSSEMetrics.ts`
- Create: `dashboard/src/__tests__/useSSELogs.test.ts`

- [ ] **Step 1: failing test 작성**

`dashboard/src/__tests__/useSSELogs.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSSELogs } from '../hooks/useSSELogs'

// EventSource mock
class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: Event) => void) | null = null
  addEventListener = vi.fn((type: string, handler: (e: MessageEvent) => void) => {
    if (type === 'log') this._logHandler = handler
  })
  _logHandler: ((e: MessageEvent) => void) | null = null
  close = vi.fn()

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }
}

beforeEach(() => {
  MockEventSource.instances = []
  vi.stubGlobal('EventSource', MockEventSource)
})

describe('useSSELogs', () => {
  it('starts with empty lines and connected=false', () => {
    const { result } = renderHook(() => useSSELogs('/api/logs/stream'))
    expect(result.current.lines).toEqual([])
  })

  it('appends log lines from SSE events', async () => {
    const { result } = renderHook(() => useSSELogs('/api/logs/stream'))
    const es = MockEventSource.instances[0]
    act(() => {
      es._logHandler?.({ data: JSON.stringify({ line: '[RL] Step 100 | rew=-0.04', ts: 1000 }) } as MessageEvent)
    })
    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0].text).toBe('[RL] Step 100 | rew=-0.04')
    expect(result.current.lines[0].level).toBe('RL')
  })

  it('keeps max 200 lines', async () => {
    const { result } = renderHook(() => useSSELogs('/api/logs/stream'))
    const es = MockEventSource.instances[0]
    act(() => {
      for (let i = 0; i < 250; i++) {
        es._logHandler?.({ data: JSON.stringify({ line: `line ${i}`, ts: i }) } as MessageEvent)
      }
    })
    expect(result.current.lines).toHaveLength(200)
    expect(result.current.lines[199].text).toBe('line 249')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd dashboard && npm test -- --reporter=verbose
```

Expected: `FAILED` — `Cannot find module '../hooks/useSSELogs'`

- [ ] **Step 3: `dashboard/src/hooks/useSSELogs.ts` 작성**

```typescript
import { useEffect, useRef, useState } from 'react'
import type { LogLine } from '../types/pipeline'
import { parseLogLevel } from '../types/pipeline'

const MAX_LINES = 200

export function useSSELogs(url: string): { lines: LogLine[]; connected: boolean } {
  const [lines, setLines] = useState<LogLine[]>([])
  const [connected, setConnected] = useState(false)
  const retryDelay = useRef(1000)
  const esRef = useRef<EventSource | null>(null)

  useEffect(() => {
    let cancelled = false

    function connect() {
      if (cancelled) return
      const es = new EventSource(url)
      esRef.current = es

      es.addEventListener('log', (e: MessageEvent) => {
        try {
          const { line, ts } = JSON.parse(e.data) as { line: string; ts: number }
          setLines(prev => {
            const next = [...prev, { ts, level: parseLogLevel(line), text: line }]
            return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
          })
        } catch {}
      })

      es.addEventListener('done', () => {
        setConnected(false)
        es.close()
        retryDelay.current = 1000
      })

      es.addEventListener('error', () => {
        setConnected(false)
        es.close()
      })

      es.onerror = () => {
        setConnected(false)
        es.close()
        if (!cancelled) {
          setTimeout(connect, Math.min(retryDelay.current, 4000))
          retryDelay.current = Math.min(retryDelay.current * 2, 4000)
        }
      }

      es.onopen = () => {
        setConnected(true)
        retryDelay.current = 1000
      }
    }

    connect()
    return () => {
      cancelled = true
      esRef.current?.close()
    }
  }, [url])

  return { lines, connected }
}
```

- [ ] **Step 4: `dashboard/src/hooks/useSSEMetrics.ts` 작성**

```typescript
import { useEffect, useState } from 'react'
import type { MetricPoint } from '../types/pipeline'

const MAX_POINTS = 500

export function useSSEMetrics(url: string): { points: MetricPoint[] } {
  const [points, setPoints] = useState<MetricPoint[]>([])

  useEffect(() => {
    let cancelled = false
    let es: EventSource

    function connect() {
      if (cancelled) return
      es = new EventSource(url)
      es.addEventListener('metric', (e: MessageEvent) => {
        try {
          const point = JSON.parse(e.data) as MetricPoint
          setPoints(prev => {
            const next = [...prev, point]
            return next.length > MAX_POINTS ? next.slice(next.length - MAX_POINTS) : next
          })
        } catch {}
      })
      es.onerror = () => {
        es.close()
        if (!cancelled) setTimeout(connect, 2000)
      }
    }

    connect()
    return () => {
      cancelled = true
      es?.close()
    }
  }, [url])

  return { points }
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd dashboard && npm test -- --reporter=verbose
```

Expected: 3 tests `PASSED`

- [ ] **Step 6: 커밋**

```bash
cd ..
git add dashboard/src/hooks/ dashboard/src/__tests__/useSSELogs.test.ts
git commit -m "feat: useSSELogs and useSSEMetrics hooks"
```

---

## Task 9: usePipeline Hook (React Query)

**Files:**
- Create: `dashboard/src/hooks/usePipeline.ts`

- [ ] **Step 1: `dashboard/src/hooks/usePipeline.ts` 작성**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { StageId } from '../types/pipeline'

export function usePipelineStatus() {
  return useQuery({
    queryKey: ['pipeline-status'],
    queryFn: api.getStatus,
    refetchInterval: 2000,
  })
}

export function useRunStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ stage, validate }: { stage: StageId; validate?: boolean }) =>
      api.runStage(stage, { validate }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pipeline-status'] }),
  })
}

export function useArtifacts() {
  return useQuery({
    queryKey: ['artifacts'],
    queryFn: api.getArtifacts,
    refetchInterval: 5000,
  })
}
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
cd ..
git add dashboard/src/hooks/usePipeline.ts
git commit -m "feat: usePipeline, usePipelineStatus, useArtifacts hooks"
```

---

## Task 10: UI Primitives (KPICard + StatusBadge)

**Files:**
- Create: `dashboard/src/components/ui/KPICard.tsx`
- Create: `dashboard/src/components/ui/StatusBadge.tsx`

- [ ] **Step 1: failing test 작성**

`dashboard/src/__tests__/PipelineBar.test.tsx`에 먼저 StatusBadge 테스트를 포함:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../components/ui/StatusBadge'

describe('StatusBadge', () => {
  it('renders done badge', () => {
    render(<StatusBadge status="done" />)
    expect(screen.getByText('done')).toBeInTheDocument()
  })
  it('renders running badge', () => {
    render(<StatusBadge status="running" />)
    expect(screen.getByText('running')).toBeInTheDocument()
  })
  it('renders error badge', () => {
    render(<StatusBadge status="error" />)
    expect(screen.getByText('error')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd dashboard && npm test
```

Expected: `FAILED` — `Cannot find module '../components/ui/StatusBadge'`

- [ ] **Step 3: `dashboard/src/components/ui/StatusBadge.tsx` 작성**

```typescript
import { clsx } from 'clsx'
import type { StageStatus } from '../../types/pipeline'

const STYLES: Record<StageStatus, string> = {
  done: 'bg-emerald-900 text-emerald-400',
  running: 'bg-indigo-900 text-indigo-300 animate-pulse',
  pending: 'bg-slate-800 text-slate-500',
  error: 'bg-red-950 text-red-400',
}

interface Props { status: StageStatus; className?: string }

export function StatusBadge({ status, className }: Props) {
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-xs font-bold', STYLES[status], className)}>
      {status}
    </span>
  )
}
```

- [ ] **Step 4: `dashboard/src/components/ui/KPICard.tsx` 작성**

```typescript
import { clsx } from 'clsx'

interface Props {
  label: string
  value: string | number
  sub?: string
  subColor?: 'green' | 'amber' | 'muted'
}

const SUB_COLORS = {
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  muted: 'text-slate-500',
}

export function KPICard({ label, value, sub, subColor = 'muted' }: Props) {
  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-bold text-slate-100 mb-1">{value}</p>
      {sub && <p className={clsx('text-xs', SUB_COLORS[subColor])}>{sub}</p>}
    </div>
  )
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd dashboard && npm test
```

Expected: 6 tests `PASSED`

- [ ] **Step 6: 커밋**

```bash
cd ..
git add dashboard/src/components/ui/
git commit -m "feat: KPICard and StatusBadge UI components"
```

---

## Task 11: PipelineBar + StageButton

**Files:**
- Create: `dashboard/src/components/pipeline/PipelineBar.tsx`
- Create: `dashboard/src/components/pipeline/StageButton.tsx`
- Modify: `dashboard/src/__tests__/PipelineBar.test.tsx`

- [ ] **Step 1: failing tests 추가**

`dashboard/src/__tests__/PipelineBar.test.tsx`에 추가:
```typescript
import { PipelineBar } from '../components/pipeline/PipelineBar'
import type { Stage } from '../types/pipeline'

const STAGES: Stage[] = [
  { id: 'env', name: 'ENV', status: 'done', detail: 'Validated' },
  { id: 'collect', name: 'COLLECT', status: 'done', detail: '10 eps' },
  { id: 'il', name: 'IL', status: 'done', detail: 'best.pt' },
  { id: 'rl', name: 'RL', status: 'running', detail: 'Step 32k' },
  { id: 'export', name: 'EXPORT', status: 'pending', detail: '' },
]

describe('PipelineBar', () => {
  it('renders all 5 stage names', () => {
    render(<PipelineBar stages={STAGES} />)
    expect(screen.getByText('ENV')).toBeInTheDocument()
    expect(screen.getByText('COLLECT')).toBeInTheDocument()
    expect(screen.getByText('IL')).toBeInTheDocument()
    expect(screen.getByText('RL')).toBeInTheDocument()
    expect(screen.getByText('EXPORT')).toBeInTheDocument()
  })

  it('shows detail text for done stages', () => {
    render(<PipelineBar stages={STAGES} />)
    expect(screen.getByText('Validated')).toBeInTheDocument()
    expect(screen.getByText('10 eps')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd dashboard && npm test
```

Expected: `FAILED` — `Cannot find module '../components/pipeline/PipelineBar'`

- [ ] **Step 3: `dashboard/src/components/pipeline/StageButton.tsx` 작성**

```typescript
import { clsx } from 'clsx'
import type { Stage, StageId } from '../../types/pipeline'

const CIRCLE: Record<Stage['status'], string> = {
  done: 'border-emerald-500 bg-emerald-950 text-emerald-400',
  running: 'border-indigo-400 bg-indigo-950 text-indigo-300 animate-pulse',
  pending: 'border-slate-700 bg-slate-900 text-slate-600',
  error: 'border-red-500 bg-red-950 text-red-400',
}

const ICON: Record<Stage['status'], string> = {
  done: '✓', running: '⟳', pending: '○', error: '✕',
}

interface Props {
  stage: Stage
  onRun?: (id: StageId) => void
  disabled?: boolean
}

export function StageButton({ stage, onRun, disabled }: Props) {
  return (
    <div className="flex flex-col items-center gap-2 cursor-default" title={stage.detail}>
      <button
        onClick={() => onRun?.(stage.id)}
        disabled={disabled || stage.status === 'running'}
        className={clsx(
          'w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm transition-all',
          CIRCLE[stage.status],
          !disabled && stage.status !== 'running' && 'hover:scale-110'
        )}
      >
        {ICON[stage.status]}
      </button>
      <span className="text-xs font-semibold text-slate-400">{stage.name}</span>
      {stage.detail && <span className="text-[10px] text-slate-500">{stage.detail}</span>}
    </div>
  )
}
```

- [ ] **Step 4: `dashboard/src/components/pipeline/PipelineBar.tsx` 작성**

```typescript
import type { Stage, StageId } from '../../types/pipeline'
import { StageButton } from './StageButton'

interface Props {
  stages: Stage[]
  onRun?: (id: StageId) => void
  disabled?: boolean
}

export function PipelineBar({ stages, onRun, disabled }: Props) {
  return (
    <div className="bg-panel border border-border rounded-xl p-5">
      <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">Pipeline Stages</p>
      <div className="flex items-start justify-between relative">
        <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-border -z-0" />
        {stages.map((stage) => (
          <StageButton key={stage.id} stage={stage} onRun={onRun} disabled={disabled} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd dashboard && npm test
```

Expected: 8 tests `PASSED`

- [ ] **Step 6: 커밋**

```bash
cd ..
git add dashboard/src/components/pipeline/ dashboard/src/__tests__/PipelineBar.test.tsx
git commit -m "feat: PipelineBar and StageButton components"
```

---

## Task 12: LogPanel

**Files:**
- Create: `dashboard/src/components/monitoring/LogPanel.tsx`
- Create: `dashboard/src/__tests__/LogPanel.test.tsx`

- [ ] **Step 1: failing test 작성**

`dashboard/src/__tests__/LogPanel.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LogPanel } from '../components/monitoring/LogPanel'
import type { LogLine } from '../types/pipeline'

const LINES: LogLine[] = [
  { ts: 1000, level: 'INFO', text: 'ENV OK - obs keys: [...]' },
  { ts: 1001, level: 'RL', text: '[RL] Step 100 | rew=-0.04' },
  { ts: 1002, level: 'WARN', text: 'No compatible IL layers' },
]

describe('LogPanel', () => {
  it('renders all log lines', () => {
    render(<LogPanel lines={LINES} connected={true} />)
    expect(screen.getByText(/ENV OK/)).toBeInTheDocument()
    expect(screen.getByText(/Step 100/)).toBeInTheDocument()
    expect(screen.getByText(/No compatible IL layers/)).toBeInTheDocument()
  })

  it('shows connected indicator', () => {
    render(<LogPanel lines={[]} connected={true} />)
    expect(screen.getByText('LIVE')).toBeInTheDocument()
  })

  it('shows disconnected indicator', () => {
    render(<LogPanel lines={[]} connected={false} />)
    expect(screen.getByText('OFFLINE')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd dashboard && npm test
```

Expected: `FAILED` — `Cannot find module '../components/monitoring/LogPanel'`

- [ ] **Step 3: `dashboard/src/components/monitoring/LogPanel.tsx` 작성**

```typescript
import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import type { LogLine } from '../../types/pipeline'

const LEVEL_COLOR: Record<LogLine['level'], string> = {
  INFO: 'text-indigo-300',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
  RL: 'text-violet-400',
  IL: 'text-sky-400',
  RAW: 'text-slate-400',
}

interface Props { lines: LogLine[]; connected: boolean }

export function LogPanel({ lines, connected }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoScroll = useRef(true)

  useEffect(() => {
    if (autoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lines])

  function handleScroll() {
    const el = containerRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    autoScroll.current = atBottom
  }

  return (
    <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted uppercase tracking-widest">Live Log</p>
        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded', connected ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-500')}>
          {connected ? 'LIVE' : 'OFFLINE'}
        </span>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="bg-[#0d1117] rounded-md p-3 font-mono text-[11px] h-36 overflow-y-auto flex flex-col gap-0.5"
      >
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-slate-600 flex-shrink-0">
              {new Date(line.ts * 1000).toLocaleTimeString()}
            </span>
            <span className={clsx('flex-shrink-0', LEVEL_COLOR[line.level])}>[{line.level}]</span>
            <span className="text-slate-300 break-all">{line.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd dashboard && npm test
```

Expected: 11 tests `PASSED`

- [ ] **Step 5: 커밋**

```bash
cd ..
git add dashboard/src/components/monitoring/LogPanel.tsx dashboard/src/__tests__/LogPanel.test.tsx
git commit -m "feat: LogPanel with auto-scroll and live/offline indicator"
```

---

## Task 13: RewardChart

**Files:**
- Create: `dashboard/src/components/monitoring/RewardChart.tsx`

- [ ] **Step 1: `dashboard/src/components/monitoring/RewardChart.tsx` 작성**

```typescript
import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { clsx } from 'clsx'
import type { MetricPoint } from '../../types/pipeline'

type Metric = 'rew_mean' | 'loss'

interface Props { points: MetricPoint[] }

export function RewardChart({ points }: Props) {
  const [metric, setMetric] = useState<Metric>('rew_mean')

  const filtered = points.filter(p => p[metric] !== undefined)

  return (
    <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted uppercase tracking-widest">Training Metrics</p>
        <div className="flex gap-1">
          {(['rew_mean', 'loss'] as Metric[]).map(m => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={clsx(
                'text-[10px] font-bold px-2 py-0.5 rounded',
                metric === m ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              )}
            >
              {m === 'rew_mean' ? 'Reward' : 'Loss'}
            </button>
          ))}
        </div>
      </div>
      <div className="h-36">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 text-xs">
            Waiting for training data...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filtered} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
              <XAxis dataKey="step" stroke="#475569" tick={{ fontSize: 10 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#1a1d2e', border: '1px solid #2d3148', fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Line
                type="monotone"
                dataKey={metric}
                stroke="#6366f1"
                dot={false}
                strokeWidth={2}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
cd ..
git add dashboard/src/components/monitoring/RewardChart.tsx
git commit -m "feat: RewardChart with Recharts live update"
```

---

## Task 14: ArtifactList

**Files:**
- Create: `dashboard/src/components/artifacts/ArtifactList.tsx`

- [ ] **Step 1: `dashboard/src/components/artifacts/ArtifactList.tsx` 작성**

```typescript
import type { Artifact } from '../../types/pipeline'
import { api } from '../../api/client'

const ICON: Record<Artifact['type'], string> = {
  onnx: '🧠', hdf5: '📦', pt: '💾', zip: '🗜',
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

interface Props { artifacts: Artifact[] }

export function ArtifactList({ artifacts }: Props) {
  if (artifacts.length === 0) {
    return (
      <div className="bg-panel border border-border rounded-xl p-4">
        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Artifacts</p>
        <p className="text-slate-600 text-xs">No artifacts yet. Run the export stage.</p>
      </div>
    )
  }

  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Artifacts</p>
      <div className="flex flex-col gap-2">
        {artifacts.map(art => (
          <div key={art.id} className="flex items-center gap-3 px-3 py-2 bg-[#0d1117] rounded-lg border border-border">
            <span className="text-xl">{ICON[art.type]}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{art.name}</p>
              <p className="text-[10px] text-slate-500">{art.path}</p>
            </div>
            <span className="text-xs text-slate-500 flex-shrink-0">{formatBytes(art.size_bytes)}</span>
            <a
              href={api.artifactDownloadUrl(art.id)}
              download={art.name}
              className="text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
            >
              ↓
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 3: 커밋**

```bash
cd ..
git add dashboard/src/components/artifacts/
git commit -m "feat: ArtifactList with download links"
```

---

## Task 15: Sidebar + TopBar + Overview 페이지 + 통합 검증

**Files:**
- Create: `dashboard/src/components/layout/Sidebar.tsx`
- Create: `dashboard/src/components/layout/TopBar.tsx`
- Create: `dashboard/src/pages/Overview.tsx`
- Modify: `dashboard/src/App.tsx`
- Modify: `.gitignore`

- [ ] **Step 1: `dashboard/src/components/layout/Sidebar.tsx` 작성**

```typescript
import { clsx } from 'clsx'
import type { PipelineStatus } from '../../types/pipeline'

const NAV_ITEMS = [
  { label: 'Overview', icon: '◈', active: true },
  { label: 'Run', icon: '▶' },
  { label: 'Training', icon: '📈' },
  { label: 'Demos', icon: '🗄' },
  { label: 'Artifacts', icon: '📦' },
  { label: 'Config', icon: '⚙' },
]

interface Props { status: PipelineStatus | undefined }

export function Sidebar({ status }: Props) {
  return (
    <aside className="w-56 flex-shrink-0 bg-panel border-r border-border flex flex-col">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="w-7 h-7 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm">🤖</div>
        <div>
          <p className="text-sm font-bold text-slate-100">PhysicalAI</p>
          <p className="text-[10px] text-muted">Pipeline Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 p-2 flex flex-col gap-0.5">
        {NAV_ITEMS.map(item => (
          <div
            key={item.label}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer',
              item.active ? 'bg-indigo-950 text-indigo-300' : 'text-slate-400 hover:bg-border hover:text-slate-200'
            )}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface rounded-lg">
          <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', status?.running ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600')} />
          <div>
            <p className="text-xs font-semibold text-slate-300">
              {status?.running ? `${status.stage?.toUpperCase()} Running` : 'Idle'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: `dashboard/src/components/layout/TopBar.tsx` 작성**

```typescript
import { clsx } from 'clsx'

interface Props {
  onNewRun: () => void
  running: boolean
  mockMode?: boolean
}

export function TopBar({ onNewRun, running, mockMode }: Props) {
  return (
    <header className="h-12 flex-shrink-0 bg-panel border-b border-border flex items-center px-5 gap-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span>PhysicalAI</span>
        <span className="text-border">/</span>
        <span className="text-slate-300 font-semibold">Overview</span>
      </div>
      <div className="flex-1" />
      {mockMode && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-900 text-emerald-400">mock_mode</span>
      )}
      <button
        onClick={onNewRun}
        disabled={running}
        className={clsx(
          'text-xs font-semibold px-4 py-1.5 rounded-md transition-colors',
          running ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
        )}
      >
        {running ? '⟳ Running...' : '▶ New Run'}
      </button>
    </header>
  )
}
```

- [ ] **Step 3: `dashboard/src/pages/Overview.tsx` 작성**

```typescript
import type { Stage } from '../types/pipeline'
import { KPICard } from '../components/ui/KPICard'
import { PipelineBar } from '../components/pipeline/PipelineBar'
import { LogPanel } from '../components/monitoring/LogPanel'
import { RewardChart } from '../components/monitoring/RewardChart'
import { ArtifactList } from '../components/artifacts/ArtifactList'
import { usePipelineStatus, useRunStage, useArtifacts } from '../hooks/usePipeline'
import { useSSELogs } from '../hooks/useSSELogs'
import { useSSEMetrics } from '../hooks/useSSEMetrics'

const STAGE_DEFS: Pick<Stage, 'id' | 'name'>[] = [
  { id: 'env', name: 'ENV' },
  { id: 'collect', name: 'COLLECT' },
  { id: 'il', name: 'IL' },
  { id: 'rl', name: 'RL' },
  { id: 'export', name: 'EXPORT' },
]

export function Overview() {
  const { data: status } = usePipelineStatus()
  const { data: artifacts = [] } = useArtifacts()
  const { mutate: runStage } = useRunStage()
  const { lines, connected } = useSSELogs('/api/logs/stream')
  const { points } = useSSEMetrics('/api/metrics/stream')

  const stages: Stage[] = STAGE_DEFS.map(def => ({
    ...def,
    status: status?.stage === def.id ? 'running' : 'pending',
    detail: '',
  }))

  const ilMetrics = points.filter(p => p.stage === 'il')
  const rlMetrics = points.filter(p => p.stage === 'rl')
  const lastRew = rlMetrics.at(-1)?.rew_mean
  const lastLoss = ilMetrics.at(-1)?.loss

  return (
    <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-3">
        <KPICard
          label="Current Stage"
          value={status?.stage?.toUpperCase() ?? 'Idle'}
          sub={status?.running ? '▶ Running' : '— Idle'}
          subColor={status?.running ? 'green' : 'muted'}
        />
        <KPICard
          label="IL Best Loss"
          value={lastLoss?.toFixed(4) ?? '—'}
          sub={ilMetrics.length > 0 ? `Epoch ${ilMetrics.at(-1)?.step}` : 'No data yet'}
          subColor="green"
        />
        <KPICard
          label="RL Steps"
          value={lastRew !== undefined ? `Step ${rlMetrics.at(-1)?.step?.toLocaleString()}` : '—'}
          sub={lastRew !== undefined ? `rew_mean: ${lastRew.toFixed(4)}` : 'Not started'}
          subColor="amber"
        />
        <KPICard
          label="Artifacts"
          value={artifacts.length}
          sub={artifacts.length > 0 ? artifacts[0].name : 'None yet'}
        />
      </div>

      <PipelineBar
        stages={stages}
        onRun={id => runStage({ stage: id, validate: id === 'env' })}
        disabled={status?.running}
      />

      <div className="grid grid-cols-2 gap-4">
        <RewardChart points={points} />
        <LogPanel lines={lines} connected={connected} />
      </div>

      <ArtifactList artifacts={artifacts} />
    </div>
  )
}
```

- [ ] **Step 4: `dashboard/src/App.tsx`를 최종 레이아웃으로 교체**

```typescript
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { Overview } from './pages/Overview'
import { usePipelineStatus, useRunStage } from './hooks/usePipeline'

export default function App() {
  const { data: status } = usePipelineStatus()
  const { mutate: runStage } = useRunStage()

  return (
    <div className="h-screen flex overflow-hidden bg-surface text-slate-200">
      <Sidebar status={status} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onNewRun={() => runStage({ stage: 'env', validate: true })}
          running={status?.running ?? false}
          mockMode
        />
        <Overview />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: `.gitignore`에 항목 추가**

기존 `.gitignore` 파일에 추가:
```
dashboard/node_modules/
dashboard/dist/
.superpowers/
```

- [ ] **Step 6: 전체 테스트 통과 확인**

```bash
cd dashboard && npm test
```

Expected: 11 tests `PASSED`

- [ ] **Step 7: TypeScript 최종 컴파일 확인**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: 오류 없음

- [ ] **Step 8: 백엔드 + 프론트 동시 실행 확인**

터미널 1:
```bash
uvicorn api.main:app --reload --port 8000
```

터미널 2:
```bash
cd dashboard && npm run dev
```

브라우저에서 `http://localhost:5173` 접속 → 대시보드 표시, `/api/health` 응답 확인.

- [ ] **Step 9: 파이프라인 단계 실행 통합 테스트**

```bash
curl -X POST http://localhost:8000/api/run/env?validate=true
# Expected: {"started": "env"}

curl http://localhost:8000/api/status
# Expected: {"running": true, "stage": "env"} 또는 {"running": false, "stage": null}

curl http://localhost:8000/api/artifacts
# Expected: [...artifact list...]
```

- [ ] **Step 10: 최종 커밋**

```bash
cd ..
git add dashboard/src/components/layout/ dashboard/src/pages/ dashboard/src/App.tsx .gitignore
git commit -m "feat: Sidebar, TopBar, Overview page - dashboard complete"
```

---

## 완성 기준 체크리스트

- [ ] `python -m pytest api/tests/ -v` — 9 tests PASSED
- [ ] `cd dashboard && npm test` — 11 tests PASSED
- [ ] `cd dashboard && npx tsc --noEmit` — 오류 없음
- [ ] `http://localhost:5173` — 대시보드 렌더링 정상
- [ ] `POST /api/run/env?validate=true` → 로그 패널에 `ENV OK` 표시
- [ ] `POST /api/run/rl` → RewardChart에 실시간 reward 점 추가
- [ ] Artifacts 섹션에서 policy.onnx 다운로드 동작
