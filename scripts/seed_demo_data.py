"""Seed small, valid trajectory datasets for the dashboard (Railway/local demos).

The Simulation/dataset endpoints parse these HDF5 files, so the cloud image
needs real files (not placeholders). Each robot model loads its own dataset by
name (outputs/dataset/<name>.hdf5). Files are written only if missing, so a real
EXPORT-produced synthetic_v1.hdf5 is never overwritten.

Joint layouts are generated to match each rig's joints[i] -> DOF mapping in
dashboard/src/sim/models.tsx (hips 0..3 / knees 4..7 for quadrupeds; legL/legR/
armL/armR = 0..3 for humanoids).
"""
import os

import numpy as np
import h5py

DIR = "outputs/dataset"
os.makedirs(DIR, exist_ok=True)
N = 300
rng = np.random.default_rng(0)
t = np.arange(N) * 0.05


def write(name, joints, actions=None, rewards=None, rgb=None):
    path = os.path.join(DIR, f"{name}.hdf5")
    if os.path.exists(path):
        print(f"[seed] skip {name} (exists)")
        return
    if actions is None:
        actions = np.clip(joints * 0.5 + rng.normal(0, 0.03, joints.shape), -1, 1)
    if rewards is None:
        rewards = (np.sin(t) * 0.2 + rng.normal(0, 0.05, len(joints)))
    with h5py.File(path, "w") as f:
        f.create_dataset("joint_state", data=joints.astype(np.float32))
        f.create_dataset("action", data=actions.astype(np.float32))
        f.create_dataset("reward", data=rewards.astype(np.float32))
        if rgb is not None:
            f.create_dataset("rgb", data=rgb.astype(np.uint8))
    print(f"[seed] wrote {name}: joints{joints.shape}" + (f" rgb{rgb.shape}" if rgb is not None else ""))


def gen_arm():
    phase = np.linspace(0, np.pi, 7)
    joints = np.sin(t[:, None] + phase[None, :]) * 0.5 + rng.normal(0, 0.02, (N, 7))
    H = W = 96
    xx, yy = np.meshgrid(np.linspace(0, 1, W), np.linspace(0, 1, H))
    rgb = np.empty((N, H, W, 3), np.uint8)
    for i in range(N):
        tt = t[i]
        r = ((np.sin(tt + xx * 3) * 0.5 + 0.5) * 80 + 20).astype(np.uint8)
        g = ((np.sin(tt * 0.7 + yy * 2) * 0.5 + 0.5) * 60 + 10).astype(np.uint8)
        b = (np.ones_like(xx) * 30 + rng.integers(0, 15, (H, W))).astype(np.uint8)
        rgb[i] = np.stack([r, g, b], -1)
    return joints, rgb


def gen_quadruped():
    # diagonal trot: legs [LF, RF, LH, RH] -> phases [0, pi, pi, 0]
    ph = np.array([0, np.pi, np.pi, 0])
    j = np.zeros((N, 12), np.float32)
    for k in range(4):
        j[:, k] = np.sin(t + ph[k]) * 0.35                              # hip (0..3)
        j[:, 4 + k] = np.maximum(0, np.sin(t + ph[k] + 0.6)) * 0.5      # knee (4..7)
        j[:, 8 + k] = rng.normal(0, 0.01, N)                           # HAA (8..11)
    return j


def gen_humanoid(dof=23):
    j = np.zeros((N, dof), np.float32)
    j[:, 0] = np.sin(t) * 0.5                  # legL
    j[:, 1] = np.sin(t + np.pi) * 0.5          # legR
    j[:, 2] = np.sin(t + np.pi) * 0.45         # armL
    j[:, 3] = np.sin(t) * 0.45                 # armR
    if dof > 4:
        j[:, 4:] = rng.normal(0, 0.02, (N, dof - 4))
    return j


def gen_quadcopter():
    # joints[0]/[1] = body tilt (pitch/roll); rotors always spin in the rig
    j = np.zeros((N, 4), np.float32)
    j[:, 0] = np.sin(t * 1.2) * 0.06
    j[:, 1] = np.sin(t * 0.9 + 1.0) * 0.06
    j[:, 2:] = rng.normal(0, 0.01, (N, 2))
    return j


arm_joints, arm_rgb = gen_arm()
write("synthetic_v1", arm_joints, rgb=arm_rgb)
write("anymal_v1", gen_quadruped())
write("spot_v1", gen_quadruped())
write("g1_v1", gen_humanoid(23))
write("h1_v1", gen_humanoid(19))
write("crazyflie_v1", gen_quadcopter())
print("[seed] done")
