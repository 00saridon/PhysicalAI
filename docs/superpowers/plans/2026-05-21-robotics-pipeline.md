# Robotics Learning Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isaac Sim / Omniverse 기반 Modular Stage Pipeline 구축 — 텔레오퍼레이션 데모 수집 → BC 학습 → PPO 파인튜닝 → ONNX 정책 + HDF5 합성 데이터셋 내보내기.

**Architecture:** 5개 독립 모듈(env, collector, trainer/il, trainer/rl, export)이 YAML config와 HDF5 파일로 연결된다. 각 모듈은 `run.py --stage <name>`으로 독립 실행 가능하다. Isaac Sim 없이도 mock 모드로 unit test가 동작한다.

**Tech Stack:** Python 3.10+, Isaac Sim (pip), ovrtx, PyTorch, stable-baselines3, gymnasium, h5py, onnx, pyyaml, numpy

---

## File Map

| 파일 | 역할 |
|------|------|
| `requirements.txt` | 의존성 목록 |
| `.gitignore` | demos/, checkpoints/, outputs/ 제외 |
| `configs/env.yaml` | 씬, 로봇, 센서 설정 |
| `configs/collector.yaml` | 수집 에피소드 수, 저장 경로 |
| `configs/il.yaml` | BC 하이퍼파라미터 |
| `configs/rl.yaml` | PPO 하이퍼파라미터 |
| `configs/export.yaml` | 출력 포맷, 경로 |
| `env/isaac_env.py` | Gym 호환 환경 (mock 모드 내장) |
| `env/robot_loader.py` | URDF → USD 변환, 관절 제어 인터페이스 |
| `env/sensor.py` | RGB-D / 관절상태 / EE포즈 센서 추상화 |
| `env/task_registry.py` | 태스크별 보상함수 + 성공 판정 등록 |
| `collector/dataset.py` | HDF5 에피소드 저장/로드 |
| `collector/teleop.py` | 키보드 텔레오퍼레이션 |
| `collector/rollout.py` | 정책 자동 롤아웃 수집 |
| `trainer/il/policy.py` | MLP 정책 네트워크 |
| `trainer/il/dataloader.py` | HDF5 → PyTorch DataLoader |
| `trainer/il/bc_trainer.py` | Behavior Cloning 학습 루프 |
| `trainer/rl/reward_shaper.py` | 보상 스케일링 + 커리큘럼 |
| `trainer/rl/ppo_trainer.py` | PPO 파인튜닝 (stable-baselines3 래퍼) |
| `trainer/rl/sac_trainer.py` | SAC 옵션 (stable-baselines3 래퍼) |
| `export/policy_exporter.py` | PyTorch → ONNX / TorchScript |
| `export/dataset_builder.py` | 렌더링 이미지 + 메타 → HDF5 |
| `run.py` | CLI 진입점 |
| `tests/test_env.py` | Mock env unit tests |
| `tests/test_collector.py` | Dataset HDF5 unit tests |
| `tests/test_il_trainer.py` | BC 학습 루프 unit tests |
| `tests/test_rl_trainer.py` | PPO 루프 unit tests |
| `tests/test_export.py` | ONNX 변환 unit tests |

---

## Task 1: 프로젝트 스캐폴딩

**Files:**
- Create: `requirements.txt`
- Create: `.gitignore`
- Create: `configs/env.yaml`
- Create: `configs/collector.yaml`
- Create: `configs/il.yaml`
- Create: `configs/rl.yaml`
- Create: `configs/export.yaml`

- [ ] **Step 1: requirements.txt 작성**

```
torch>=2.1.0
numpy>=1.24.0
h5py>=3.9.0
gymnasium>=0.29.0
stable-baselines3>=2.2.0
onnx>=1.15.0
onnxruntime>=1.16.0
pyyaml>=6.0
ovrtx
```

파일 저장: `requirements.txt`

- [ ] **Step 2: .gitignore 작성**

```
demos/
checkpoints/
outputs/
.superpowers/
__pycache__/
*.pyc
*.pyo
*.egg-info/
.env
```

파일 저장: `.gitignore`

- [ ] **Step 3: configs/env.yaml 작성**

```yaml
scene:
  usd_path: ""          # USD 씬 파일 경로 (비우면 기본 빈 스테이지)
  gravity: [0, 0, -9.81]

robot:
  urdf_path: ""         # URDF 파일 경로
  base_prim: "/World/Robot"
  num_joints: 7         # 관절 수 (매니퓰레이터)
  has_mobile_base: true
  base_dof: 3           # vx, vy, omega

sensor:
  rgb:
    enabled: true
    width: 224
    height: 224
  depth:
    enabled: true
    width: 224
    height: 224
  joint_state: true
  ee_pose: true

mock_mode: false        # true면 Isaac Sim 없이 더미 obs 반환
```

