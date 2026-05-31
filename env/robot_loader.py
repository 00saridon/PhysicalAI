# env/robot_loader.py
import numpy as np


class RobotLoader:
    """Robot joint + base control interface (mock-safe)."""

    def __init__(self, num_joints: int, has_mobile_base: bool, base_dof: int):
        self.num_joints = num_joints
        self.has_mobile_base = has_mobile_base
        self.base_dof = base_dof if has_mobile_base else 0
        self.action_dim = num_joints + self.base_dof

    def apply_action(self, action: np.ndarray):
        """Send joint velocities + base velocity to robot."""
        assert action.shape == (self.action_dim,)
        joint_cmd = action[:self.num_joints]
        base_cmd = action[self.num_joints:] if self.has_mobile_base else None
        return joint_cmd, base_cmd

    def get_joint_state(self) -> np.ndarray:
        """Returns current joint positions (mock: zeros)."""
        return np.zeros(self.num_joints, dtype=np.float32)

    def get_ee_pose(self) -> np.ndarray:
        """Returns EE pose as [x, y, z, qx, qy, qz, qw] (mock: zeros)."""
        return np.zeros(7, dtype=np.float32)
