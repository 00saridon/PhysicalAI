import os
import torch
import torch.nn as nn
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import BaseCallback, CheckpointCallback
from trainer.weight_transfer import infer_hidden_dims, il_to_sb3_key_map, copy_weights
from pipeline_metrics import emit_metric


class LogCallback(BaseCallback):
    """Emits a structured RL metric (+ a human log line) every log_interval steps."""
    def __init__(self, log_interval: int = 2048):
        super().__init__()
        self.log_interval = log_interval

    def _on_step(self) -> bool:
        if self.n_calls % self.log_interval == 0:
            rew = self.locals.get("rewards")
            mean_rew = float(sum(rew) / len(rew)) if rew is not None else 0.0
            print(f"[RL] Step {self.num_timesteps} | rew={mean_rew:.4f}", flush=True)
            emit_metric(stage="rl", step=int(self.num_timesteps), rew_mean=round(mean_rew, 6))
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

        # If warm-starting from an IL checkpoint, size PPO's policy trunk to match
        # the IL MLP (hidden widths + ReLU) so the weights actually line up.
        il_path = cfg.get("il_checkpoint")
        self._il_state = None
        policy_kwargs: dict = {}
        if il_path and os.path.exists(il_path):
            self._il_state = torch.load(il_path, map_location="cpu")
            hidden = infer_hidden_dims(self._il_state)
            if hidden:
                policy_kwargs = dict(net_arch=dict(pi=hidden, vf=hidden), activation_fn=nn.ReLU)

        self.model = PPO(
            "MlpPolicy",
            self.env,
            learning_rate=cfg["learning_rate"],
            n_steps=cfg["n_steps"],
            batch_size=cfg["batch_size"],
            n_epochs=cfg["n_epochs"],
            gamma=cfg["gamma"],
            policy_kwargs=policy_kwargs,
            verbose=0,
        )
        if self._il_state is not None:
            self._load_il_weights()

    def _load_il_weights(self):
        import warnings
        sb3_state = self.model.policy.state_dict()
        key_map = il_to_sb3_key_map(self._il_state)
        transferred = copy_weights(self._il_state, sb3_state, key_map)
        if transferred == 0:
            warnings.warn(
                "IL checkpoint had no compatible layers with the RL policy. "
                "Check that obs_dim/action_dim and hidden_dim match between IL and RL.",
                UserWarning,
            )
            return
        self.model.policy.load_state_dict(sb3_state, strict=False)
        print(f"[RL] Warm-started PPO from IL checkpoint: "
              f"transferred {transferred} tensors across {len(key_map)} layers.", flush=True)

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
