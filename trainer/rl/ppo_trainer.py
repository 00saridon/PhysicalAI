import os
import torch
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback, CheckpointCallback
from trainer.il.policy import MLPPolicy


class LogCallback(BaseCallback):
    """Prints [RL] Step X | rew=Y every log_interval steps for Live Log parsing."""
    def __init__(self, log_interval: int = 2048):
        super().__init__()
        self.log_interval = log_interval

    def _on_step(self) -> bool:
        if self.n_calls % self.log_interval == 0:
            rew = self.locals.get("rewards")
            mean_rew = float(sum(rew) / len(rew)) if rew is not None else 0.0
            print(f"[RL] Step {self.num_timesteps} | rew={mean_rew:.4f}", flush=True)
        return True


class PPOTrainer:
    """PPO finetuner that optionally loads IL weights as initialization."""

    def __init__(self, cfg: dict, env_id: str = None, env=None):
        self.cfg = cfg
        os.makedirs(cfg["checkpoint_dir"], exist_ok=True)
        if env is not None:
            self.env = env
        else:
            import gymnasium as gym
            self.env = gym.make(env_id)

        self.model = PPO(
            "MlpPolicy",
            self.env,
            learning_rate=cfg["learning_rate"],
            n_steps=cfg["n_steps"],
            batch_size=cfg["batch_size"],
            n_epochs=cfg["n_epochs"],
            gamma=cfg["gamma"],
            verbose=0,
        )
        if cfg.get("il_checkpoint"):
            self._load_il_weights(cfg["il_checkpoint"])

    def _load_il_weights(self, path: str):
        import warnings
        obs_dim = self.env.observation_space.shape[0]
        action_dim = self.env.action_space.shape[0]
        il_policy = MLPPolicy(obs_dim=obs_dim, action_dim=action_dim)
        il_policy.load_state_dict(torch.load(path, map_location="cpu"))
        sb3_state = self.model.policy.state_dict()
        il_state = il_policy.state_dict()
        transferred = 0
        for k in il_state:
            if k in sb3_state and sb3_state[k].shape == il_state[k].shape:
                sb3_state[k] = il_state[k]
                transferred += 1
        if transferred == 0:
            warnings.warn(
                f"IL checkpoint '{path}' had no compatible layers with the RL policy. "
                "Check that obs_dim and action_dim match between IL and RL environments.",
                UserWarning,
            )
        self.model.policy.load_state_dict(sb3_state, strict=False)

    def train(self):
        checkpoint_cb = CheckpointCallback(
            save_freq=max(self.cfg["total_timesteps"] // 10, 1),
            save_path=self.cfg["checkpoint_dir"],
            name_prefix="rl",
        )
        log_cb = LogCallback(log_interval=self.cfg.get("n_steps", 2048))
        self.model.learn(
            total_timesteps=self.cfg["total_timesteps"],
            callback=[checkpoint_cb, log_cb],
        )
        self.model.save(os.path.join(self.cfg["checkpoint_dir"], "best"))
        print(f"RL training done. Best checkpoint: {self.cfg['checkpoint_dir']}/best.zip", flush=True)
