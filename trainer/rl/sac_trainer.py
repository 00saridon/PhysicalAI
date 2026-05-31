import os
from stable_baselines3 import SAC
from stable_baselines3.common.callbacks import CheckpointCallback


class SACTrainer:
    """SAC finetuner — higher sample efficiency than PPO for continuous actions."""

    def __init__(self, cfg: dict, env_id: str = None, env=None):
        self.cfg = cfg
        os.makedirs(cfg["checkpoint_dir"], exist_ok=True)
        if env is not None:
            self.env = env
        else:
            import gymnasium as gym
            self.env = gym.make(env_id)

        self.model = SAC(
            "MlpPolicy",
            self.env,
            learning_rate=cfg["learning_rate"],
            batch_size=cfg["batch_size"],
            gamma=cfg["gamma"],
            verbose=0,
        )

    def train(self):
        checkpoint_cb = CheckpointCallback(
            save_freq=max(self.cfg["total_timesteps"] // 10, 1),
            save_path=self.cfg["checkpoint_dir"],
            name_prefix="sac",
        )
        self.model.learn(
            total_timesteps=self.cfg["total_timesteps"],
            callback=checkpoint_cb,
        )
        self.model.save(os.path.join(self.cfg["checkpoint_dir"], "best"))
