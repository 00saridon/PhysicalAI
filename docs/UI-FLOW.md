# PhysicalAI 대시보드 — UI 동작 흐름

대시보드의 화면 구성과 사용자 상호작용 과정을 체계적으로 정리한 문서입니다.
(프론트엔드: React + Vite + TailwindCSS · 백엔드: FastAPI · 통신: REST + SSE)

---

## 1. 화면 구성 (사이드바 페이지)

| 메뉴 | 역할 | 핵심 컴포넌트 |
|------|------|--------------|
| **Overview** | 홈. 소개 HERO · UI 워크플로우 · 아키텍처 · 파이프라인 제어 · KPI · 실시간 로그/차트 · 산출물 | `WorkflowSection`, `PipelineBar`, `RewardChart`, `LogPanel` |
| **Run** | 스테이지 실행 전용 화면. 상태 배너 + 스테이지 버튼 + 라이브 로그 | `PipelineBar`, `useSSELogs` |
| **Training** | RL Reward / IL Loss 차트와 학습 지표 KPI | `RewardChart`, `useSSEMetrics` |
| **Demos** | 수집된 데모(HDF5) 목록 | `useDemos` |
| **Simulation** | 합성 궤적을 7-DOF 로봇 암으로 3D 재생 (Three.js) | `Simulation`, `/api/dataset/*` |
| **Artifacts** | ONNX·HDF5·체크포인트 목록/다운로드 | `ArtifactList`, `useArtifacts` |
| **Config** | `configs/*.yaml` 설정 조회 | `useConfig` |

상단 바(TopBar): 우측에 **MOCK_MODE / REAL_MODE 토글**과 **New Run** 버튼.

---

## 2. 핵심 워크플로우 (4단계)

```
① 모드 선택 ──▶ ② 파이프라인 실행 ──▶ ③ 실시간 모니터링 ──▶ ④ 산출물 · 3D
  MOCK/REAL      ENV→…→EXPORT          SSE 로그·차트          Artifacts·Simulation
```

### ① 모드 선택 — MOCK / REAL
- TopBar의 세그먼트 토글이 백엔드의 **단일 모드 플래그**(`runner.mock_mode`)를 설정합니다.
- `POST /api/mode {mock: bool}` → 실행 중이면 `409`로 거부, 아니면 즉시 전환.
- **MOCK**: 서브프로세스를 띄우지 않고 사실적인 로그·메트릭을 스트리밍(의존성 불필요).
- **REAL**: `python run.py <stage>` 서브프로세스를 실제 실행(산출물 생성).

### ② 파이프라인 실행 — ENV → COLLECT → IL → RL → EXPORT
- 스테이지 버튼 → `POST /api/run/{stage}` → 백엔드 `SubprocessRunner`가 실행.
- 동시에 하나만 실행(이미 실행 중이면 `409`).
- REAL 모드에서는 **선행 산출물**이 있어야 다음 단계가 가능:

  | 스테이지 | 선행조건 | 출력 |
  |---------|----------|------|
  | env | 없음 | (환경 검증) |
  | collect | 없음 | `demos/*.hdf5` |
  | il | `demos/episode_0000.hdf5` | `checkpoints/il/best.pt` |
  | rl | `checkpoints/il/best.pt` | `checkpoints/rl/best.zip` |
  | export | `checkpoints/rl/best.zip` | `outputs/policy/policy.onnx`, `outputs/dataset/synthetic_v1.hdf5` |

### ③ 실시간 모니터링 — SSE
- `GET /api/logs/stream` (로그) · `GET /api/metrics/stream` (메트릭) — Server-Sent Events.
- 프론트 훅 `useSSELogs` / `useSSEMetrics`가 구독 → Live Log, RewardChart에 실시간 반영.
- `GET /api/status`(2초 폴링)로 실행 여부/현재 스테이지 표시.

### ④ 산출물 · 3D
- `GET /api/artifacts` → Artifacts 페이지 및 Overview의 "파이프라인 실행 상태" 패널(라이브)이 사용.
- **Simulation**: `GET /api/dataset/trajectory`(joint_state·action·reward) + `GET /api/dataset/frame`(RGB PNG)로 3D 암을 재생. REAL EXPORT가 끝나면(`running → idle`) 궤적이 **자동 갱신**됩니다.

---

## 3. 데이터 흐름 (런타임)

```
┌─ 브라우저(React) ─────────┐   REST   ┌─ FastAPI ───────────────┐  spawn  ┌─ run.py ─┐
│ 페이지·토글·버튼          │ ───────▶ │ /api/run·mode·status     │ ──────▶ │ <stage>  │
│ Live Log·차트·3D          │ ◀─SSE──  │ /api/logs·metrics/stream │ ◀─stdout│ 서브프로세스│
└──────────────────────────┘          │ SubprocessRunner          │         └──────────┘
   Vite proxy /api ──▶ :8000          │  └ mock_mode 분기          │             │ R/W
                                       └───────────────────────────┘             ▼
                                                                          demos·checkpoints·outputs
```

- **로컬**: Vite dev 서버(`:5173`)가 `/api/*`를 백엔드(`:8000`)로 프록시.
- **배포**: Netlify(프론트) → Railway(백엔드). 프론트는 `VITE_API_URL`로 Railway를 호출하며, 백엔드 CORS가 `*.netlify.app`을 허용합니다.

---

## 4. 상태 머신 (스테이지 실행)

```
        POST /api/run/{stage}
 idle ───────────────────────▶ running(stage)
   ▲                               │
   │   SSE: done | error           │  (subprocess 종료)
   └───────────────────────────────┘
```

- `running` 중에는 스테이지 버튼·모드 토글이 비활성화됩니다.
- 종료 시 `done`(exit 0) 또는 `error`(exit≠0) 이벤트가 SSE로 방송됩니다.
- `running → idle` 전환 시 Simulation은 궤적/RGB를 자동 재요청합니다.

---

## 5. UI가 호출하는 API 요약

| 메서드 | 경로 | 용도 |
|--------|------|------|
| GET | `/api/health` | 헬스 체크 |
| GET | `/api/status` | 실행 여부·현재 스테이지 (2s 폴링) |
| GET/POST | `/api/mode` | MOCK/REAL 조회·전환 |
| POST | `/api/run/{stage}` | 스테이지 실행 |
| GET | `/api/logs/stream` | 로그 SSE |
| GET | `/api/metrics/stream` | 메트릭 SSE |
| GET | `/api/artifacts` | 산출물 목록 |
| GET | `/api/demos` | 데모 목록 |
| GET | `/api/config` | 설정(YAML) 조회 |
| GET | `/api/dataset/trajectory` | 3D 재생용 궤적(joint/action/reward) |
| GET | `/api/dataset/frame` | 합성 RGB 프레임(PNG) |

---

자세한 실행 방법·배포는 [README](../README.md)를 참고하세요.
