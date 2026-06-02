import os
import platform
import subprocess

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

VALID_STAGES = {"env", "collect", "il", "rl", "export"}


def _num(x: str):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def _gpu_info() -> dict:
    """Query nvidia-smi for live GPU telemetry. Returns {available: False} when
    there is no NVIDIA GPU (e.g. the Railway CPU deploy) or nvidia-smi is absent."""
    fields = "name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,power.limit"
    try:
        out = subprocess.run(
            ["nvidia-smi", f"--query-gpu={fields}", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=4,
        )
    except Exception:
        return {"available": False}
    if out.returncode != 0 or not out.stdout.strip():
        return {"available": False}
    gpus = []
    for line in out.stdout.strip().splitlines():
        p = [c.strip() for c in line.split(",")]
        p += [""] * (7 - len(p))
        gpus.append({
            "name": p[0],
            "util": _num(p[1]),
            "mem_used": _num(p[2]),
            "mem_total": _num(p[3]),
            "temp": _num(p[4]),
            "power": _num(p[5]),
            "power_max": _num(p[6]),
        })
    return {"available": True, "gpus": gpus}


class ModeRequest(BaseModel):
    mock: bool

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


@router.get("/api/system")
async def get_system(request: Request):
    """Aggregated compute/runtime status for the Resources dashboard."""
    runner = request.app.state.runner
    return {
        "mode": {"mock": runner.mock_mode, "real_available": runner.real_available},
        "pipeline": {"running": runner.is_running(), "stage": runner.current_stage},
        "gpu": _gpu_info(),
        "host": {
            "platform": platform.system(),
            "python": platform.python_version(),
            "cpu_count": os.cpu_count(),
        },
    }


@router.get("/api/mode")
async def get_mode(request: Request):
    runner = request.app.state.runner
    return {"mock": runner.mock_mode, "real_available": runner.real_available}


@router.post("/api/mode")
async def set_mode(body: ModeRequest, request: Request):
    runner = request.app.state.runner
    if runner.is_running():
        raise HTTPException(status_code=409, detail="Cannot change mode while a stage is running")
    if not body.mock and not runner.real_available:
        raise HTTPException(
            status_code=422,
            detail="REAL mode is unavailable: ML dependencies (torch, stable_baselines3) "
                   "are not installed in this deployment. The pipeline runs in MOCK mode here.",
        )
    runner.mock_mode = body.mock
    return {"mock": runner.mock_mode, "real_available": runner.real_available}


@router.post("/api/run/{stage}")
async def run_stage(stage: str, request: Request, validate: bool = False):
    if stage not in VALID_STAGES:
        raise HTTPException(status_code=422, detail=f"Unknown stage: {stage}. Valid: {sorted(VALID_STAGES)}")
    runner = request.app.state.runner
    if runner.is_running():
        raise HTTPException(status_code=409, detail=f"Stage '{runner.current_stage}' is already running")

    if not runner.mock_mode:
        import os
        prereq = PREREQS.get(stage)
        if prereq and not os.path.exists(prereq):
            raise HTTPException(status_code=422, detail=f"Prerequisite missing: {prereq}")

    extra: list[str] = []
    if stage == "env" and validate:
        extra = ["--validate"]
    if stage == "collect":
        extra = ["--mode", "random", "--episodes", "10"]

    await runner.run(stage, extra_args=extra)
    return {"started": stage}


@router.post("/api/stop")
async def stop_stage(request: Request):
    runner = request.app.state.runner
    if not runner.is_running():
        raise HTTPException(status_code=409, detail="No stage is running")
    stage = runner.current_stage
    await runner.stop()
    return {"stopped": stage}
