"""Seed a small but valid synthetic_v1.hdf5 for cloud (Railway) demos.

The dashboard's Simulation/dataset endpoints parse this HDF5, so the cloud
image needs a real file (not a placeholder). Generated with numpy + h5py only
(both in requirements-railway.txt); RGB is kept at 96x96 to stay lightweight.
"""
import os

import numpy as np
import h5py

N = 300
H = W = 96
JOINTS = 7

os.makedirs("outputs/dataset", exist_ok=True)
rng = np.random.default_rng(0)

t = np.arange(N) * 0.05
phase = np.linspace(0, np.pi, JOINTS)
joints = (np.sin(t[:, None] + phase[None, :]) * 0.5 + rng.normal(0, 0.02, (N, JOINTS))).astype(np.float32)
actions = np.clip(np.cos(t[:, None] * 0.8 + phase[None, :]) * 0.6 + rng.normal(0, 0.05, (N, JOINTS)), -1, 1).astype(np.float32)
rewards = (np.sin(t) * 0.2 + rng.normal(0, 0.05, N)).astype(np.float32)

xx, yy = np.meshgrid(np.linspace(0, 1, W), np.linspace(0, 1, H))
rgb = np.empty((N, H, W, 3), np.uint8)
for i in range(N):
    tt = t[i]
    r = ((np.sin(tt + xx * 3) * 0.5 + 0.5) * 80 + 20).astype(np.uint8)
    g = ((np.sin(tt * 0.7 + yy * 2) * 0.5 + 0.5) * 60 + 10).astype(np.uint8)
    b = (np.ones_like(xx) * 30 + rng.integers(0, 15, (H, W))).astype(np.uint8)
    rgb[i] = np.stack([r, g, b], axis=-1)

with h5py.File("outputs/dataset/synthetic_v1.hdf5", "w") as f:
    f.create_dataset("joint_state", data=joints)
    f.create_dataset("action", data=actions)
    f.create_dataset("reward", data=rewards)
    f.create_dataset("rgb", data=rgb)

print(f"[seed] synthetic_v1.hdf5: joints{joints.shape} actions{actions.shape} rgb{rgb.shape}")
