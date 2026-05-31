import numpy as np
from trainer.rl.reward_shaper import RewardShaper
from trainer.rl.ppo_trainer import PPOTrainer


def test_reward_shaper_scale():
    shaper = RewardShaper(scale=2.0, clip=(-5.0, 5.0))
    assert shaper.shape(1.0) == 2.0
    assert shaper.shape(10.0) == 5.0
    assert shaper.shape(-10.0) == -5.0


def test_ppo_trainer_runs(tmp_path):
    import gymnasium as gym
    cfg = {
        "il_checkpoint": "",            # empty string = skip IL checkpoint loading
        "checkpoint_dir": str(tmp_path),
        "algorithm": "ppo",
        "total_timesteps": 500,
        "learning_rate": 3e-4,
        "n_steps": 64,
        "batch_size": 32,
        "n_epochs": 2,
        "gamma": 0.99,
    }
    trainer = PPOTrainer(cfg, env_id="CartPole-v1")
    trainer.train()
    import os
    assert os.path.exists(os.path.join(str(tmp_path), "best.zip"))
