# Isaac Sim / Omniverse 기반 로보틱스 학습 파이프라인 설계

**날짜:** 2026-05-21  
**상태:** 승인됨

---

## 1. 요구사항 요약

| 항목 | 결정 |
|------|------|
| 로봇 태스크 | 이동 + 조작 복합 태스크 |
| 학습 방식 | RL + IL 혼합 (IL 웜업 → RL 파인튜닝) |
| 최종 출력 | 배포 가능한 정책(ONNX/TorchScript) + 합성 데이터셋(HDF5) |
| 환경 | Isaac Sim 미설치 → 설치부터 포함 |
| 로봇 플랫폼 | 범용 (특정 로봇 비종속) |

---

## 2. 아키텍처 개요

**방식: Modular Stage Pipeline**

각 단계를 독립 모듈로 분리하고, 명확한 인터페이스로 연결한다.  
모든 모듈은 `configs/` 아래 YAML 파일로 설정하며, `run.py --stage <단계>`로 독립 실행 가능하다.

```
┌─────────────────────────────────────────────────────────┐
│                   PhysicalAI Pipeline                   │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │   ENV    │───▶│  DATA    │───▶│   IL TRAINER     │  │
│  │  Layer   │    │Collector │    │ (Behavior Clone) │  │
│  └──────────┘    └──────────┘    └────────┬─────────┘  │
│       ▲                                   │            │
│       │                                   ▼            │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │  EVAL /  │◀───│ EXPORT   │◀───│   RL FINETUNER   │  │
│  │ VALIDATE │    │(Policy + │    │  (PPO/SAC 등)    │  │
│  └──────────┘    │Dataset)  │    └──────────────────┘  │
│                  └──────────┘                          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 모듈 상세 설계

### 3.1 `env/` — 환경 레이어

| 파일 | 역할 |
|------|------|
| `isaac_env.py` | IsaacSim 초기화, USD 씬 로드, 물리 스텝 |
| `robot_loader.py` | URDF → USD 변환, 관절 제어 인터페이스 |
| `sensor.py` | RGB-D 카메라, LiDAR, 접촉 센서 추상화 |
| `task_registry.py` | 태스크별 보상함수 + 성공 판정 등록 |

- Gym 호환 인터페이스(`reset()`, `step()`, `render()`) 제공
- 씬은 USD 파일로 정의, `ovrtx.Renderer`로 포토리얼 렌더링

### 3.2 `collector/` — 데이터 수집

| 파일 | 역할 |
|------|------|
| `teleop.py` | 키보드/스페이스마우스 텔레오퍼레이션 |
| `rollout.py` | 학습된 정책으로 자동 롤아웃 수집 |
| `dataset.py` | HDF5 포맷으로 (obs, action, reward, done) 저장 |

### 3.3 `trainer/il/` — 모방 학습

| 파일 | 역할 |
|------|------|
| `bc_trainer.py` | Behavior Cloning (MLP/Transformer 정책) |
| `policy.py` | 정책 네트워크 정의 (교체 가능) |
| `dataloader.py` | HDF5 데이터셋 → PyTorch DataLoader |

### 3.4 `trainer/rl/` — 강화학습 파인튜닝

| 파일 | 역할 |
|------|------|
| `ppo_trainer.py` | PPO (안정적, 기본값) |
| `sac_trainer.py` | SAC (샘플 효율 높음, 옵션) |
| `reward_shaper.py` | 보상 스케일링 + 커리큘럼 관리 |

- IL로 학습된 가중치를 초기값으로 로드 후 RL 파인튜닝 시작

### 3.5 `export/` — 내보내기

| 파일 | 역할 |
|------|------|
| `policy_exporter.py` | PyTorch → ONNX / TorchScript 변환 |
| `dataset_builder.py` | 렌더링 이미지 + 메타데이터 → HDF5 데이터셋 |

---

## 4. 데이터 흐름 + 실행 순서

### 실행 명령

```bash
# 1단계: 환경 검증
python run.py --stage env

# 2단계: 전문가 데모 수집 (텔레오퍼레이션)
python run.py --stage collect --mode teleop --episodes 100

# 3단계: IL 학습 (Behavior Cloning)
python run.py --stage il

# 4단계: RL 파인튜닝 (IL 가중치 → PPO 개선)
python run.py --stage rl

# 5단계: 정책 + 데이터셋 내보내기
python run.py --stage export
```

### 데이터 흐름

```
텔레오퍼레이션
     │
     ▼
