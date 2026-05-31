import torch
from trainer.il.policy import MLPPolicy


def test_mlp_policy_forward_shape():
    obs_dim = 14   # 7 joints + 7 ee_pose
    action_dim = 10
    policy = MLPPolicy(obs_dim=obs_dim, action_dim=action_dim, hidden_dim=64)
    obs = torch.zeros(8, obs_dim)   # batch_size=8
    action = policy(obs)
    assert action.shape == (8, action_dim)


def test_mlp_policy_save_load(tmp_path):
    policy = MLPPolicy(obs_dim=14, action_dim=10, hidden_dim=64)
    path = str(tmp_path / "policy.pt")
    torch.save(policy.state_dict(), path)
    policy2 = MLPPolicy(obs_dim=14, action_dim=10, hidden_dim=64)
    policy2.load_state_dict(torch.load(path, map_location="cpu"))
    obs = torch.zeros(1, 14)
    assert torch.allclose(policy(obs), policy2(obs))


import os
import numpy as np
import tempfile
from collector.dataset import EpisodeWriter
from trainer.il.dataloader import DemoDataset
from trainer.il.bc_trainer import BCTrainer

def _write_dummy_demo(path, n_steps=20, num_joints=7, action_dim=10):
    writer = EpisodeWriter(path)
    for _ in range(n_steps):
        obs = {
            "rgb": np.zeros((224, 224, 3), dtype=np.uint8),
            "depth": np.zeros((224, 224, 1), dtype=np.float32),
            "joint_state": np.random.randn(num_joints).astype(np.float32),
            "ee_pose": np.random.randn(7).astype(np.float32),
        }
        writer.add_step(obs=obs, action=np.random.randn(action_dim).astype(np.float32),
                        reward=0.0, done=False)
    writer.close()

def test_demo_dataset_len_and_item(tmp_path):
    ep = str(tmp_path / "ep_0000.hdf5")
    _write_dummy_demo(ep, n_steps=20)
    dataset = DemoDataset(str(tmp_path))
    assert len(dataset) == 20
    obs_vec, action = dataset[0]
    assert obs_vec.shape == (14,)   # 7 joints + 7 ee_pose
    assert action.shape == (10,)

def test_bc_trainer_runs_one_epoch(tmp_path):
    ep = str(tmp_path / "ep_0000.hdf5")
    _write_dummy_demo(ep, n_steps=30)

    cfg = {
        "demo_dir": str(tmp_path),
        "checkpoint_dir": str(tmp_path / "ckpt"),
        "batch_size": 8,
        "lr": 1e-3,
        "epochs": 1,
        "hidden_dim": 64,
        "save_every": 1,
    }
    trainer = BCTrainer(cfg)
    trainer.train()
    assert os.path.exists(os.path.join(cfg["checkpoint_dir"], "best.pt"))