파일 저장: `configs/env.yaml`

- [ ] **Step 4: configs/collector.yaml 작성**

```yaml
mode: teleop            # teleop | rollout
episodes: 100
max_steps_per_episode: 500
save_dir: demos/
checkpoint_path: ""     # rollout 모드에서 사용할 정책 경로
```

파일 저장: `configs/collector.yaml`

- [ ] **Step 5: configs/il.yaml 작성**

```yaml
demo_dir: demos/
checkpoint_dir: checkpoints/il/
batch_size: 64
lr: 1.0e-4
epochs: 100
hidden_dim: 256
save_every: 10          # N epoch마다 체크포인트 저장
```

파일 저장: `configs/il.yaml`

- [ ] **Step 6: configs/rl.yaml 작성**

```yaml
il_checkpoint: checkpoints/il/best.pt
checkpoint_dir: checkpoints/rl/
algorithm: ppo          # ppo | sac
total_timesteps: 1000000
learning_rate: 3.0e-4
n_steps: 2048           # PPO rollout 길이
batch_size: 64
n_epochs: 10
gamma: 0.99
```

파일 저장: `configs/rl.yaml`

- [ ] **Step 7: configs/export.yaml 작성**

```yaml
rl_checkpoint: checkpoints/rl/best
output_dir: outputs/
policy:
  format: onnx          # onnx | torchscript
  filename: policy.onnx
dataset:
  render_rollouts: 50
  filename: synthetic_v1.hdf5
```

파일 저장: `configs/export.yaml`

- [ ] **Step 8: 필요한 디렉토리 생성 및 커밋**

```bash
mkdir -p env collector trainer/il trainer/rl export tests
touch env/__init__.py collector/__init__.py
touch trainer/__init__.py trainer/il/__init__.py trainer/rl/__init__.py
touch export/__init__.py tests/__init__.py

git add .
git commit -m "feat: project scaffolding — configs, requirements, gitignore"
```

---

## Task 2: 환경 레이어 — Gym 호환 인터페이스 (env/isaac_env.py)

**Files:**
- Create: `env/isaac_env.py`
- Create: `tests/test_env.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# tests/test_env.py
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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_env.py -v
```

Expected: `ImportError` 또는 `ModuleNotFoundError`

- [ ] **Step 3: env/isaac_env.py 구현**

```python
# env/isaac_env.py
import numpy as np


class IsaacEnv:
    """Gym-compatible Isaac Sim environment with mock mode for testing."""

    def __init__(self, config: dict):
        self.cfg = config
        self.mock = config.get("mock_mode", False)
        self.num_joints = config["robot"]["num_joints"]
        self.base_dof = config["robot"]["base_dof"] if config["robot"]["has_mobile_base"] else 0
        self.action_dim = self.num_joints + self.base_dof
        self.w = config["sensor"]["rgb"]["width"]
        self.h = config["sensor"]["rgb"]["height"]
        self._step_count = 0
        self._max_steps = 500

        if not self.mock:
            self._init_isaac()

    def _init_isaac(self):
        from omni.isaac.kit import SimulationApp
        self._app = SimulationApp({"headless": True})
        import omni.isaac.core.utils.stage as stage_utils
        stage_utils.create_new_stage()

    def reset(self) -> dict:
        self._step_count = 0
        if self.mock:
            return self._mock_obs()
        return self._isaac_obs()

    def step(self, action: np.ndarray):
        assert action.shape == (self.action_dim,), (
            f"Expected action shape ({self.action_dim},), got {action.shape}"
        )
        self._step_count += 1
        if self.mock:
            obs = self._mock_obs()
            reward = float(np.random.randn() * 0.1)
            done = self._step_count >= self._max_steps
            return obs, reward, done, {}
        return self._isaac_step(action)

    def _mock_obs(self) -> dict:
        return {
            "rgb": np.zeros((self.h, self.w, 3), dtype=np.uint8),
            "depth": np.zeros((self.h, self.w, 1), dtype=np.float32),
            "joint_state": np.zeros(self.num_joints, dtype=np.float32),
            "ee_pose": np.zeros(7, dtype=np.float32),
        }

    def _isaac_obs(self) -> dict:
        raise NotImplementedError("Isaac Sim obs — implement after isaacsim install")

    def _isaac_step(self, action):
        raise NotImplementedError("Isaac Sim step — implement after isaacsim install")

    def close(self):
        if not self.mock and hasattr(self, "_app"):
            self._app.close()
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/test_env.py -v
```

