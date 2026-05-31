import numpy as np
import h5py
from typing import Dict


class EpisodeWriter:
    """Writes a single episode to HDF5 incrementally."""

    def __init__(self, path: str):
        self._f = h5py.File(path, "w")
        self._obs_bufs: Dict[str, list] = {}
        self._action_buf = []
        self._reward_buf = []
        self._done_buf = []

    def add_step(self, obs: dict, action: np.ndarray, reward: float, done: bool):
        for k, v in obs.items():
            self._obs_bufs.setdefault(k, []).append(v)
        self._action_buf.append(action)
        self._reward_buf.append(reward)
        self._done_buf.append(done)

    def close(self):
        try:
            obs_grp = self._f.create_group("obs")
            for k, buf in self._obs_bufs.items():
                obs_grp.create_dataset(k, data=np.stack(buf))
            self._f.create_dataset("action", data=np.stack(self._action_buf))
            self._f.create_dataset("reward", data=np.array(self._reward_buf, dtype=np.float32))
            self._f.create_dataset("done", data=np.array(self._done_buf, dtype=bool))
        finally:
            self._f.close()


class EpisodeReader:
    """Reads a single HDF5 episode into numpy arrays."""

    def __init__(self, path: str):
        self._f = h5py.File(path, "r")

    def load(self) -> dict:
        obs = {k: self._f["obs"][k][()] for k in self._f["obs"]}
        return {
            "obs": obs,
            "action": self._f["action"][()],
            "reward": self._f["reward"][()],
            "done": self._f["done"][()],
        }

    def close(self):
        self._f.close()
