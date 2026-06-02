from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter()

VALID_STAGES = {"env", "collect", "il", "rl", "export"}


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
