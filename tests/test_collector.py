import numpy as np
import os
import tempfile
from collector.dataset import EpisodeWriter, EpisodeReader


def make_obs():
    return {
        "rgb": np.zeros((224, 224, 3), dtype=np.uint8),
        "depth": np.zeros((224, 224, 1), dtype=np.float32),
        "joint_state": np.zeros(7, dtype=np.float32),
        "ee_pose": np.zeros(7, dtype=np.float32),
    }


def test_write_and_read_episode():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "ep_001.hdf5")
        writer = EpisodeWriter(path)
        for i in range(5):
            obs = make_obs()
            obs["joint_state"][0] = float(i)
            writer.add_step(obs=obs, action=np.ones(10), reward=float(i), done=(i == 4))
        writer.close()

        reader = EpisodeReader(path)
        data = reader.load()
        assert data["obs"]["joint_state"].shape == (5, 7)
        assert data["action"].shape == (5, 10)
        assert data["reward"].shape == (5,)
        assert data["obs"]["joint_state"][3, 0] == 3.0
        reader.close()


def test_writer_creates_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "ep_002.hdf5")
        writer = EpisodeWriter(path)
        writer.add_step(obs=make_obs(), action=np.zeros(10), reward=0.0, done=True)
        writer.close()
        assert os.path.exists(path)


from collector.teleop import KeyboardTeleop
from collector.rollout import RolloutCollector


def test_keyboard_teleop_action_shape():
    teleop = KeyboardTeleop(action_dim=10)
    action = teleop.get_action()
    assert action.shape == (10,)


def test_rollout_collector_runs(tmp_path):
    import yaml
    from env.isaac_env import IsaacEnv

    cfg_env = yaml.safe_load(open("configs/env.yaml"))
    cfg_env["mock_mode"] = True
    env = IsaacEnv(cfg_env)

    collector = RolloutCollector(env=env, save_dir=str(tmp_path), action_dim=10)

    class DummyPolicy:
        def predict(self, obs_vec):
            return np.zeros(10), None

    collector.collect(policy=DummyPolicy(), n_episodes=2, max_steps=5)
    import os
    files = os.listdir(tmp_path)
    assert len(files) == 2