Expected: 3개 PASS

- [ ] **Step 5: 커밋**

```bash
git add env/isaac_env.py tests/test_env.py
git commit -m "feat: IsaacEnv gym interface with mock mode"
```

---

## Task 3: 환경 레이어 — 로봇 로더 + 센서 (env/robot_loader.py, env/sensor.py)

**Files:**
- Create: `env/robot_loader.py`
- Create: `env/sensor.py`

- [ ] **Step 1: 실패하는 테스트 추가 (tests/test_env.py)**

기존 `tests/test_env.py` 하단에 추가:

```python
from env.robot_loader import RobotLoader
from env.sensor import SensorBundle

def test_robot_loader_action_dim():
    loader = RobotLoader(num_joints=7, has_mobile_base=True, base_dof=3)
    assert loader.action_dim == 10

def test_sensor_bundle_obs_keys():
    bundle = SensorBundle(width=224, height=224, num_joints=7)
    obs = bundle.mock_read()
    assert set(obs.keys()) == {"rgb", "depth", "joint_state", "ee_pose"}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_env.py::test_robot_loader_action_dim tests/test_env.py::test_sensor_bundle_obs_keys -v
```

Expected: `ImportError`

- [ ] **Step 3: env/robot_loader.py 구현**

```python
# env/robot_loader.py
import numpy as np


class RobotLoader:
    """Robot joint + base control interface (mock-safe)."""

    def __init__(self, num_joints: int, has_mobile_base: bool, base_dof: int):
        self.num_joints = num_joints
        self.has_mobile_base = has_mobile_base
        self.base_dof = base_dof if has_mobile_base else 0
        self.action_dim = num_joints + self.base_dof

    def apply_action(self, action: np.ndarray):
        """Send joint velocities + base velocity to robot."""
        assert action.shape == (self.action_dim,)
        joint_cmd = action[:self.num_joints]
        base_cmd = action[self.num_joints:] if self.has_mobile_base else None
        return joint_cmd, base_cmd

    def get_joint_state(self) -> np.ndarray:
        """Returns current joint positions (mock: zeros)."""
        return np.zeros(self.num_joints, dtype=np.float32)

    def get_ee_pose(self) -> np.ndarray:
        """Returns EE pose as [x, y, z, qx, qy, qz, qw] (mock: zeros)."""
        return np.zeros(7, dtype=np.float32)
```

- [ ] **Step 4: env/sensor.py 구현**

```python
# env/sensor.py
import numpy as np


class SensorBundle:
    """Aggregates RGB-D, joint state, and EE pose into a single obs dict."""

    def __init__(self, width: int, height: int, num_joints: int):
        self.w = width
        self.h = height
        self.num_joints = num_joints

    def mock_read(self) -> dict:
        return {
            "rgb": np.zeros((self.h, self.w, 3), dtype=np.uint8),
            "depth": np.zeros((self.h, self.w, 1), dtype=np.float32),
            "joint_state": np.zeros(self.num_joints, dtype=np.float32),
            "ee_pose": np.zeros(7, dtype=np.float32),
        }

    def read(self, rgb_cam, depth_cam, robot_loader) -> dict:
        """Read from live Isaac Sim sensors — call after _init_isaac."""
        return {
            "rgb": rgb_cam.get_rgba()[:, :, :3],
            "depth": depth_cam.get_depth()[..., np.newaxis],
            "joint_state": robot_loader.get_joint_state(),
            "ee_pose": robot_loader.get_ee_pose(),
        }
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/test_env.py -v
```

Expected: 5개 PASS

- [ ] **Step 6: 커밋**

```bash
git add env/robot_loader.py env/sensor.py tests/test_env.py
git commit -m "feat: RobotLoader and SensorBundle"
```

---

## Task 4: 환경 레이어 — 태스크 레지스트리 (env/task_registry.py)

**Files:**
- Create: `env/task_registry.py`

- [ ] **Step 1: 실패하는 테스트 추가 (tests/test_env.py)**

```python
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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_env.py::test_task_registry_register_and_call tests/test_env.py::test_task_registry_unknown_task_raises -v
```

Expected: `ImportError`

- [ ] **Step 3: env/task_registry.py 구현**

