# Committed trajectory datasets (real Isaac Lab rollouts)

Drop **real** Isaac Lab rollout HDF5 files here to replace the representative
demo data on the live (Railway) deploy.

- File name = the model's `dataset` (see `dashboard/src/sim/models.tsx`):
  `synthetic_v1.hdf5`, `anymal_v1.hdf5`, `spot_v1.hdf5`, `h1_v1.hdf5`,
  `g1_v1.hdf5`, `crazyflie_v1.hdf5`.
- Schema: `joint_state[T, DOF]` (required), optional `action[T, A]`, `reward[T]`,
  `rgb[T, H, W, 3]` uint8. Column order must match the rig
  (quadruped: hips 0..3 / knees 4..7; humanoid: legL,legR,armL,armR = 0..3).
- Generate with `scripts/export_isaaclab_dataset.py` on an Isaac Sim + Isaac Lab
  machine (see [docs/ISAACLAB-ASSETS.md](../../docs/ISAACLAB-ASSETS.md)).

**Keep these small** (a few hundred frames; downsample / skip `rgb`) — they ship
inside the container image. Files here override the build-time seed; locally,
drop the same files into `outputs/dataset/`.