demos/
└── episode_NNN.hdf5   ← (obs: rgb+depth+joints, action, reward, done)
     │
     ▼
trainer/il/ → checkpoints/il/best.pt
     │
     ▼ (IL 가중치 로드)
trainer/rl/ → checkpoints/rl/best.pt
     │
     ├──▶ outputs/policy/policy.onnx
     └──▶ outputs/dataset/synthetic_v1.hdf5
```

### 관측(Observation) 공간

| 센서 | 형태 | 용도 |
|------|------|------|
| RGB 카메라 | `(H, W, 3)` | 비전 정책 입력 + 합성 데이터 |
| Depth 카메라 | `(H, W, 1)` | 3D 인식 |
| 관절 상태 | `(N,)` | 로봇 고유수용 감각 |
| EE 포즈 | `(7,)` | 엔드이펙터 위치+자세 |

### 행동(Action) 공간

| 모드 | 형태 | 설명 |
|------|------|------|
| 관절 속도 제어 | `(N,)` | 매니퓰레이션 |
| 베이스 속도 | `(3,)` | 이동 (vx, vy, ω) |
| 통합 | `(N+3,)` | 복합 태스크 |

---

## 5. 에러 처리 원칙

- 각 단계는 체크포인트에 중간 저장 → 중단 후 재개 가능
- Isaac Sim 크래시 시 자동 재시작 후 마지막 에피소드부터 재수집
- 단계별 실행이므로 IL 실패해도 수집 데이터는 보존

---

## 6. 설치 순서

```bash
# 1. NVIDIA 드라이버 확인 (≥ 537.xx 권장)

# 2. Isaac Sim 설치
pip install isaacsim --extra-index-url https://pypi.nvidia.com

# 3. 의존성 설치
pip install -r requirements.txt
# torch, numpy, h5py, gymnasium, stable-baselines3, onnx, pyyaml, ovrtx

# 4. 환경 변수 설정
# ISAAC_SIM_PATH, OMNI_KIT_ACCEPT_EULA=YES

# 5. 첫 실행 검증
python run.py --stage env --validate
```

---

## 7. 테스트 전략

Isaac Sim 없이도 각 모듈을 단독 테스트할 수 있도록 Mock 환경 제공.

| 테스트 파일 | 내용 |
|-------------|------|
| `test_env.py` | Mock IsaacEnv으로 reset/step 인터페이스 검증 |
| `test_collector.py` | 더미 데이터로 HDF5 저장/로드 검증 |
| `test_il_trainer.py` | 소규모 더미 데이터셋으로 BC 학습 루프 검증 |
| `test_rl_trainer.py` | Gym CartPole로 PPO 루프 검증 |
| `test_export.py` | ONNX 변환 및 추론 정확도 검증 |

**3단계 검증:**

| 단계 | 내용 |
|------|------|
| Unit | 각 모듈 개별 함수 테스트 (Isaac Sim 불필요) |
| Integration | 실제 Isaac Sim에서 전체 파이프라인 1 에피소드 실행 |
| Regression | 내보낸 ONNX 정책의 추론 결과가 PyTorch와 일치하는지 확인 |

---

## 8. 최종 폴더 구조

```
PhysicalAI/
├── run.py
├── requirements.txt
├── configs/
│   ├── env.yaml
│   ├── collector.yaml
│   ├── il.yaml
│   ├── rl.yaml
│   └── export.yaml
├── env/
│   ├── isaac_env.py
│   ├── robot_loader.py
│   ├── sensor.py
│   └── task_registry.py
├── collector/
│   ├── teleop.py
│   ├── rollout.py
│   └── dataset.py
├── trainer/
│   ├── il/
│   │   ├── bc_trainer.py
│   │   ├── policy.py
│   │   └── dataloader.py
│   └── rl/
│       ├── ppo_trainer.py
│       ├── sac_trainer.py
│       └── reward_shaper.py
├── export/
│   ├── policy_exporter.py
│   └── dataset_builder.py
├── tests/
│   ├── test_env.py
│   ├── test_collector.py
│   ├── test_il_trainer.py
│   ├── test_rl_trainer.py
│   └── test_export.py
├── demos/              # 수집된 데모 데이터 (git 제외)
├── checkpoints/        # 학습 체크포인트 (git 제외)
└── outputs/            # 내보낸 정책 + 데이터셋 (git 제외)
```

---

## 9. .gitignore 항목

```
demos/
checkpoints/
outputs/
.superpowers/
__pycache__/
*.pyc
```