```python
# env/task_registry.py
from typing import Callable, Dict


class TaskRegistry:
    """Maps task names to reward and success functions."""

    def __init__(self):
        self._tasks: Dict[str, dict] = {}

    def register(self, name: str, reward_fn: Callable, success_fn: Callable):
        self._tasks[name] = {"reward": reward_fn, "success": success_fn}

    def compute_reward(self, name: str, obs: dict, action, info: dict) -> float:
        return self._tasks[name]["reward"](obs, action, info)

    def is_success(self, name: str, obs: dict, info: dict) -> bool:
        return self._tasks[name]["success"](obs, info)
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/test_env.py -v
```

Expected: 7개 PASS

- [ ] **Step 5: 커밋**

```bash
git add env/task_registry.py tests/test_env.py
git commit -m "feat: TaskRegistry for reward and success functions"
```

---

## Task 5: 데이터 수집 — HDF5 데이터셋 (collector/dataset.py)

**Files:**
- Create: `collector/dataset.py`
- Create: `tests/test_collector.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# tests/test_collector.py
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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_collector.py -v
```

Expected: `ImportError`

- [ ] **Step 3: collector/dataset.py 구현**

```python
# collector/dataset.py
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
        obs_grp = self._f.create_group("obs")
        for k, buf in self._obs_bufs.items():
            obs_grp.create_dataset(k, data=np.stack(buf))
        self._f.create_dataset("action", data=np.stack(self._action_buf))
        self._f.create_dataset("reward", data=np.array(self._reward_buf, dtype=np.float32))
        self._f.create_dataset("done", data=np.array(self._done_buf, dtype=bool))
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/test_collector.py -v
```

Expected: 2개 PASS

- [ ] **Step 5: 커밋**

```bash
git add collector/dataset.py tests/test_collector.py
git commit -m "feat: HDF5 EpisodeWriter and EpisodeReader"
```

---

## Task 6: 데이터 수집 — 텔레오퍼레이션 + 롤아웃 (collector/teleop.py, collector/rollout.py)

**Files:**
- Create: `collector/teleop.py`
- Create: `collector/rollout.py`

- [ ] **Step 1: 실패하는 테스트 추가 (tests/test_collector.py)**

```python
from collector.teleop import KeyboardTeleop
from collector.rollout import RolloutCollector
import numpy as np

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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_collector.py::test_keyboard_teleop_action_shape tests/test_collector.py::test_rollout_collector_runs -v
```

Expected: `ImportError`

- [ ] **Step 3: collector/teleop.py 구현**

```python
# collector/teleop.py
import numpy as np


class KeyboardTeleop:
    """Keyboard-based teleoperation. Returns zero action in non-interactive mode."""

    KEY_MAP = {
        "w": (0, 0.1),   # joint 0 +
        "s": (0, -0.1),  # joint 0 -
        "e": (1, 0.1),
        "d": (1, -0.1),
    }

    def __init__(self, action_dim: int):
        self.action_dim = action_dim

    def get_action(self, key: str = "") -> np.ndarray:
        action = np.zeros(self.action_dim, dtype=np.float32)
        if key in self.KEY_MAP:
            idx, val = self.KEY_MAP[key]
            if idx < self.action_dim:
                action[idx] = val
        return action
```

- [ ] **Step 4: collector/rollout.py 구현**

```python
# collector/rollout.py
import os
import numpy as np
from collector.dataset import EpisodeWriter


class RolloutCollector:
    """Collects episodes by rolling out a policy in the environment."""

    def __init__(self, env, save_dir: str, action_dim: int):
        self.env = env
        self.save_dir = save_dir
        self.action_dim = action_dim
        os.makedirs(save_dir, exist_ok=True)

    def _obs_to_vec(self, obs: dict) -> np.ndarray:
        return np.concatenate([
            obs["joint_state"],
            obs["ee_pose"],
        ])

    def collect(self, policy, n_episodes: int, max_steps: int):
        existing = len(os.listdir(self.save_dir))
        for ep in range(n_episodes):
            idx = existing + ep
            path = os.path.join(self.save_dir, f"episode_{idx:04d}.hdf5")
            writer = EpisodeWriter(path)
            obs = self.env.reset()
            for _ in range(max_steps):
                obs_vec = self._obs_to_vec(obs)
                action, _ = policy.predict(obs_vec)
                next_obs, reward, done, info = self.env.step(action)
                writer.add_step(obs=obs, action=action, reward=reward, done=done)
                obs = next_obs
                if done:
                    break
            writer.close()
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/test_collector.py -v
```

Expected: 4개 PASS

- [ ] **Step 6: 커밋**

```bash
git add collector/teleop.py collector/rollout.py tests/test_collector.py
git commit -m "feat: KeyboardTeleop and RolloutCollector"
```

