# env/task_registry.py
from typing import Callable, Dict


class TaskRegistry:
    """Maps task names to reward and success functions."""

    def __init__(self):
        self._tasks: Dict[str, dict] = {}

    def register(self, name: str, reward_fn: Callable, success_fn: Callable):
        self._tasks[name] = {"reward": reward_fn, "success": success_fn}

    def compute_reward(self, name: str, obs: dict, action, info: dict) -> float:
        return self._tasks[name]["reward"](obs, action, info)

    def is_success(self, name: str, obs: dict, info: dict) -> bool:
        return self._tasks[name]["success"](obs, info)
