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

    import os
    mock_mode = os.getenv("MOCK_PIPELINE", "false").strip().lower() == "true"
    if not mock_mode:
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