---

## Task 7: IL 학습 — 정책 네트워크 (trainer/il/policy.py)

**Files:**
- Create: `trainer/il/policy.py`
- Create: `tests/test_il_trainer.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# tests/test_il_trainer.py
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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_il_trainer.py::test_mlp_policy_forward_shape tests/test_il_trainer.py::test_mlp_policy_save_load -v
```

Expected: `ImportError`

- [ ] **Step 3: trainer/il/policy.py 구현**

```python
# trainer/il/policy.py
import torch
import torch.nn as nn


class MLPPolicy(nn.Module):
    """Simple MLP policy: obs → action (continuous)."""

    def __init__(self, obs_dim: int, action_dim: int, hidden_dim: int = 256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(obs_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, action_dim),
            nn.Tanh(),
        )

    def forward(self, obs: torch.Tensor) -> torch.Tensor:
        return self.net(obs)

    def predict(self, obs_vec):
        """SB3-compatible predict interface."""
        import numpy as np
        with torch.no_grad():
            t = torch.tensor(obs_vec, dtype=torch.float32).unsqueeze(0)
            return self(t).squeeze(0).numpy(), None
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/test_il_trainer.py -v
```

Expected: 2개 PASS

- [ ] **Step 5: 커밋**

```bash
git add trainer/il/policy.py tests/test_il_trainer.py
git commit -m "feat: MLPPolicy network"
```

---

## Task 8: IL 학습 — DataLoader + BC Trainer (trainer/il/dataloader.py, trainer/il/bc_trainer.py)

**Files:**
- Create: `trainer/il/dataloader.py`
- Create: `trainer/il/bc_trainer.py`

- [ ] **Step 1: 실패하는 테스트 추가 (tests/test_il_trainer.py)**

```python
import os
import numpy as np
import tempfile
from collector.dataset import EpisodeWriter
from trainer.il.dataloader import DemoDataset
from trainer.il.bc_trainer import BCTrainer
import yaml

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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_il_trainer.py::test_demo_dataset_len_and_item tests/test_il_trainer.py::test_bc_trainer_runs_one_epoch -v
```

Expected: `ImportError`

- [ ] **Step 3: trainer/il/dataloader.py 구현**

```python
# trainer/il/dataloader.py
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
```

- [ ] **Step 4: trainer/il/bc_trainer.py 구현**

```python
# trainer/il/bc_trainer.py
import os
import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from trainer.il.policy import MLPPolicy
from trainer.il.dataloader import DemoDataset


class BCTrainer:
    """Behavior Cloning trainer: supervised regression on (obs, action) pairs."""

    def __init__(self, cfg: dict):
        self.cfg = cfg
        os.makedirs(cfg["checkpoint_dir"], exist_ok=True)
        dataset = DemoDataset(cfg["demo_dir"])
        self.loader = DataLoader(dataset, batch_size=cfg["batch_size"], shuffle=True)
        obs_dim = dataset[0][0].shape[0]
        action_dim = dataset[0][1].shape[0]
        self.policy = MLPPolicy(obs_dim=obs_dim, action_dim=action_dim,
                                hidden_dim=cfg["hidden_dim"])
        self.opt = torch.optim.Adam(self.policy.parameters(), lr=cfg["lr"])
        self.loss_fn = nn.MSELoss()
        self._best_loss = float("inf")

    def train(self):
        for epoch in range(self.cfg["epochs"]):
            epoch_loss = self._run_epoch()
            if epoch_loss < self._best_loss:
                self._best_loss = epoch_loss
                self._save("best.pt")
            if (epoch + 1) % self.cfg["save_every"] == 0:
                self._save(f"epoch_{epoch+1:04d}.pt")

    def _run_epoch(self) -> float:
        total = 0.0
        for obs, action in self.loader:
            self.opt.zero_grad()
            pred = self.policy(obs)
            loss = self.loss_fn(pred, action)
            loss.backward()
            self.opt.step()
            total += loss.item()
        return total / len(self.loader)

    def _save(self, name: str):
        torch.save(self.policy.state_dict(),
                   os.path.join(self.cfg["checkpoint_dir"], name))
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/test_il_trainer.py -v
```

Expected: 4개 PASS

- [ ] **Step 6: 커밋**

```bash
git add trainer/il/dataloader.py trainer/il/bc_trainer.py tests/test_il_trainer.py
git commit -m "feat: DemoDataset, BCTrainer (IL stage)"
```

---

## Task 9: RL 파인튜닝 (trainer/rl/)

