# run.py
import argparse
import yaml


def load_cfg(path):
    with open(path) as f:
        return yaml.safe_load(f)


def stage_env(args):
    cfg = load_cfg("configs/env.yaml")
    if args.validate:
        cfg["mock_mode"] = True
    from env.isaac_env import IsaacEnv
    env = IsaacEnv(cfg)
    obs = env.reset()
    print("ENV OK - obs keys:", list(obs.keys()))
    env.close()


def stage_collect(args):
    env_cfg = load_cfg("configs/env.yaml")
    col_cfg = load_cfg("configs/collector.yaml")
    if args.mode:
        col_cfg["mode"] = args.mode
    if args.episodes:
        col_cfg["episodes"] = args.episodes

    from env.isaac_env import IsaacEnv
    env = IsaacEnv(env_cfg)
    action_dim = env.action_dim

    mode = col_cfg["mode"]
    if mode in ("teleop", "random"):
        from collector.dataset import EpisodeWriter
        import os
        import numpy as np
        if mode == "teleop":
            from collector.teleop import KeyboardTeleop
            controller = KeyboardTeleop(action_dim=action_dim)
        os.makedirs(col_cfg["save_dir"], exist_ok=True)
        existing = len([f for f in os.listdir(col_cfg["save_dir"]) if f.endswith(".hdf5")])
        for ep in range(col_cfg["episodes"]):
            path = os.path.join(col_cfg["save_dir"], f"episode_{existing+ep:04d}.hdf5")
            writer = EpisodeWriter(path)
            obs = env.reset()
            for _ in range(col_cfg["max_steps_per_episode"]):
                if mode == "teleop":
                    action = controller.get_action()
                else:
                    action = np.random.uniform(-1.0, 1.0, action_dim).astype(np.float32)
                next_obs, reward, done, info = env.step(action)
                writer.add_step(obs=obs, action=action, reward=reward, done=done)
                obs = next_obs
                if done:
                    break
            writer.close()
            print(f"Episode {ep+1}/{col_cfg['episodes']} saved: {path}")
    else:
        from collector.rollout import RolloutCollector
        import torch
        from trainer.il.policy import MLPPolicy
        obs_dim = 14
        policy = MLPPolicy(obs_dim=obs_dim, action_dim=action_dim)
        policy.load_state_dict(torch.load(col_cfg["checkpoint_path"], map_location="cpu"))
        collector = RolloutCollector(env=env, save_dir=col_cfg["save_dir"], action_dim=action_dim)
        collector.collect(policy=policy, n_episodes=col_cfg["episodes"],
                          max_steps=col_cfg["max_steps_per_episode"])
    env.close()


def stage_il(args):
    cfg = load_cfg("configs/il.yaml")
    from trainer.il.bc_trainer import BCTrainer
    trainer = BCTrainer(cfg)
    trainer.train()
    print("IL training done. Best checkpoint:", cfg["checkpoint_dir"] + "/best.pt")


def stage_rl(args):
    cfg = load_cfg("configs/rl.yaml")
    env_cfg = load_cfg("configs/env.yaml")
    from env.isaac_env import IsaacEnv
    from env.flat_obs_env import FlatObsEnv
    env = FlatObsEnv(IsaacEnv(env_cfg))
    algo = cfg.get("algorithm", "ppo")
    if algo == "ppo":
        from trainer.rl.ppo_trainer import PPOTrainer
        trainer = PPOTrainer(cfg, env=env)
    else:
        from trainer.rl.sac_trainer import SACTrainer
        trainer = SACTrainer(cfg, env=env)
    trainer.train()
    print("RL training done. Best checkpoint:", cfg["checkpoint_dir"] + "/best.zip")


def stage_export(args):
    exp_cfg = load_cfg("configs/export.yaml")
    env_cfg = load_cfg("configs/env.yaml")
    import torch
    from env.isaac_env import IsaacEnv
    from trainer.il.policy import MLPPolicy
    from export.policy_exporter import PolicyExporter
    from export.dataset_builder import DatasetBuilder

    env = IsaacEnv(env_cfg)
    obs_dim = 14
    action_dim = env.action_dim
    policy = MLPPolicy(obs_dim=obs_dim, action_dim=action_dim)

    from stable_baselines3 import PPO
    sb3_model = PPO.load(exp_cfg["rl_checkpoint"])
    sb3_state = sb3_model.policy.state_dict()
    policy_state = policy.state_dict()
    for k in policy_state:
        if k in sb3_state and sb3_state[k].shape == policy_state[k].shape:
            policy_state[k] = sb3_state[k]
    policy.load_state_dict(policy_state, strict=False)

    import os
    os.makedirs(exp_cfg["output_dir"], exist_ok=True)
    exporter = PolicyExporter(policy, obs_dim=obs_dim)
    policy_path = os.path.join(exp_cfg["output_dir"], "policy", exp_cfg["policy"]["filename"])
    exporter.to_onnx(policy_path)
    print("Policy exported:", policy_path)

    dataset_path = os.path.join(exp_cfg["output_dir"], "dataset", exp_cfg["dataset"]["filename"])
    print(f"[EXPORT] Building dataset: {exp_cfg['dataset']['render_rollouts']} rollouts × 200 steps", flush=True)
    builder = DatasetBuilder(env=env, policy=policy, output_path=dataset_path)
    builder.build(n_rollouts=exp_cfg["dataset"]["render_rollouts"], max_steps=200)
    print("Dataset exported:", dataset_path)
    env.close()


def main():
    parser = argparse.ArgumentParser(description="PhysicalAI Pipeline")
    sub = parser.add_subparsers(dest="stage")

    p_env = sub.add_parser("env")
    p_env.add_argument("--validate", action="store_true")

    p_col = sub.add_parser("collect")
    p_col.add_argument("--mode", choices=["teleop", "rollout", "random"])
    p_col.add_argument("--episodes", type=int)

    sub.add_parser("il")
    sub.add_parser("rl")
    sub.add_parser("export")

    args = parser.parse_args()
    dispatch = {
        "env": stage_env,
        "collect": stage_collect,
        "il": stage_il,
        "rl": stage_rl,
        "export": stage_export,
    }
    if args.stage not in dispatch:
        parser.print_help()
        return
    dispatch[args.stage](args)


if __name__ == "__main__":
    main()
