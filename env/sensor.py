# env/sensor.py
import numpy as np


class SensorBundle:
    """Aggregates RGB-D, joint state, and EE pose into a single obs dict."""

    def __init__(self, width: int, height: int, num_joints: int):
        self.w = width
        self.h = height
        self.num_joints = num_joints

    def mock_read(self) -> dict:
        return {
            "rgb": np.zeros((self.h, self.w, 3), dtype=np.uint8),
            "depth": np.zeros((self.h, self.w, 1), dtype=np.float32),
            "joint_state": np.zeros(self.num_joints, dtype=np.float32),
            "ee_pose": np.zeros(7, dtype=np.float32),
        }

    def read(self, rgb_cam, depth_cam, robot_loader) -> dict:
        """Read from live Isaac Sim sensors — call after _init_isaac."""
        return {
            "rgb": rgb_cam.get_rgba()[:, :, :3],
            "depth": depth_cam.get_depth()[..., np.newaxis],
            "joint_state": robot_loader.get_joint_state(),
            "ee_pose": robot_loader.get_ee_pose(),
        }
