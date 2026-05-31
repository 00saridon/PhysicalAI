import os
import numpy as np
import h5py


class DatasetBuilder:
    """Rolls out a policy, captures rendered frames, and saves to HDF5."""

    def __init__(self, env, policy, output_path: str, exploration_noise: float = 0.15):
        self.env = env
        self.policy = policy
        self.output_path = output_path
        self.exploration_noise = exploration_noise
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    def build(self, n_rollouts: int, max_steps: int):
        """Generate rollouts using the policy and save to HDF5."""
        all_rgb = []
        all_joints = []
        all_actions = []
        all_rewards = []

        rng = np.random.default_rng(42)
        total_steps = 0

        for rollout_idx in range(n_rollouts):
            obs = self.env.reset()
            for step in range(max_steps):
                obs_vec = np.concatenate([obs["joint_state"], obs["ee_pose"]])
                action, _ = self.policy.predict(obs_vec)
                # Add exploration noise so actions vary meaningfully across rollouts
                noise = rng.normal(0, self.exploration_noise, action.shape).astype(np.float32)
                action = np.clip(action + noise, -1.0, 1.0).astype(np.float32)

                all_rgb.append(obs["rgb"])
                all_joints.append(obs["joint_state"])
                all_actions.append(action)
                obs, reward, done, _ = self.env.step(action)
                all_rewards.append(reward)
                total_steps += 1
                if done:
                    break

            pct = (rollout_idx + 1) / n_rollouts * 100
            print(f"[EXPORT] Rollout {rollout_idx+1}/{n_rollouts} ({pct:.0f}%) | {total_steps} steps total", flush=True)

        with h5py.File(self.output_path, "w") as f:
            f.create_dataset("rgb", data=np.stack(all_rgb))
            f.create_dataset("joint_state", data=np.stack(all_joints).astype(np.float32))
            f.create_dataset("action", data=np.stack(all_actions).astype(np.float32))
            f.create_dataset("reward", data=np.array(all_rewards, dtype=np.float32))
        print(f"[EXPORT] Saved {total_steps} frames → {self.output_path}", flush=True)
