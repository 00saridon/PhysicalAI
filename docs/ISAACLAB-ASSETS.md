# Isaac Lab 에셋 연동 & 실데이터 구동 가이드

Simulation의 쇼룸 모델을 **실제 Isaac Lab 로봇/정책 데이터로 구동**하는 방법과,
**Unreal/Unity 리그 매핑** 규약을 정리합니다.

> 현재 대시보드의 3D 모델은 두 종류입니다.
> - **data-driven** (예: Franka 7-DOF Arm): `outputs/dataset/<name>.hdf5`의 `joint_state`로 구동.
> - **procedural** (ANYmal·Spot·H1·G1·Crazyflie): 시연용 절차적 모션.
>
> procedural 모델도 **데이터셋만 연결하면 실데이터 구동**으로 승격됩니다(아래 3단계).

---

## 1. Isaac Lab 로봇 에셋 (USD) 매핑

각 쇼룸 모델은 Isaac Lab의 사전 정의 로봇 cfg에 대응합니다
(`from omni.isaac.lab_assets import ...`). 실제 USD는 NVIDIA Nucleus에서 로드됩니다.

| 대시보드 모델 | Isaac Lab cfg | DOF | 비고 |
|---|---|---|---|
| Franka 7-DOF Arm | `FRANKA_PANDA_CFG` | 7(+그리퍼) | 본 프로젝트 정책의 기본 로봇 |
| ANYmal-D | `ANYMAL_D_CFG` | 12 | 4족 (각 다리 HAA/HFE/KFE) |
| Boston Dynamics Spot | `SPOT_CFG` | 12 | 4족 |
| Unitree H1 | `H1_CFG` | 19 | 이족 휴머노이드 |
| Unitree G1 | `G1_CFG` | 23 | 소형 휴머노이드 |
| Crazyflie | `CRAZYFLIE_CFG` | 4(로터) | 쿼드콥터 |

> 참고: Isaac Lab 쇼룸 데모 — <https://isaac-sim.github.io/IsaacLab/main/source/overview/showroom.html>
> (`arms.py`, `quadrupeds.py`, `bipeds.py`, `quadcopter.py` 등)

---

## 2. 로봇별 궤적 데이터셋 내보내기

대시보드는 `outputs/dataset/<name>.hdf5`를 읽습니다. 데이터셋 스키마:

| 키 | shape | 필수 | 설명 |
|---|---|---|---|
| `joint_state` | `[T, DOF]` | ✅ | 프레임별 관절 각도(rad) — 3D 리그 구동의 핵심 |
| `action` | `[T, A]` | – | 정책 출력(텔레메트리 표시용) |
| `reward` | `[T]` | – | 스텝 리워드 |
| `rgb` | `[T, H, W, 3]` uint8 | – | 센서 관측(있으면 RGB 패널 표시) |

**정식 익스포터**(`scripts/export_isaaclab_dataset.py`)를 Isaac Sim + Isaac Lab 머신에서 실행합니다.
정책을 롤아웃하며 `joint_state`(+action/reward)를 대시보드 스키마로 저장합니다.

```bash
# ANYmal-D 보행 (랜덤 정책) → outputs/dataset/anymal_v1.hdf5
python scripts/export_isaaclab_dataset.py --task Isaac-Velocity-Flat-Anymal-D-v0 --name anymal_v1 --steps 600
# Franka reach (학습 체크포인트)
python scripts/export_isaaclab_dataset.py --task Isaac-Reach-Franka-v0 --name synthetic_v1 --steps 400 --checkpoint policy.pt
```

| 모델(dataset) | Isaac Lab task (버전마다 명칭 상이) |
|---|---|
| `synthetic_v1` (Franka) | `Isaac-Reach-Franka-v0` / `Isaac-Lift-Cube-Franka-v0` |
| `anymal_v1` | `Isaac-Velocity-Flat-Anymal-D-v0` / `-Rough-` |
| `spot_v1` | `Isaac-Velocity-Flat-Spot-v0` |
| `h1_v1` | `Isaac-Velocity-Rough-H1-v0` / `-Flat-` |
| `g1_v1` | `Isaac-Velocity-Rough-G1-v0` / `-Flat-` |
| `crazyflie_v1` | `Isaac-Quadcopter-Direct-v0` |