**Files:**
- Create: `trainer/rl/reward_shaper.py`
- Create: `trainer/rl/ppo_trainer.py`
- Create: `trainer/rl/sac_trainer.py`
- Create: `tests/test_rl_trainer.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# tests/test_rl_trainer.py
import numpy as np
from trainer.rl.reward_shaper import RewardShaper
from trainer.rl.ppo_trainer import PPOTrainer

def test_reward_shaper_scale():
    shaper = RewardShaper(scale=2.0, clip=(-5.0, 5.0))
    assert shaper.shape(1.0) == 2.0
    assert shaper.shape(10.0) == 5.0
    assert shaper.shape(-10.0) == -5.0

def test_ppo_trainer_runs(tmp_path):
    import gymnasium as gym
    cfg = {
        "il_checkpoint": "",            # 빈 문자열 = IL 체크포인트 스킵
        "checkpoint_dir": str(tmp_path),
        "algorithm": "ppo",
        "total_timesteps": 500,
        "learning_rate": 3e-4,
        "n_steps": 64,
        "batch_size": 32,
        "n_epochs": 2,
        "gamma": 0.99,
    }
    trainer = PPOTrainer(cfg, env_id="CartPole-v1")
    trainer.train()
    import os
    assert os.path.exists(os.path.join(str(tmp_path), "best.zip"))
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_rl_trainer.py -v
```

Expected: `ImportError`

- [ ] **Step 3: trainer/rl/reward_shaper.py 구현**

```python
# trainer/rl/reward_shaper.py
import numpy as np


class RewardShaper:
    """Scales and clips rewards for stable RL training."""

    def __init__(self, scale: float = 1.0, clip: tuple = (-10.0, 10.0)):
        self.scale = scale
        self.clip = clip

    def shape(self, reward: float) -> float:
        return float(np.clip(reward * self.scale, self.clip[0], self.clip[1]))
```

- [ ] **Step 4: trainer/rl/ppo_trainer.py 구현**

```python
# trainer/rl/ppo_trainer.py
import os
import torch
from stable_baselines3 import PPO
from stable_baselines3.common.callbacks import CheckpointCallback, EvalCallback
from trainer.il.policy import MLPPolicy


class PPOTrainer:
    """PPO finetuner that optionally loads IL weights as initialization."""

    def __init__(self, cfg: dict, env_id: str = None, env=None):
        self.cfg = cfg
        os.makedirs(cfg["checkpoint_dir"], exist_ok=True)
        if env is not None:
            self.env = env
        else:
            import gymnasium as gym
            self.env = gym.make(env_id)

        self.model = PPO(
            "MlpPolicy",
            self.env,
            learning_rate=cfg["learning_rate"],
            n_steps=cfg["n_steps"],
            batch_size=cfg["batch_size"],
            n_epochs=cfg["n_epochs"],
            gamma=cfg["gamma"],
            verbose=0,
        )
        if cfg.get("il_checkpoint"):
            self._load_il_weights(cfg["il_checkpoint"])

    def _load_il_weights(self, path: str):
        obs_dim = self.env.observation_space.shape[0]
        action_dim = self.env.action_space.shape[0]
        il_policy = MLPPolicy(obs_dim=obs_dim, action_dim=action_dim)
        il_policy.load_state_dict(torch.load(path, map_location="cpu"))
        # SB3 MlpPolicy shares architecture — copy compatible layers by name
        sb3_state = self.model.policy.state_dict()
        il_state = il_policy.state_dict()
        for k in il_state:
            if k in sb3_state and sb3_state[k].shape == il_state[k].shape:
                sb3_state[k] = il_state[k]
        self.model.policy.load_state_dict(sb3_state, strict=False)

    def train(self):
        checkpoint_cb = CheckpointCallback(
            save_freq=max(self.cfg["total_timesteps"] // 10, 1),
            save_path=self.cfg["checkpoint_dir"],
            name_prefix="rl",
        )
        self.model.learn(
            total_timesteps=self.cfg["total_timesteps"],
            callback=checkpoint_cb,
        )
        self.model.save(os.path.join(self.cfg["checkpoint_dir"], "best"))
```

- [ ] **Step 5: trainer/rl/sac_trainer.py 구현**

