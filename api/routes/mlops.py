"""MLOps API — experiment tracking, leaderboard, model registry, usage (Model #2).

The Robotics MLOps SaaS turns the training pipeline into a service: submit a run,
track its metrics, rank it on a leaderboard, then *promote* the winning checkpoint
into the marketplace as a sellable policy (the Model #2 → Model #3 hand-off).
Compute is metered as GPU-time and billed against the account's subscription plan.

Endpoints:
  POST /api/experiments                 submit + run a (mock) training job
  GET  /api/experiments                 list runs (newest first)
  GET  /api/experiments/leaderboard     top runs by success rate
  GET  /api/experiments/{id}            one run's detail (+ learning curve)
  POST /api/experiments/{id}/register   promote a run's checkpoint to the marketplace
  GET  /api/mlops/usage                 GPU-time used vs plan quota
  POST /api/mlops/plan                  change the active subscription plan
"""
from __future__ import annotations

import re
from pathlib import Path

from pydantic import BaseModel

from fastapi import APIRouter, Header, HTTPException

from api import users_store
from mlops import experiments_store as store
from mlops.runner import simulate_run
from export.policy_exporter import PolicyExporter
from export.policy_manifest import build_policy_manifest, save_policy_manifest
from trainer.il.policy import MLPPolicy

router = APIRouter()

store.init_db()
users_store.init_db()


def _bearer(authorization: str | None, x_auth_token: str | None) -> str | None:
    """Pull the customer session token from Authorization: Bearer or X-Auth-Token."""
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return x_auth_token


def _require_user(authorization: str | None, x_auth_token: str | None) -> dict:
    """Resolve the bearer token to a logged-in customer, or raise 401.

    Compute (training jobs) and billing-relevant actions (plan changes, promoting
    a model to the marketplace) must not be anonymous — they spend GPU quota and
    can create sellable products, so a valid session is required.
    """
    token = _bearer(authorization, x_auth_token)
    user = users_store.user_for_token(token) if token else None
    if not user:
        raise HTTPException(status_code=401, detail="MLOps 작업은 로그인이 필요합니다.")
    return user

_ROOT = Path(__file__).parent.parent.parent
_POLICY_DIR = _ROOT / "outputs" / "policy"

# obs/action dims per robot (obs = joint_state + small context vector). Mirrors
# scripts/seed_policies so a registered model has a valid ONNX I/O signature.
_DIMS: dict[str, tuple[int, int]] = {
    "franka": (14, 7), "anymal": (24, 12), "spot": (24, 12),
    "h1": (38, 19), "g1": (46, 23), "crazyflie": (8, 4),
}

_ROBOT_NAMES: dict[str, str] = {
    "franka": "Franka 7-DOF Arm", "anymal": "ANYmal-D", "spot": "Boston Dynamics Spot",
    "h1": "Unitree H1", "g1": "Unitree G1", "crazyflie": "Crazyflie Quadcopter",
}
_CATEGORY: dict[str, str] = {
    "franka": "Manipulator", "anymal": "Quadruped", "spot": "Quadruped",
    "h1": "Humanoid", "g1": "Humanoid", "crazyflie": "Aerial",
}


class RunRequest(BaseModel):
    name: str | None = None
    algo: str = "BC"
    robot: str = "franka"
    dataset: str | None = None
    hyperparams: dict = {}


@router.post("/api/experiments")
async def submit_run(req: RunRequest,
                     authorization: str | None = Header(default=None),
                     x_auth_token: str | None = Header(default=None)):
    """Submit a training job (mock) and record the finished run.

    Login-gated and quota-enforced: a run consumes GPU-time billed against the
    account's plan, so we refuse anonymous submissions and block runs that would
    exceed the remaining monthly quota.
    """
    _require_user(authorization, x_auth_token)

    usage = store.usage_summary()
    if usage["gpu_minutes_remaining"] <= 0:
        raise HTTPException(
            status_code=402,
            detail=(f"GPU 쿼터를 모두 소진했습니다 "
                    f"({usage['gpu_minutes_used']}/{usage['gpu_minutes_quota']} GPU-min). "
                    f"플랜을 업그레이드하세요."),
        )

    result = simulate_run(algo=req.algo, robot=req.robot, dataset=req.dataset,
                          hyperparams=req.hyperparams)

    # Exact-cost guard: refuse a run that would push usage past the plan quota.
    run_minutes = round(result["gpu_seconds"] / 60.0, 1)
    if usage["gpu_minutes_used"] + run_minutes > usage["gpu_minutes_quota"]:
        raise HTTPException(
            status_code=402,
            detail=(f"이 작업은 약 {run_minutes} GPU-min을 사용해 쿼터를 초과합니다. "
                    f"남은 쿼터: {usage['gpu_minutes_remaining']} GPU-min. "
                    f"에포크를 줄이거나 플랜을 업그레이드하세요."),
        )

    name = req.name or f"{req.robot}-{req.algo.lower()}-{result['epochs']}ep"
    exp = store.create_experiment(
        name=name, algo=result["algo"], robot=result["robot"], dataset=result["dataset"],
        hyperparams=result["hyperparams"], success_rate=result["success_rate"],
        mean_reward=result["mean_reward"], final_loss=result["final_loss"],
        epochs=result["epochs"], gpu_seconds=result["gpu_seconds"], curve=result["curve"],
    )
    return exp


