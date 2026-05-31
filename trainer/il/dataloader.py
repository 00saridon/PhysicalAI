import os
import numpy as np
import torch
from torch.utils.data import Dataset
from collector.dataset import EpisodeReader


class DemoDataset(Dataset):
    """Loads all HDF5 episodes from a directory into (obs_vec, action) pairs."""

    def __init__(self, demo_dir: str):
        self._obs = []
        self._actions = []
        for fname in sorted(os.listdir(demo_dir)):
            if not fname.endswith(".hdf5"):
                continue
            reader = EpisodeReader(os.path.join(demo_dir, fname))
            data = reader.load()
            reader.close()
            js = data["obs"]["joint_state"]        # (T, 7)
            ee = data["obs"]["ee_pose"]            # (T, 7)
            obs_vec = np.concatenate([js, ee], axis=1)   # (T, 14)
            self._obs.append(obs_vec)
            self._actions.append(data["action"])   # (T, action_dim)
        self._obs = np.concatenate(self._obs, axis=0).astype(np.float32)
        self._actions = np.concatenate(self._actions, axis=0).astype(np.float32)

    def __len__(self):
        return len(self._obs)

    def __getitem__(self, idx):
        return torch.from_numpy(self._obs[idx]), torch.from_numpy(self._actions[idx])