```python
# trainer/rl/sac_trainer.py
import os
from stable_baselines3 import SAC
from stable_baselines3.common.callbacks import CheckpointCallback


class SACTrainer:
    """SAC finetuner — higher sample efficiency than PPO for continuous actions."""

    def __init__(self, cfg: dict, env_id: str = None, env=None):
        self.cfg = cfg
        os.makedirs(cfg["checkpoint_dir"], exist_ok=True)
        if env is not None:
            self.env = env
        else:
            import gymnasium as gym
            self.env = gym.make(env_id)

        self.model = SAC(
            "MlpPolicy",
            self.env,
            learning_rate=cfg["learning_rate"],
            batch_size=cfg["batch_size"],
            gamma=cfg["gamma"],
            verbose=0,
        )

    def train(self):
        checkpoint_cb = CheckpointCallback(
            save_freq=max(self.cfg["total_timesteps"] // 10, 1),
            save_path=self.cfg["checkpoint_dir"],
            name_prefix="sac",
        )
        self.model.learn(
            total_timesteps=self.cfg["total_timesteps"],
            callback=checkpoint_cb,
        )
        self.model.save(os.path.join(self.cfg["checkpoint_dir"], "best"))
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
pytest tests/test_rl_trainer.py -v
```

Expected: 2개 PASS

- [ ] **Step 7: 커밋**

```bash
git add trainer/rl/reward_shaper.py trainer/rl/ppo_trainer.py trainer/rl/sac_trainer.py tests/test_rl_trainer.py
git commit -m "feat: RewardShaper, PPOTrainer, SACTrainer (RL stage)"
```

---

## Task 10: 내보내기 (export/policy_exporter.py, export/dataset_builder.py)

**Files:**
- Create: `export/policy_exporter.py`
- Create: `export/dataset_builder.py`
- Create: `tests/test_export.py`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# tests/test_export.py
import torch
import numpy as np
import os
from trainer.il.policy import MLPPolicy
from export.policy_exporter import PolicyExporter

def test_onnx_export_and_inference(tmp_path):
    policy = MLPPolicy(obs_dim=14, action_dim=10, hidden_dim=64)
    path = str(tmp_path / "policy.onnx")
    exporter = PolicyExporter(policy, obs_dim=14)
    exporter.to_onnx(path)
    assert os.path.exists(path)

    import onnxruntime as ort
    sess = ort.InferenceSession(path)
    obs = np.zeros((1, 14), dtype=np.float32)
    out = sess.run(None, {"obs": obs})[0]
    assert out.shape == (1, 10)

def test_onnx_output_matches_pytorch(tmp_path):
    policy = MLPPolicy(obs_dim=14, action_dim=10, hidden_dim=64)
    path = str(tmp_path / "policy.onnx")
    exporter = PolicyExporter(policy, obs_dim=14)
    exporter.to_onnx(path)

    obs_np = np.random.randn(1, 14).astype(np.float32)
    with torch.no_grad():
        pt_out = policy(torch.from_numpy(obs_np)).numpy()

    import onnxruntime as ort
    sess = ort.InferenceSession(path)
    ort_out = sess.run(None, {"obs": obs_np})[0]

    np.testing.assert_allclose(pt_out, ort_out, atol=1e-5)
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/test_export.py -v
```

Expected: `ImportError`

- [ ] **Step 3: export/policy_exporter.py 구현**

```python
# export/policy_exporter.py
import os
import torch
import torch.nn as nn


class PolicyExporter:
    """Exports a PyTorch policy to ONNX or TorchScript."""

    def __init__(self, policy: nn.Module, obs_dim: int):
        self.policy = policy.eval()
        self.obs_dim = obs_dim

    def to_onnx(self, path: str):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        dummy = torch.zeros(1, self.obs_dim)
        torch.onnx.export(
            self.policy,
            dummy,
            path,
            input_names=["obs"],
            output_names=["action"],
            dynamic_axes={"obs": {0: "batch"}, "action": {0: "batch"}},
            opset_version=17,
        )

    def to_torchscript(self, path: str):
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        scripted = torch.jit.script(self.policy)
        scripted.save(path)
```

- [ ] **Step 4: export/dataset_builder.py 구현**

```python
# export/dataset_builder.py
import os
import numpy as np
import h5py
from collector.rollout import RolloutCollector
from collector.dataset import EpisodeReader


