import numpy as np
import gymnasium as gym


class FlatObsEnv(gym.Env):
    """Gymnasium-compatible wrapper around IsaacEnv for SB3 MlpPolicy.

    Flattens dict observations to a 14-D vector (joint_state + ee_pose)
    and adapts the (obs, reward, done, info) 4-tuple API to the
    gymnasium (obs, reward, terminated, truncated, info) 5-tuple API.
    """

    OBS_DIM = 14  # joint_state(7) + ee_pose(7)

    def __init__(self, isaac_env):
        super().__init__()
        self._env = isaac_env
        action_dim = isaac_env.action_dim
        self.observation_space = gym.spaces.Box(
            low=-np.inf, high=np.inf, shape=(self.OBS_DIM,), dtype=np.float32
        )
        self.action_space = gym.spaces.Box(
            low=-1.0, high=1.0, shape=(action_dim,), dtype=np.float32
        )

    def reset(self, seed=None, options=None):
        obs_dict = self._env.reset()
        return self._flatten(obs_dict), {}

    def step(self, action):
        obs_dict, reward, done, info = self._env.step(action)
        terminated = bool(info.get("success", False))
        truncated = bool(done and not terminated)
        return self._flatten(obs_dict), float(reward), terminated, truncated, info

    def _flatten(self, obs_dict: dict) -> np.ndarray:
        return np.concatenate([
            obs_dict["joint_state"].astype(np.float32),
            obs_dict["ee_pose"].astype(np.float32),
        ])

    def close(self):
        self._env.close()
