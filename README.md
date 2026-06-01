# PhysicalAI — Robot Learning Pipeline

> NVIDIA Isaac Sim 기반 로봇 학습 파이프라인.  
> 모방 학습(IL) → 강화 학습(RL) → ONNX 배포까지 전 과정을 **단일 CLI와 웹 대시보드**로 운영합니다.

![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python)
![Node](https://img.shields.io/badge/Node.js-18%2B-green?logo=node.js)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Status](https://img.shields.io/badge/Status-In%20Development-orange)
![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-lightgrey)
[![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/00saridon/PhysicalAI/blob/main/notebooks/ovrtx_minimal_colab.ipynb)

---

## Features

- **물리 기반 시뮬레이션** — NVIDIA Isaac Sim 환경에서 RGB·Depth·Joint State·EE Pose 센서를 실제 물리 법칙으로 구동
- **Full-pipeline 자동화** — 데모 수집 → IL → RL → ONNX 내보내기를 단일 CLI(`run.py`) 또는 대시보드 버튼 하나로 실행
- **다중 수집 모드** — Random / Teleoperation(키보드) / Policy Rollout 세 가지 데모 수집 방식 지원
- **실시간 모니터링** — SSE(Server-Sent Events) 기반 라이브 로그·RL Reward·IL Loss 스트리밍
- **ONNX 배포 준비** — 학습된 정책을 ONNX로 내보내 edge 디바이스·실제 로봇에 바로 배포 가능
- **mock_mode 지원** — Isaac Sim 없이 로컬에서 전체 파이프라인 테스트 가능 (`configs/env.yaml: mock_mode: true`)

---

## 프로젝트 상태

> **현재 활발히 개발 중입니다.**  
> Isaac Sim 연동 없이도 `mock_mode: true`로 전체 파이프라인과 대시보드를 로컬에서 테스트할 수 있습니다.

| 컴포넌트 | 상태 |
|---|---|
| CLI 파이프라인 (`run.py`) | ✅ 동작 |
| FastAPI 백엔드 | ✅ 동작 |
| React 대시보드 | ✅ 동작 |
| Isaac Sim 실환경 연동 | 🔧 개발 중 |
| 멀티 로봇 지원 | 🔧 개발 중 |

---

## 아키텍처

```
┌─────────────┐   demo HDF5   ┌─────────────┐   best.pt     ┌──────────────┐
│  ENV (Isaac) │ ──────────▶  │  IL Trainer │ ──────────▶   │  RL Trainer  │
│  + Sensors   │              │  (BC / MLP)  │               │ (PPO / SAC)  │
└─────────────┘               └─────────────┘               └──────┬───────┘
      ▲  collect                                                    │ best.zip
      │  teleop / random                                            ▼
      └─────────────────────────────────────────────────── Export (ONNX + HDF5)
```

| 스테이지 | 설명 | 출력 |
|---|---|---|
| **env** | Isaac 환경 초기화, 센서 설정 검증 | — |
| **collect** | 랜덤·텔레오퍼레이션·롤아웃으로 데모 수집 | `demos/*.hdf5` |
| **il** | Behavioral Cloning으로 초기 정책 학습 | `checkpoints/il/best.pt` |
| **rl** | PPO / SAC로 정책 파인튜닝 | `checkpoints/rl/best.zip` |
| **export** | ONNX 정책 + 합성 데이터셋 내보내기 | `outputs/policy/policy.onnx`, `outputs/dataset/*.hdf5` |

---

## 디렉터리 구조

3-계층(ML 파이프라인 · 백엔드 API · 프론트엔드)으로 구성됩니다.

```
PhysicalAI/
│
├─ run.py                  # 파이프라인 CLI 진입점 (env/collect/il/rl/export)
├─ configs/                # 스테이지별 YAML 설정 (env·collector·il·rl·export)
│
├─ ◆ ML 파이프라인 (Python)
│  ├─ env/                 # IsaacEnv(mock 지원)·FlatObsEnv·센서·로봇 로더
│  ├─ collector/           # 데모 수집: dataset(HDF5)·rollout·teleop
│  ├─ trainer/
│  │   ├─ il/              # BC 학습: bc_trainer·dataloader·policy(MLP)
│  │   └─ rl/              # 강화학습: ppo_trainer·sac_trainer·reward_shaper
│  └─ export/              # policy_exporter(ONNX)·dataset_builder(HDF5)
│
├─ ◆ 백엔드 API (FastAPI)
│  └─ api/
│      ├─ main.py              # 앱·CORS
│      ├─ subprocess_runner.py # run.py 서브프로세스 실행 + mock 모드
│      ├─ event_bus.py         # SSE 팬아웃
│      └─ routes/              # pipeline(/run·/status·/mode)·logs·artifacts
│
├─ ◆ 프론트엔드 (React + Vite + TS)
│  └─ dashboard/src/
│      ├─ pages/           # Overview(홈)·Run·Training·Demos·Artifacts·Config
│      ├─ components/      # layout(TopBar·ModeToggle)·pipeline·monitoring·ui
│      ├─ hooks/           # usePipeline·useSSELogs·useSSEMetrics
│      └─ api/client.ts    # 백엔드 REST 클라이언트
│
├─ ◆ 데이터 (gitignore · 권장: OneDrive 밖 정션 → C:\physicalai-data\)
│  ├─ demos/        # episode_*.hdf5
│  ├─ checkpoints/  # il/*.pt · rl/*.zip
│  └─ outputs/      # policy/*.onnx · dataset/*.hdf5
│
└─ ◆ 설정/배포
   ├─ package.json            # 루트 런처(dev·backend·backend:real)
   ├─ requirements.txt        # torch·h5py·sb3·onnx…
   ├─ netlify.toml            # 프론트 배포(base=dashboard)
   ├─ railway.toml·Dockerfile # 백엔드 배포
   └─ ovrtx/                  # Omniverse 렌더 모듈
```

### 실행 구조 (대시보드 ↔ 파이프라인)

```
┌─ 브라우저 ─────────────┐     ┌─ FastAPI :8000 ──────────┐     ┌─ run.py ───┐
│ React Dashboard :5173  │     │ /api/run/{stage}         │     │ 서브프로세스 │
│  · 스테이지 버튼         │─POST│ /api/mode (MOCK/REAL)    │────▶│ python      │
│  · MOCK/REAL 토글       │◀SSE─│ /api/logs·metrics/stream │◀───│ run.py <s>  │
│  · Live Log·차트        │     │ SubprocessRunner          │     └─────────────┘
└────────────────────────┘     │  └ mock_mode 분기          │       │ 읽기/쓰기
        Vite proxy /api ──▶8000 └───────────────────────────┘       ▼
                                                              C:\physicalai-data\
                                                            (demos·checkpoints·outputs)
```

- **ML 파이프라인** — `run.py` + env/collector/trainer/export, 실제 학습 로직
- **백엔드 API** — 파이프라인을 서브프로세스로 실행, SSE로 로그·메트릭 중계, MOCK/REAL 모드 제어
- **프론트엔드** — 시각화·제어 UI, Vite가 `/api/*`를 백엔드로 프록시

---

## 빠른 시작

### 요구사항

- Python 3.10+
- Node.js 18+
- NVIDIA Isaac Sim (환경 스테이지 실행 시 필요, `mock_mode: true`로 로컬 테스트 가능)

### 설치

```bash
git clone https://github.com/00saridon/PhysicalAI.git
cd PhysicalAI

# Python 의존성
pip install fastapi uvicorn sse-starlette stable-baselines3 torch onnx h5py pyyaml

# 대시보드 의존성
cd dashboard && npm install && cd ..
```

### CLI 실행

```bash
# 환경 검증 (mock_mode)
python run.py env --validate

# 데모 수집 (랜덤 10 에피소드)
python run.py collect --mode random --episodes 10

# 모방 학습
python run.py il

# 강화 학습
python run.py rl

# ONNX 내보내기
python run.py export
```

### 웹 대시보드 실행

터미널 두 개를 사용합니다. (명령은 모두 저장소 루트에서 실행)

```bash
# 터미널 1 — 백엔드 API (mock 모드, 기본값)
npm run backend

# 터미널 2 — 프론트엔드 개발 서버
npm run dev
```

브라우저에서 `http://localhost:5173` 접속. 백엔드는 `:8000`, Vite가 `/api/*`를
`:8000`으로 프록시합니다.

#### Mock 모드 vs 실제 실행

파이프라인 스테이지(ENV·COLLECT·IL·RL·EXPORT) 버튼은 백엔드 모드에 따라 다르게 동작합니다.

| 명령 | 모드 | 동작 | 필요 패키지 |
|------|------|------|-------------|
| `npm run backend` | **mock** (기본) | 실제같은 로그·메트릭(IL loss, RL reward 곡선)을 스트리밍. 서브프로세스 미실행 | 없음 |
| `npm run backend:real` | 실제 | `python run.py <stage>`를 실제로 실행해 산출물(demos/·checkpoints/·outputs/) 생성 | `requirements.txt` |

- 평소 대시보드 UI/차트 확인은 mock으로 충분합니다.
- 실제 학습/데이터 생성이 필요할 때만 실제 모드를 씁니다. 먼저 의존성을 설치하세요:

  ```bash
  npm run install:pipeline   # = pip install -r requirements.txt (torch 등)
  npm run backend:real
  ```

  실제 모드에서 IL·RL·EXPORT는 선행 산출물이 있어야 하므로
  **ENV → COLLECT → IL → RL → EXPORT** 순서로 실행합니다. `configs/env.yaml`의
  `mock_mode: true` 덕분에 Isaac Sim 없이도 numpy 기반으로 동작합니다.

#### 데이터 디렉터리 위치 (Windows · OneDrive 주의)

`demos/`·`checkpoints/`·`outputs/`는 대용량(에피소드당 ~263MB, 데이터셋 GB 단위)입니다.
저장소가 **OneDrive 동기화 폴더 안**에 있으면 OneDrive가 이 파일들을 클라우드로 오프로드해,
실제 모드 IL이 데이터를 읽을 때 온디맨드 다운로드(하이드레이션)가 일어나 수십 분씩 느려집니다.

해결: 이 세 디렉터리를 OneDrive 밖(예: `C:\physicalai-data\`)에 두고 저장소에는
**디렉터리 정션**으로 연결합니다. 코드·설정 변경이 전혀 없고(상대 경로 그대로), 동기화도 안 됩니다.

```powershell
# 1) 데이터를 OneDrive 밖으로 이동 (같은 C: 볼륨이면 즉시)
New-Item -ItemType Directory -Force C:\physicalai-data | Out-Null
foreach ($d in 'demos','checkpoints','outputs') { Move-Item .\$d C:\physicalai-data\$d }

# 2) 저장소에 정션 생성 (관리자 권한 불필요)
foreach ($d in 'demos','checkpoints','outputs') { cmd /c mklink /J ".\$d" "C:\physicalai-data\$d" }
```

> 이미 OneDrive가 클라우드 전용으로 만든 파일이 있으면, 이동 전에 해당 파일을 한 번 읽어
> 로컬로 내려받아야(하이드레이션) placeholder가 깨지지 않습니다. `demos/` 등은 `.gitignore`
> 대상이라 정션으로 바꿔도 git에는 영향이 없습니다.

---

## 대시보드 페이지

| 메뉴 | 기능 |
|---|---|
| **Overview** | KPI 카드 · Pipeline Stages · Training Metrics · Live Log · Artifacts |
| **Run** | 스테이지별 실행 버튼 · 상태 배너 · 실시간 로그 |
| **Training** | RL Reward / IL Loss 차트 · 학습 지표 KPI |
| **Demos** | 수집된 HDF5 에피소드 목록 · Collect 실행 |
| **Artifacts** | 타입별 필터 (ONNX / HDF5 / PT / ZIP) · 다운로드 |
| **Config** | `configs/*.yaml` 읽기 전용 뷰어 |

---

## 설정 파일

### `configs/env.yaml`

```yaml
mock_mode: true          # Isaac Sim 없이 로컬 테스트
robot:
  num_joints: 7
  has_mobile_base: true
sensor:
  rgb:  { enabled: true, width: 224, height: 224 }
  depth: { enabled: true, width: 224, height: 224 }
```

### `configs/rl.yaml`

```yaml
algorithm: ppo           # ppo | sac
total_timesteps: 50000
learning_rate: 3.0e-4
gamma: 0.99
```

### `configs/il.yaml`

```yaml
epochs: 100
batch_size: 64
lr: 1.0e-4
hidden_dim: 256
```

---

## API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/health` | 헬스체크 |
| `GET` | `/api/status` | 현재 실행 중인 스테이지 |
| `POST` | `/api/run/{stage}` | 스테이지 실행 (`env·collect·il·rl·export`) |
| `GET` | `/api/logs/stream` | 실시간 로그 SSE 스트림 |
| `GET` | `/api/metrics/stream` | RL/IL 메트릭 SSE 스트림 |
| `GET` | `/api/artifacts` | 내보낸 파일 목록 |
| `GET` | `/api/demos` | 수집된 데모 HDF5 목록 |
| `GET` | `/api/config` | 전체 YAML 설정 조회 |

---

## 테스트

```bash
# Python 단위 테스트
pytest tests/

# 프론트엔드 컴포넌트 테스트
cd dashboard && npm test
```

---

## 노트북

| 노트북 | 설명 | 실행 |
|---|---|---|
| [ovrtx_minimal_colab.ipynb](notebooks/ovrtx_minimal_colab.ipynb) | NVIDIA OVRTX로 OpenUSD 씬 렌더링 → PNG 저장 | [![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/00saridon/PhysicalAI/blob/main/notebooks/ovrtx_minimal_colab.ipynb) |

---

## 기술 스택

**백엔드**
- Python · FastAPI · uvicorn · SSE-Starlette
- PyTorch · Stable-Baselines3 · ONNX · h5py

**프론트엔드**
- React 18 · TypeScript · Vite
- Tailwind CSS · Recharts · TanStack Query

**환경**
- NVIDIA Isaac Sim (Isaac Lab)
- NVIDIA Omniverse USD pipeline

---

## Contributing

현재 개인 프로젝트로 개발 중입니다.  
버그 리포트나 제안은 [Issues](https://github.com/00saridon/PhysicalAI/issues)에 남겨 주세요.

---

## License

MIT License © 2025 [hyunoh](https://github.com/00saridon)
