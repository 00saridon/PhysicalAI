# collector/teleop.py
import numpy as np


class KeyboardTeleop:
    """Keyboard-based teleoperation. Returns zero action in non-interactive mode."""

    KEY_MAP = {
        "w": (0, 0.1),   # joint 0 +
        "s": (0, -0.1),  # joint 0 -
        "e": (1, 0.1),
        "d": (1, -0.1),
    }

    def __init__(self, action_dim: int):
        self.action_dim = action_dim

    def get_action(self, key: str = "") -> np.ndarray:
        action = np.zeros(self.action_dim, dtype=np.float32)
        if key in self.KEY_MAP:
            idx, val = self.KEY_MAP[key]
            if idx < self.action_dim:
                action[idx] = val
        return action