@router.get("/api/experiments")
async def list_runs():
    return store.list_experiments()


@router.get("/api/experiments/leaderboard")
async def get_leaderboard(robot: str | None = None, limit: int = 10):
    return store.leaderboard(robot=robot, limit=limit)


@router.get("/api/experiments/{exp_id}")
async def get_run(exp_id: str):
    exp = store.get(exp_id)
    if exp is None:
        raise HTTPException(status_code=404, detail=f"Experiment '{exp_id}' not found.")
    return exp


@router.delete("/api/experiments/{exp_id}")
async def delete_run(exp_id: str,
                     authorization: str | None = Header(default=None),
                     x_auth_token: str | None = Header(default=None)):
    """Delete a run from the tracker (login-gated). The marketplace policy of a
    promoted run, if any, is left untouched."""
    _require_user(authorization, x_auth_token)
    if not store.delete(exp_id):
        raise HTTPException(status_code=404, detail=f"Experiment '{exp_id}' not found.")
    return {"ok": True}


def _price_for(success_rate: float) -> int:
    """A simple value-based price: better policies cost more."""
    if success_rate >= 0.9:
        return 999
    if success_rate >= 0.8:
        return 699
    if success_rate >= 0.7:
        return 499
    return 299


@router.post("/api/experiments/{exp_id}/register")
async def register_model(exp_id: str,
                         authorization: str | None = Header(default=None),
                         x_auth_token: str | None = Header(default=None)):
    """Promote a run's checkpoint into the marketplace as a sellable policy.

    This is the Model #2 → Model #3 hand-off: it exports a real ONNX policy for
    the run's robot and writes a marketplace manifest carrying the run's own
    metrics + dataset lineage, so the policy appears for sale immediately.
    """
    _require_user(authorization, x_auth_token)
    exp = store.get(exp_id)
    if exp is None:
        raise HTTPException(status_code=404, detail=f"Experiment '{exp_id}' not found.")
    if exp.get("registered_policy_id"):
        existing = exp["registered_policy_id"]
        return {"policy_id": existing, "already": True,
                "download_url": f"/api/policies/{existing}/download"}

    robot = exp["robot"]
    obs_dim, action_dim = _DIMS.get(robot, (14, 7))

    # Export a structurally-valid ONNX policy for this robot.
    safe = re.sub(r"[^A-Za-z0-9_.-]", "", exp["name"]).strip("-") or exp["id"]
    policy_id = f"reg_{safe}_{exp['id'][-6:]}"
    out_path = _POLICY_DIR / f"{policy_id}.onnx"
    policy = MLPPolicy(obs_dim=obs_dim, action_dim=action_dim)
    PolicyExporter(policy, obs_dim=obs_dim).to_onnx(str(out_path))

    # Build a marketplace manifest from the experiment's real results + lineage.
    success = float(exp["success_rate"] or 0.0)
    price = _price_for(success)
    manifest = build_policy_manifest(out_path)
    manifest.update({
        "robot": robot,
        "robot_name": _ROBOT_NAMES.get(robot, robot.title()),
        "category": _CATEGORY.get(robot, "Other"),
        "task": exp["hyperparams"].get("task", "control"),
        "algo": exp["algo"],
        "trained_on": exp["dataset"],
        "metrics": {
            "success_rate": success,
            "mean_reward": exp["mean_reward"],
            "episodes_trained": exp["epochs"],
        },
        "tier": "paid" if price > 0 else "free",
        "price_usd": price,
        "license": "commercial-single-seat",
        "registered_from": exp["id"],
    })
    save_policy_manifest(out_path, manifest)
    store.set_registered_policy(exp_id, policy_id)

    return {"policy_id": policy_id, "already": False, "price_usd": price,
            "download_url": f"/api/policies/{policy_id}/download"}


@router.get("/api/mlops/usage")
async def get_usage():
    return store.usage_summary()


class PlanRequest(BaseModel):
    plan: str


@router.post("/api/mlops/plan")
async def set_plan(req: PlanRequest,
                   authorization: str | None = Header(default=None),
                   x_auth_token: str | None = Header(default=None)):
    _require_user(authorization, x_auth_token)
    try:
        plan = store.set_plan(req.plan)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return store.usage_summary() | {"plan": plan}
