"""Mock training runner — simulate a training job for the MLOps SaaS (Model #2).

Real training re-runs the IL/RL pipeline on a GPU. This module ships a
**deterministic simulator** that, given an algorithm + robot + hyperparameters,
produces a believable learning curve, final metrics, and a metered GPU-time —
no GPU, runs in milliseconds — so the full submit→track→leaderboard→register
loop is usable on the mock backend. Swap `simulate_run` for a real job launch
to go live; everything downstream (the store, the registry, billing) is unchanged.

Determinism: the same (algo, robot, dataset, hyperparams) always yields the same
result, so the leaderboard is stable and re-submitting a config is reproducible.
"""
from __future__ import annotations

import hashlib
from typing import Any

import numpy as np

# Per-algorithm baseline behaviour: an asymptotic ceiling the success rate
# approaches, how fast it converges, and the relative GPU cost per epoch/step.
_ALGO_PROFILE: dict[str, dict[str, float]] = {
    "BC":  {"ceiling": 0.90, "speed": 0.045, "reward_scale": 20.0, "gpu_per_epoch": 0.9},
    "PPO": {"ceiling": 0.94, "speed": 0.030, "reward_scale": 28.0, "gpu_per_epoch": 1.6},
    "SAC": {"ceiling": 0.86, "speed": 0.022, "reward_scale": 24.0, "gpu_per_epoch": 2.1},
}

# Task difficulty per robot category nudges the achievable ceiling.
_ROBOT_DIFFICULTY: dict[str, float] = {
    "franka": 1.00, "crazyflie": 1.05, "anymal": 0.96,
    "spot": 0.95, "h1": 0.88, "g1": 0.86,
}


def _seed(algo: str, robot: str, dataset: str | None, hp: dict[str, Any]) -> int:
    raw = f"{algo}|{robot}|{dataset}|{sorted(hp.items())}"
    return int(hashlib.md5(raw.encode()).hexdigest()[:8], 16)


def simulate_run(*, algo: str, robot: str, dataset: str | None,
                 hyperparams: dict[str, Any]) -> dict[str, Any]:
    """Produce metrics + a learning curve + GPU-time for one training config.

    Returns a dict ready to hand to experiments_store.create_experiment.
    """
    algo = (algo or "BC").upper()
    profile = _ALGO_PROFILE.get(algo, _ALGO_PROFILE["BC"])
    difficulty = _ROBOT_DIFFICULTY.get(robot, 0.92)

    epochs = int(hyperparams.get("epochs") or hyperparams.get("n_epochs") or 100)
    epochs = max(5, min(epochs, 1000))
    lr = float(hyperparams.get("lr") or hyperparams.get("learning_rate") or 1e-4)

    rng = np.random.default_rng(_seed(algo, robot, dataset, hyperparams))

    # A good LR (~1e-4..3e-4) helps; far from it hurts the ceiling slightly.
    lr_penalty = min(0.12, abs(np.log10(lr) - np.log10(2e-4)) * 0.06)
    ceiling = float(np.clip(profile["ceiling"] * difficulty - lr_penalty, 0.4, 0.98))

    # Learning curve: exponential approach to the ceiling + small noise.
    curve: list[dict[str, Any]] = []
    success = 0.0
    loss = 1.0
    for e in range(1, epochs + 1):
        success = ceiling * (1.0 - np.exp(-profile["speed"] * e))
        success_n = float(np.clip(success + rng.normal(0, 0.01), 0.0, 0.99))
        loss = float(max(0.02, np.exp(-profile["speed"] * e * 1.2) + rng.normal(0, 0.01)))
        if e % max(1, epochs // 20) == 0 or e == epochs:
            curve.append({"epoch": e, "success_rate": round(success_n, 3),
                          "loss": round(loss, 4)})

    final_success = float(np.clip(success + rng.normal(0, 0.005), 0.0, 0.99))
    mean_reward = round(final_success * profile["reward_scale"] + rng.normal(0, 0.5), 2)
    gpu_seconds = round(epochs * profile["gpu_per_epoch"] * (0.8 + 0.4 * difficulty), 1)

    return {
        "algo": algo,
        "robot": robot,
        "dataset": dataset,
        "hyperparams": hyperparams,
        "epochs": epochs,
        "success_rate": round(final_success, 3),
        "mean_reward": mean_reward,
        "final_loss": round(loss, 4),
        "gpu_seconds": gpu_seconds,
        "curve": curve,
    }
