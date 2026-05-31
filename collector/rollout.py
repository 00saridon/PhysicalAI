# collector/rollout.py
import os
import numpy as np
from collector.dataset import EpisodeWriter


class RolloutCollector:
    """Collects episodes by rolling out a policy in the environment."""

    def __init__(self, env, save_dir: str, action_dim: int):
        self.env = env
        self.save_dir = save_dir
        self.action_dim = action_dim
        os.makedirs(save_dir, exist_ok=True)

    def _obs_to_vec(self, obs: dict) -> np.ndarray:
        return np.concatenate([
            obs["joint_state"],
            obs["ee_pose"],
        ])

    def collect(self, policy, n_episodes: int, max_steps: int):
        existing = len(os.listdir(self.save_dir))
        for ep in range(n_episodes):
            idx = existing + ep
            path = os.path.join(self.save_dir, f"episode_{idx:04d}.hdf5")
            writer = EpisodeWriter(path)
            obs = self.env.reset()
            for _ in range(max_steps):
                obs_vec = self._obs_to_vec(obs)
                action, _ = policy.predict(obs_vec)
                next_obs, reward, done, info = self.env.step(action)
                writer.add_step(obs=obs, action=action, reward=reward, done=done)
                obs = next_obs
                if done:
                    break
            writer.close()
