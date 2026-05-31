import asyncio
import json
import os
import re
import subprocess
import threading
import time
from pathlib import Path

from api.event_bus import EventBus

_RL_RE = re.compile(r"\[RL\]\s+Step\s+(\d+)\s*\|\s*rew=([\d.\-]+)")
_IL_RE = re.compile(r"\[IL\]\s+Epoch\s+(\d+)\s+loss=([\d.]+)")

# Mock log sequences per stage (Railway / MOCK_PIPELINE=true 시 사용)
_MOCK_LOGS: dict[str, list[tuple[float, str]]] = {
    "env": [
        (0.3, "[ENV] Initializing IsaacEnv (mock_mode=True)..."),
        (0.6, "[ENV] Robot config: 7 joints, mobile_base=False"),
        (0.9, "[ENV] Sensor: RGB 224x224, depth enabled"),
        (1.2, "[ENV] Reset OK — obs keys: ['rgb', 'depth', 'joint_state', 'ee_pose']"),
        (1.4, "[ENV] ENV OK - obs keys: ['rgb', 'depth', 'joint_state', 'ee_pose']"),
    ],
    "collect": [
        (0.2, "[COLLECT] Mode: random  episodes=10  max_steps=500"),
        (0.5, "[COLLECT] Episode 1/10 — collecting..."),
        (1.0, "[COLLECT] Episode 2/10 — collecting..."),
        (1.5, "[COLLECT] Episode 3/10 — collecting..."),
        (2.0, "[COLLECT] Episode 4/10 — collecting..."),
        (2.5, "[COLLECT] Episode 5/10 — collecting..."),
        (3.0, "[COLLECT] Episode 6/10 — collecting..."),
        (3.5, "[COLLECT] Episode 7/10 — collecting..."),
        (4.0, "[COLLECT] Episode 8/10 — collecting..."),
        (4.5, "[COLLECT] Episode 9/10 — collecting..."),
        (5.0, "[COLLECT] Episode 10/10 — collecting..."),
        (5.3, "[COLLECT] Saved 5000 steps → demos/  (10 episodes)"),
    ],
    "il": [
        (0.3, "[IL] Loading dataset: 5000 steps from demos/"),
        (0.6, "[IL] Model: MLP obs_dim=14 action_dim=10"),
        (0.8, "[IL] Epoch 1 loss=0.4821"),
        (1.4, "[IL] Epoch 2 loss=0.3764"),
        (2.0, "[IL] Epoch 3 loss=0.2903"),
        (2.6, "[IL] Epoch 4 loss=0.2341"),
        (3.2, "[IL] Epoch 5 loss=0.1987"),
        (3.8, "[IL] Epoch 6 loss=0.1734"),
        (4.4, "[IL] Epoch 7 loss=0.1523"),
        (5.0, "[IL] Epoch 8 loss=0.1398"),
        (5.6, "[IL] Epoch 9 loss=0.1277"),
        (6.2, "[IL] Epoch 10 loss=0.1189"),
        (6.5, "[IL] Best checkpoint saved → checkpoints/il/best.pt"),
        (6.8, "[IL] IL training done."),
    ],
    "rl": [
        (0.3, "[RL] Loading IL checkpoint → checkpoints/il/best.pt"),
        (0.6, "[RL] Algorithm: PPO  total_timesteps=50000"),
        (1.0, "[RL] Step 1000 | rew=-0.312"),
        (2.0, "[RL] Step 5000 | rew=-0.187"),
        (3.0, "[RL] Step 10000 | rew=0.043"),
        (4.0, "[RL] Step 15000 | rew=0.128"),
        (5.0, "[RL] Step 20000 | rew=0.241"),
        (6.0, "[RL] Step 25000 | rew=0.318"),
        (7.0, "[RL] Step 30000 | rew=0.402"),
        (8.0, "[RL] Step 35000 | rew=0.467"),
        (9.0, "[RL] Step 40000 | rew=0.531"),
        (10.0, "[RL] Step 45000 | rew=0.589"),
        (11.0, "[RL] Step 50000 | rew=0.621"),
        (11.4, "[RL] Best checkpoint saved → checkpoints/rl/best.zip"),
        (11.7, "[RL] RL training done."),
    ],
    "export": [
        (0.3, "[EXPORT] Loading RL checkpoint → checkpoints/rl/best.zip"),
        (0.6, "[EXPORT] Exporting policy → ONNX..."),
        (1.0, "[EXPORT] Policy exported: outputs/policy/policy.onnx"),
        (1.3, "[EXPORT] Building dataset: 5 rollouts x 200 steps"),
        (1.8, "[EXPORT] Rollout 1/5 (20%) | 200 steps total"),
        (2.3, "[EXPORT] Rollout 2/5 (40%) | 400 steps total"),
        (2.8, "[EXPORT] Rollout 3/5 (60%) | 600 steps total"),
        (3.3, "[EXPORT] Rollout 4/5 (80%) | 800 steps total"),
        (3.8, "[EXPORT] Rollout 5/5 (100%) | 1000 steps total"),
        (4.0, "[EXPORT] Saved 1000 frames → outputs/dataset/synthetic_v1.hdf5"),
    ],
}