> 관절 순서가 리그와 다르면 `--reorder "1,4,7,10,2,5,8,11,0,3,6,9"`로 재정렬합니다
> (원본 순서는 `env.scene["robot"].joint_names`로 확인). 백엔드는
> `GET /api/dataset/trajectory?name=<name>` 로 이 파일을 strided 제공합니다.

**적용 경로**
- **로컬**: 생성된 `outputs/dataset/<name>.hdf5`가 곧바로 사용됩니다(시드는 기존 파일을 덮어쓰지 않음).
- **클라우드(Railway)**: 작게 다운샘플한 실데이터 HDF5를 **`assets/datasets/<name>.hdf5`** 에 커밋하면
  Dockerfile이 빌드 시 `outputs/dataset/`로 복사해(시드보다 우선) 라이브에 반영합니다.

---

## 3. 대시보드 모델을 실데이터 구동으로 승격

`dashboard/src/sim/models.tsx`의 레지스트리 항목에 **`dataset`** 과 **`dataDriven: true`** 를 설정합니다.

```ts
{ id: 'anymal', name: 'ANYmal-D', category: 'Quadruped', dof: 12,
  dataDriven: true,            // ← procedural → 실데이터
  dataset: 'anymal_v1',        // ← outputs/dataset/anymal_v1.hdf5
  target: [0, 0.4, 0], camera: [1.7, 1.1, 2.0],
  Component: makeQuadruped({ body: '#2a3340', accent: NV }) },
```

- 페이지는 `model.dataset`이 있으면 그 궤적을 fetch하고, 프레임별 `joints`를 컴포넌트에 전달합니다.
- 컴포넌트는 `dataDriven`일 때 `joints[i]`를 자신의 DOF에 매핑합니다
  (`makeQuadruped`: `joints[0..3]→hip`, `joints[4..7]→knee` / `makeHumanoid`: `joints[0..3]→leg/arm`).
- 데이터셋이 없으면 자동으로 procedural 모션으로 폴백합니다(안전).

> 관절 순서가 다르면 컴포넌트의 매핑(`jref.current[i] → rotation`)만 로봇 URDF 순서에 맞춰 조정하면 됩니다.

---

## 4. Unreal / Unity 리그 매핑 규약

대시보드와 게임엔진은 **동일한 `joint_state[i]` 스트림**을 공유합니다. 매핑 계약:

```
joint_state[i]  →  엔진의 본/조인트 i 회전(rad)
```

1. **본 인덱스 매핑 테이블**을 만든다 (로봇 URDF 관절 순서 = 데이터셋 열 순서 = 엔진 본 순서).
   예) ANYmal: `[LF_HAA, LF_HFE, LF_KFE, RF_HAA, …]`.
2. 런타임에 궤적을 스트리밍:
   - 오프라인: `outputs/dataset/<name>.hdf5`를 엔진에서 직접 로드.
   - 온라인: `GET /api/dataset/trajectory?name=<name>` (JSON) 또는 정책 추론(ONNX)으로 매 프레임 `joint_state` 생성.
3. 각 본에 `SetRelativeRotation`(Unreal) / `localEulerAngles`(Unity)로 `joint_state[i]`를 적용.
4. ONNX 정책(`outputs/policy/policy.onnx`)을 엔진의 ONNX Runtime/Barracuda로 추론하면
   시뮬레이션 없이 실시간 구동도 가능합니다(`obs[14] → action`).

> 즉 대시보드의 3D는 "엔진 리그의 웹 프리뷰"이고, 동일한 데이터 계약으로 Unreal/Unity에 그대로 이식됩니다.

---

## 5. 새 로봇 추가 체크리스트

1. `models.tsx` `MODELS`에 항목 추가 (메타데이터 + three.js 컴포넌트, 또는 `makeQuadruped`/`makeHumanoid` 재사용).
2. (선택) 실데이터 구동: `outputs/dataset/<name>.hdf5` 생성 → `dataset`/`dataDriven` 설정.
3. `MODEL_ICON`에 아이콘 추가.
4. Demos 갤러리·Simulation 선택바에 자동 반영됩니다.

관련 문서: [UI-FLOW.md](UI-FLOW.md) · [README](../README.md)