class DatasetBuilder:
    """Rolls out a policy, captures rendered frames, and saves to HDF5."""

    def __init__(self, env, policy, output_path: str):
        self.env = env
        self.policy = policy
        self.output_path = output_path
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    def build(self, n_rollouts: int, max_steps: int):
        all_rgb = []
        all_joints = []
        all_actions = []
        all_rewards = []

        for _ in range(n_rollouts):
            obs = self.env.reset()
            for _ in range(max_steps):
                obs_vec = np.concatenate([obs["joint_state"], obs["ee_pose"]])
                action, _ = self.policy.predict(obs_vec)
                all_rgb.append(obs["rgb"])
                all_joints.append(obs["joint_state"])
                all_actions.append(action)
                obs, reward, done, _ = self.env.step(action)
                all_rewards.append(reward)
                if done:
                    break

        with h5py.File(self.output_path, "w") as f:
            f.create_dataset("rgb", data=np.stack(all_rgb))
            f.create_dataset("joint_state", data=np.stack(all_joints).astype(np.float32))
            f.create_dataset("action", data=np.stack(all_actions).astype(np.float32))
            f.create_dataset("reward", data=np.array(all_rewards, dtype=np.float32))
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/test_export.py -v
```

Expected: 2개 PASS

- [ ] **Step 6: 커밋**

```bash
git add export/policy_exporter.py export/dataset_builder.py tests/test_export.py
git commit -m "feat: PolicyExporter (ONNX) and DatasetBuilder"
```

---

## Task 11: CLI 진입점 (run.py)

**Files:**
- Create: `run.py`

- [ ] **Step 1: run.py 작성**

```python
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
    print("ENV OK — obs keys:", list(obs.keys()))
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

    if col_cfg["mode"] == "teleop":
        from collector.teleop import KeyboardTeleop
        from collector.dataset import EpisodeWriter
        import os
        teleop = KeyboardTeleop(action_dim=action_dim)
        os.makedirs(col_cfg["save_dir"], exist_ok=True)
        existing = len(os.listdir(col_cfg["save_dir"]))
        for ep in range(col_cfg["episodes"]):
            path = os.path.join(col_cfg["save_dir"], f"episode_{existing+ep:04d}.hdf5")
            writer = EpisodeWriter(path)
            obs = env.reset()
            for _ in range(col_cfg["max_steps_per_episode"]):
                action = teleop.get_action()
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
    env = IsaacEnv(env_cfg)
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

    # SB3 zip → state_dict 로드
    from stable_baselines3 import PPO
    sb3_model = PPO.load(exp_cfg["rl_checkpoint"])
    # SB3 → MLPPolicy 가중치 이식 (compatible layers)
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
    p_col.add_argument("--mode", choices=["teleop", "rollout"])
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
```

- [ ] **Step 2: CLI 동작 확인 (mock 모드)**

```bash
python run.py env --validate
```

Expected 출력:
```
ENV OK — obs keys: ['rgb', 'depth', 'joint_state', 'ee_pose']
```

- [ ] **Step 3: 전체 테스트 통과 확인**

```bash
pytest tests/ -v
```

Expected: 15개 이상 PASS, 0 FAIL

- [ ] **Step 4: 커밋**

```bash
git add run.py
git commit -m "feat: run.py CLI entry point — all stages wired"
```

---

## Task 12: 최종 검증

- [ ] **Step 1: 전체 테스트 한 번 더 실행**

```bash
pytest tests/ -v --tb=short
```

Expected: 0 FAIL

- [ ] **Step 2: 폴더 구조 확인**

```bash
find . -type f -name "*.py" | grep -v __pycache__ | sort
```

Expected 파일 목록:
```
./collector/__init__.py
./collector/dataset.py
./collector/rollout.py
./collector/teleop.py
./env/__init__.py
./env/isaac_env.py
./env/robot_loader.py
./env/sensor.py
./env/task_registry.py
./export/__init__.py
./export/dataset_builder.py
./export/policy_exporter.py
./run.py
./tests/__init__.py
./tests/test_collector.py
./tests/test_env.py
./tests/test_export.py
./tests/test_il_trainer.py
./tests/test_rl_trainer.py
./trainer/__init__.py
./trainer/il/__init__.py
./trainer/il/bc_trainer.py
./trainer/il/dataloader.py
./trainer/il/policy.py
./trainer/rl/__init__.py
./trainer/rl/ppo_trainer.py
./trainer/rl/reward_shaper.py
./trainer/rl/sac_trainer.py
```

- [ ] **Step 3: 최종 커밋**

```bash
git add .
git commit -m "feat: complete robotics pipeline — all modules, tests, CLI"
```

---

## 다음 단계 (Isaac Sim 설치 후)

```bash
# Isaac Sim 설치
pip install isaacsim --extra-index-url https://pypi.nvidia.com

# env.yaml에서 mock_mode: false 설정 후
python run.py env --validate         # 실제 Isaac Sim 검증
python run.py collect --mode teleop  # 데모 수집
python run.py il                     # BC 학습
python run.py rl                     # PPO 파인튜닝
python run.py export                 # 정책 + 데이터셋 내보내기
```