class SubprocessRunner:
    def __init__(self):
        self._process: subprocess.Popen | None = None
        self._mock_task: asyncio.Task | None = None
        self.current_stage: str | None = None
        self.log_bus = EventBus()
        self.metric_bus = EventBus()
        self._project_root = Path(__file__).parent.parent  # PhysicalAI/
        # mock_mode is the initial default from the environment but can be
        # toggled at runtime via the /api/mode endpoint (dashboard MOCK/REAL).
        self.mock_mode = os.getenv("MOCK_PIPELINE", "false").strip().lower() == "true"

    def is_running(self) -> bool:
        # mode-independent so a toggle between runs can't mask an active stage
        if self._mock_task is not None and not self._mock_task.done():
            return True
        return self._process is not None and self._process.returncode is None

    async def run(self, stage: str, extra_args: list[str] | None = None) -> None:
        if self.is_running():
            raise RuntimeError("already running")
        self.current_stage = stage
        if self.mock_mode:
            self._mock_task = asyncio.create_task(self._run_mock(stage))
            return
        extra_args = extra_args or []
        # `-u` keeps the child's stdout unbuffered so logs stream live.
        cmd = ["python", "-u", "run.py", stage] + extra_args
        loop = asyncio.get_running_loop()
        # Use a thread + subprocess.Popen rather than asyncio.create_subprocess_exec:
        # uvicorn --reload forces a SelectorEventLoop on Windows, where the asyncio
        # subprocess API raises NotImplementedError. Popen works under any loop.
        self._process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=str(self._project_root),
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
        )
        threading.Thread(target=self._drain, args=(loop,), daemon=True).start()

    async def _run_mock(self, stage: str) -> None:
        logs = _MOCK_LOGS.get(stage, [(1.0, f"[{stage.upper()}] Stage completed (mock)")])
        start = time.time()
        for delay, text in logs:
            await asyncio.sleep(delay - (time.time() - start))
            ts = int(time.time())
            await self.log_bus.publish({"event": "log", "data": json.dumps({"line": text, "ts": ts})})
            m = _RL_RE.search(text)
            if m:
                metric = {"step": int(m.group(1)), "rew_mean": float(m.group(2)), "stage": "rl", "ts": ts}
                await self.metric_bus.publish({"event": "metric", "data": json.dumps(metric)})
            m = _IL_RE.search(text)
            if m:
                metric = {"step": int(m.group(1)), "loss": float(m.group(2)), "stage": "il", "ts": ts}
                await self.metric_bus.publish({"event": "metric", "data": json.dumps(metric)})
        self.current_stage = None
        payload = {"stage": stage, "exit_code": 0}
        ev = {"event": "done", "data": json.dumps(payload)}
        await self.log_bus.publish(ev)
        await self.metric_bus.publish(ev)

    def _drain(self, loop: asyncio.AbstractEventLoop) -> None:
        """Runs in a background thread: reads child stdout line-by-line and
        forwards each line to the async EventBuses on the server's event loop."""
        proc = self._process
        assert proc and proc.stdout

        def publish(bus: EventBus, ev: dict) -> None:
            # Bridge from this worker thread back onto the asyncio loop.
            try:
                asyncio.run_coroutine_threadsafe(bus.publish(ev), loop).result()
            except RuntimeError:
                pass  # loop stopped (e.g. server shutdown) — nothing to do

        for raw in proc.stdout:
            text = raw.rstrip()
            ts = int(time.time())
            publish(self.log_bus, {"event": "log", "data": json.dumps({"line": text, "ts": ts})})

            m = _RL_RE.search(text)
            if m:
                metric = {"step": int(m.group(1)), "rew_mean": float(m.group(2)), "stage": "rl", "ts": ts}
                publish(self.metric_bus, {"event": "metric", "data": json.dumps(metric)})
                continue
            m = _IL_RE.search(text)
            if m:
                metric = {"step": int(m.group(1)), "loss": float(m.group(2)), "stage": "il", "ts": ts}
                publish(self.metric_bus, {"event": "metric", "data": json.dumps(metric)})

        exit_code = proc.wait()
        stage = self.current_stage
        self._process = None
        self.current_stage = None
        if exit_code == 0:
            payload = {"stage": stage, "exit_code": 0}
            ev = {"event": "done", "data": json.dumps(payload)}
        else:
            payload = {"stage": stage, "exit_code": exit_code, "msg": f"process exited {exit_code}"}
            ev = {"event": "error", "data": json.dumps(payload)}
        publish(self.log_bus, ev)
        publish(self.metric_bus, ev)
