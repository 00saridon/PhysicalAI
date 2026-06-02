"""Export a REAL Isaac Lab rollout to the dashboard's trajectory HDF5 schema.

Run this on a machine with Isaac Sim + Isaac Lab installed. It rolls out a
policy (or random actions) in an Isaac Lab task and records the robot's
`joint_state` (+ action / reward) into `outputs/dataset/<name>.hdf5`, which the
Simulation page loads as `dataDriven` data for the matching model.

Examples
--------
# ANYmal-D locomotion, random policy, 600 steps -> outputs/dataset/anymal_v1.hdf5
python scripts/export_isaaclab_dataset.py \
    --task Isaac-Velocity-Flat-Anymal-D-v0 --name anymal_v1 --steps 600

# Franka reach with a trained checkpoint
python scripts/export_isaaclab_dataset.py \
    --task Isaac-Reach-Franka-v0 --name synthetic_v1 --steps 400 \
    --checkpoint /path/to/policy.pt

Reference task IDs (see Isaac Lab docs; names vary by version)
--------------------------------------------------------------
  arm        Franka      Isaac-Reach-Franka-v0 / Isaac-Lift-Cube-Franka-v0
  anymal_v1  ANYmal-D    Isaac-Velocity-Flat-Anymal-D-v0 / -Rough-
  spot_v1    Spot        Isaac-Velocity-Flat-Spot-v0
  h1_v1      H1          Isaac-Velocity-Rough-H1-v0 / -Flat-
  g1_v1      G1          Isaac-Velocity-Rough-G1-v0 / -Flat-
  crazyflie_v1 Crazyflie Isaac-Quadcopter-Direct-v0

The dashboard rigs expect a specific joint column order
(quadruped: hips[0..3], knees[4..7]; humanoid: legL,legR,armL,armR = 0..3).
Pass --reorder "1,4,7,10,2,5,8,11,0,3,6,9" to remap raw Isaac Lab joint order,
or adjust the mapping in dashboard/src/sim/models.tsx instead. Inspect the raw
order with `env.scene["robot"].joint_names`.
"""
import argparse
import os


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--task", required=True, help="Isaac Lab gym task id")
    ap.add_argument("--name", required=True, help="output dataset name -> outputs/dataset/<name>.hdf5")
    ap.add_argument("--steps", type=int, default=600)
    ap.add_argument("--checkpoint", default=None, help="optional policy .pt (else random actions)")
    ap.add_argument("--reorder", default=None, help="comma-separated joint index remap")
    ap.add_argument("--headless", action="store_true", default=True)
    args = ap.parse_args()

    # Isaac Lab boots an Omniverse app first; import only inside main so the
    # script can be inspected without Isaac installed.
    try:
        from isaaclab.app import AppLauncher  # Isaac Lab >= 2.0
    except ImportError:
        try:
            from omni.isaac.lab.app import AppLauncher  # older layout
        except ImportError as e:
            raise SystemExit(
                "Isaac Lab not found. Run this on an Isaac Sim + Isaac Lab install.\n"
                f"(import error: {e})"
            )

    app_launcher = AppLauncher(headless=args.headless)
    simulation_app = app_launcher.app

    import gymnasium as gym
    import numpy as np
    import torch
    import h5py

    try:
        import isaaclab_tasks  # noqa: F401  (registers the gym tasks)
        from isaaclab_tasks.utils import parse_env_cfg
    except ImportError:
        import omni.isaac.lab_tasks  # noqa: F401
        from omni.isaac.lab_tasks.utils import parse_env_cfg

    env_cfg = parse_env_cfg(args.task, num_envs=1)
    env = gym.make(args.task, cfg=env_cfg)

    policy = None
    if args.checkpoint:
        policy = torch.jit.load(args.checkpoint) if args.checkpoint.endswith(".jit") \
            else torch.load(args.checkpoint, map_location="cpu")

    reorder = [int(x) for x in args.reorder.split(",")] if args.reorder else None

    obs, _ = env.reset()
    js, act, rew = [], [], []
    for _ in range(args.steps):
        with torch.inference_mode():
            if policy is not None:
                a = policy(obs["policy"] if isinstance(obs, dict) else obs)
            else:
                a = torch.from_numpy(env.action_space.sample()).to(env.unwrapped.device)
        obs, r, term, trunc, _ = env.step(a)
        q = env.unwrapped.scene["robot"].data.joint_pos[0].detach().cpu().numpy()
        if reorder:
            q = q[reorder]
        js.append(q.astype(np.float32))
        act.append(np.asarray(a[0].detach().cpu().numpy(), np.float32))
        rew.append(float(r[0]))

    os.makedirs("outputs/dataset", exist_ok=True)
    path = f"outputs/dataset/{args.name}.hdf5"
    with h5py.File(path, "w") as f:
        f.create_dataset("joint_state", data=np.asarray(js, np.float32))
        f.create_dataset("action", data=np.asarray(act, np.float32))
        f.create_dataset("reward", data=np.asarray(rew, np.float32))
    print(f"[export] wrote {path}: joint_state{np.asarray(js).shape} from task {args.task}")

    env.close()
    simulation_app.close()


if __name__ == "__main__":
    main()
