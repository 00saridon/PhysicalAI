import numpy as np


class IsaacEnv:
    """Gym-compatible Isaac Sim environment with mock mode for testing."""

    def __init__(self, config: dict):
        self.cfg = config
        self.mock = config.get("mock_mode", False)
        self.num_joints = config["robot"]["num_joints"]
        self.base_dof = config["robot"]["base_dof"] if config["robot"]["has_mobile_base"] else 0
        self.action_dim = self.num_joints + self.base_dof
        self.w = config["sensor"]["rgb"]["width"]
        self.h = config["sensor"]["rgb"]["height"]
        self._step_count = 0
        self._max_steps = 500

        if not self.mock:
            self._init_isaac()

    def _init_isaac(self):
        from omni.isaac.kit import SimulationApp
        self._app = SimulationApp({"headless": True})
        import omni.isaac.core.utils.stage as stage_utils
        stage_utils.create_new_stage()

    def reset(self) -> dict:
        self._step_count = 0
        if self.mock:
            return self._mock_obs()
        return self._isaac_obs()

    def step(self, action: np.ndarray):
        assert action.shape == (self.action_dim,), (
            f"Expected action shape ({self.action_dim},), got {action.shape}"
        )
        self._step_count += 1
        if self.mock:
            obs = self._mock_obs()
            reward = float(np.random.randn() * 0.1)
            done = self._step_count >= self._max_steps
            return obs, reward, done, {}
        return self._isaac_step(action)

    def _mock_obs(self) -> dict:
        t = self._step_count * 0.05
        rng = np.random.default_rng(self._step_count)

        # Joint state: sinusoidal trajectory + small noise (rad)
        phase = np.linspace(0, np.pi, self.num_joints)
        joint_state = (np.sin(t + phase) * 0.5 + rng.normal(0, 0.02, self.num_joints)).astype(np.float32)

        # EE pose: position (xyz) + quaternion (xyzw)
        pos = np.array([
            0.4 + 0.1 * np.sin(t),
            0.1 * np.cos(t * 0.7),
            0.3 + 0.05 * np.sin(t * 1.3),
        ], dtype=np.float32)
        quat = np.array([0.0, 0.0, np.sin(t * 0.1), np.cos(t * 0.1)], dtype=np.float32)
        ee_pose = np.concatenate([pos, quat])

        # RGB: gradient scene + noise to simulate non-trivial frames
        xx, yy = np.meshgrid(np.linspace(0, 1, self.w), np.linspace(0, 1, self.h))
        r = ((np.sin(t + xx * 3) * 0.5 + 0.5) * 80 + 20).astype(np.uint8)
        g = ((np.sin(t * 0.7 + yy * 2) * 0.5 + 0.5) * 60 + 10).astype(np.uint8)
        b = (np.ones_like(xx) * 30 + rng.integers(0, 15, (self.h, self.w))).astype(np.uint8)
        rgb = np.stack([r, g, b], axis=-1)

        depth = (np.ones((self.h, self.w, 1), dtype=np.float32) *
                 (0.5 + 0.1 * np.sin(t)))

        return {
            "rgb": rgb,
            "depth": depth,
            "joint_state": joint_state,
            "ee_pose": ee_pose,
        }

    def _isaac_obs(self) -> dict:
        raise NotImplementedError("Isaac Sim obs — implement after isaacsim install")

    def _isaac_step(self, action):
        raise NotImplementedError("Isaac Sim step — implement after isaacsim install")

    def close(self):
        if not self.mock and hasattr(self, "_app"):
            self._app.close()
