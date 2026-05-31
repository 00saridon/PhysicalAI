import numpy as np
import yaml
from env.isaac_env import IsaacEnv


def load_config():
    with open("configs/env.yaml") as f:
        cfg = yaml.safe_load(f)
    cfg["mock_mode"] = True
    return cfg


def test_reset_returns_obs_dict():
    env = IsaacEnv(load_config())
    obs = env.reset()
    assert isinstance(obs, dict)
    assert "rgb" in obs
    assert "depth" in obs
    assert "joint_state" in obs
    assert "ee_pose" in obs


def test_step_returns_tuple():
    env = IsaacEnv(load_config())
    env.reset()
    num_joints = 7
    base_dof = 3
    action = np.zeros(num_joints + base_dof)
    obs, reward, done, info = env.step(action)
    assert isinstance(obs, dict)
    assert isinstance(reward, float)
    assert isinstance(done, bool)
    assert isinstance(info, dict)


def test_obs_shapes():
    env = IsaacEnv(load_config())
    obs = env.reset()
    assert obs["rgb"].shape == (224, 224, 3)
    assert obs["depth"].shape == (224, 224, 1)
    assert obs["joint_state"].shape == (7,)
    assert obs["ee_pose"].shape == (7,)


from env.robot_loader import RobotLoader
from env.sensor import SensorBundle


def test_robot_loader_action_dim():
    loader = RobotLoader(num_joints=7, has_mobile_base=True, base_dof=3)
    assert loader.action_dim == 10


def test_sensor_bundle_obs_keys():
    bundle = SensorBundle(width=224, height=224, num_joints=7)
    obs = bundle.mock_read()
    assert set(obs.keys()) == {"rgb", "depth", "joint_state", "ee_pose"}


from env.task_registry import TaskRegistry


def test_task_registry_register_and_call():
    registry = TaskRegistry()

    def my_reward(obs, action, info):
        return 1.0

    def my_success(obs, info):
        return True

    registry.register("pick_and_place", reward_fn=my_reward, success_fn=my_success)
    obs = {"rgb": None, "depth": None, "joint_state": None, "ee_pose": None}
    assert registry.compute_reward("pick_and_place", obs, None, {}) == 1.0
    assert registry.is_success("pick_and_place", obs, {}) is True


def test_task_registry_unknown_task_raises():
    registry = TaskRegistry()
    try:
        registry.compute_reward("unknown", {}, None, {})
        assert False, "Should have raised"
    except KeyError:
        pass
