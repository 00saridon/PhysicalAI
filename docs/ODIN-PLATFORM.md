# ODIN Platform — 3대 데이터/ML 비즈니스 모델

> PhysicalAI 로봇 학습 파이프라인 위에 올린 **ODIN Corp.** 의 상업화 레이어.
> 하나의 파이프라인에서 나오는 산출물(합성 데이터·학습 정책·학습 메트릭)을
> 세 가지 매출원으로 전환합니다.

이 문서는 비즈니스 레이어의 **아키텍처와 가치 사슬**을 정리합니다.
로봇 학습 파이프라인 자체는 [README.md](../README.md)를, UI 흐름은
[UI-FLOW.md](UI-FLOW.md)를 참고하세요.

---

## 한눈에 보기

| # | 모델 | 무엇을 파는가 | 백엔드 | 프론트 | 상태 |
|---|---|---|---|---|---|
| **#1** | **DaaS** (Data-as-a-Service) | 합성 데이터셋 (+ 파라미터 변형 주문 생성) | `routes/catalog.py` | `Datasets.tsx` | ✅ |
| **#2** | **Robotics MLOps SaaS** | 학습 파이프라인을 구독 서비스로 (실험 추적·레지스트리·GPU 사용량 과금) | `routes/mlops.py` | `MLOps.tsx` | ✅ |
| **#3** | **Skill/Policy Marketplace** | 학습된 정책(ONNX)을 계보·성능 기반으로 | `routes/policies.py` | `Marketplace.tsx` | ✅ |

세 모델은 **공통 인프라**(매니페스트 사이드카 + entitlements 원장 + billing 추상화)를
공유하며, 결제·다운로드 게이팅 로직을 한 벌만 유지합니다.

---

## 가치 사슬 (Value Chain)

세 모델은 독립 매출원이면서 동시에 하나의 닫힌 순환을 이룹니다.

```
                    ┌──────────────────────────────────────────────┐
                    │            PhysicalAI 학습 파이프라인           │
                    │   env → collect → IL(BC) → RL(PPO/SAC) → export │
                    └───────┬───────────────────────────┬──────────┘
                            │ 합성 데이터셋               │ 학습된 정책(ONNX)
                            ▼                            ▼
            ┌──────────────────────┐      ┌──────────────────────────┐
   ①  판매  │  #1 DaaS              │      │  #3 Policy Marketplace    │ ③ 판매
   ────────▶│  outputs/dataset/*.hdf5│      │  outputs/policy/*.onnx    │◀────────
            └──────────┬───────────┘      └────────────▲─────────────┘
                       │ ② 그 데이터로 학습              │ 등록(promote)
                       ▼                                │
            ┌────────────────────────────────────────┴─────────────┐
            │  #2 Robotics MLOps SaaS                                │
            │  실험 제출 → 학습곡선·리더보드 → 체크포인트를 정책으로 등록 │
            │  (GPU-분 사용량을 구독 플랜 쿼터에 과금)                  │
            └───────────────────────────────────────────────────────┘
```

1. **데이터 판매(#1)** — 파이프라인이 만든 합성 데이터셋을 마켓에 올려 판매.
2. **그 데이터로 학습(#2)** — 고객/내부가 데이터셋을 골라 학습 작업을 제출, 메트릭을 추적.
3. **학습 결과를 정책으로 판매(#3)** — 잘 나온 체크포인트를 한 번의 "등록"으로
   마켓플레이스 상품(가격·라이선스 포함)으로 승격. 정책에는 **어떤 데이터로 학습됐는지**
   (`trained_on`) 계보가 박혀 있어 #1로 다시 연결됩니다.

> 핵심 연결고리 = **Model #2 → #3 핸드오프**:
> `POST /api/experiments/{id}/register` 한 번이 실험의 메트릭·계보를 들고
> 실제 ONNX를 내보내 판매 가능한 정책 매니페스트를 생성합니다.

---

## 공통 인프라

세 모델이 공유하는 세 가지 빌딩블록. 새 상품 종류를 추가해도 이 패턴만 따르면 됩니다.

### 1. 매니페스트 사이드카 (Manifest Sidecar)

바이너리 에셋 옆에 두는 JSON 한 개가 **카탈로그·라이선싱·과금의 단일 진실원천**.

| 에셋 | 사이드카 | 빌더 |
|---|---|---|
| `outputs/dataset/<id>.hdf5` | `<id>.manifest.json` | `export/manifest.py` |
| `outputs/policy/<id>.onnx` | `<id>.policy.json` | `export/policy_manifest.py` |

- 매니페스트에 `tier`(free/paid)·`price_usd`·`license`·`checksum_sha256`·메타데이터가 들어감.
- 라우트는 디렉터리를 스캔해 매니페스트를 읽어 카탈로그를 구성 → **DB 없이도** 상품 목록이 성립.
- 정책 매니페스트는 추가로 `trained_on`(데이터 계보)·`metrics`(success_rate 등)·`algo`를 담아
  #1·#2와의 연결을 표현.

### 2. Entitlements 원장 (라이선스/소유권)

`api/entitlements_store.py` — SQLite. **상품 종류에 무관**(product_id 키 기반)하므로
데이터셋과 정책이 동일 원장을 공유합니다.

- 라이선스 키 형식: `ODIN-XXXX-XXXX-XXXX`
- 유료 다운로드는 게이팅: 유효 키 없으면 **HTTP 402**, 무료는 개방
- 테이블: `entitlements`(소유권), `checkout_sessions`(결제 세션)

### 3. Billing 추상화 (`api/billing.py`)

두 프로바이더, 하나의 충족(fulfillment) 경로.

```
checkout ──┬─ stripe (STRIPE_SECRET_KEY 있을 때) ─ 웹훅 ─┐
           └─ mock   (키 없을 때, 키리스)  ─ mock-pay ──┤
                                                       ▼
                                        billing.fulfill() → store.grant()
                                              → 라이선스 키 발급 → 게이트 해제
```

- `stripe_enabled()`가 `STRIPE_SECRET_KEY` 유무로 모드를 자동 결정.
- 두 경로 모두 `fulfill()` 한 곳으로 수렴 → 다운로드 게이팅 로직은 손대지 않음.
- 자세한 점검·go-live 절차는 아래 [결제(Stripe) 운영](#결제stripe-운영) 참고.

---

## 모델별 상세

### #1 — DaaS (Data-as-a-Service)

합성 로봇 데이터셋을 판매. Isaac 파이프라인의 도메인 랜덤화를 **주문형 변형 생성**으로
제품화한 것이 차별점.

| 구성 | 위치 |
|---|---|
| 라우트 | `api/routes/catalog.py` |
| 변형 생성기 | `randomization.py` (조명/텍스처/물리 + strength) — 결정론적, GPU 불필요 |
| 매니페스트 | `export/manifest.py` |
| 프론트 | `dashboard/src/pages/Datasets.tsx` |

주요 엔드포인트:
- `GET /api/catalog` — 데이터셋 목록 / `GET /api/catalog/{id}` — 상세
- `POST /api/catalog/{id}/generate` — 파라미터 변형 주문 생성(재사용 캐시)
- `GET /api/catalog/{id}/download?key=` — 유료 게이팅 다운로드

### #2 — Robotics MLOps SaaS

학습 파이프라인 자체를 구독 서비스로. 실험 추적 → 리더보드 → 모델 레지스트리 →
GPU-시간 사용량 과금.

| 구성 | 위치 |
|---|---|
| 라우트 | `api/routes/mlops.py` |
| 실험/사용량 스토어 | `mlops/experiments_store.py` (SQLite `outputs/experiments.db`) |
| 학습 시뮬레이터 | `mlops/runner.py` (md5 시드 결정론적 학습곡선, GPU 불필요) |
| 프론트 | `dashboard/src/pages/MLOps.tsx` |

구독 플랜(`PLANS`): Free(60 GPU-min)·Team($299/mo, 3000)·Scale($1499/mo, 20000).

주요 엔드포인트:
- `POST /api/experiments` — 학습 작업 제출(시뮬) / `GET /api/experiments` — 목록
- `GET /api/experiments/leaderboard` — 성공률 순 랭킹
- `POST /api/experiments/{id}/register` — **#3로 승격(핸드오프)**
- `GET /api/mlops/usage` — 플랜 쿼터 대비 GPU 사용량 / `POST /api/mlops/plan` — 플랜 변경

가격 책정(`_price_for`): 성공률 ≥0.9 → $999, ≥0.8 → $699, ≥0.7 → $499, 그 외 $299.

### #3 — Skill/Policy Marketplace

학습된 정책(ONNX)을 상품으로. 차별점은 **계보**(`trained_on` 데이터셋)와
**성능 메트릭**(success_rate·mean_reward).

| 구성 | 위치 |
|---|---|
| 라우트 | `api/routes/policies.py` |
| 매니페스트 | `export/policy_manifest.py` |
| 시드 스크립트 | `scripts/seed_policies.py` (로봇별 실 ONNX 내보내기) |
| ONNX 내보내기 | `export/policy_exporter.py` + `trainer/il/policy.py`(MLPPolicy) |
| 프론트 | `dashboard/src/pages/Marketplace.tsx` |

주요 엔드포인트:
- `GET /api/policies` — 정책 목록(가격 내림차순) / `GET /api/policies/{id}` — 상세
- `GET /api/policies/{id}/download?key=` — 유료 게이팅 다운로드

---

## 데이터 흐름: 등록(register) 핸드오프

가장 중요한 통합 지점. 실험 한 건을 판매 가능한 정책으로 바꾸는 단일 호출.

```
POST /api/experiments/{id}/register
   │
   ├─ 1. 실험 조회 (이미 등록됐으면 idempotent 반환)
   ├─ 2. 로봇별 obs/action 차원으로 MLPPolicy 구성
   ├─ 3. PolicyExporter → 구조적으로 유효한 ONNX 내보내기 (outputs/policy/reg_*.onnx)
   ├─ 4. build_policy_manifest() + 실험 메트릭·계보 주입:
   │       trained_on = 실험의 dataset,  metrics = 실험의 success_rate/reward,
   │       price_usd = _price_for(success_rate),  registered_from = 실험 id
   ├─ 5. save_policy_manifest() → 사이드카 기록 → 마켓에 즉시 노출
   └─ 6. store.set_registered_policy() → 실험에 정책 id 역참조
```

결과: MLOps 테이블의 행이 "✓ 등록됨"으로 바뀌고, 동일 정책이 Marketplace에
가격·계보·메트릭과 함께 등장합니다.

---

## 관리자 — 매출 분석 대시보드

매출·구독은 **기업 기밀**이므로 일반 Overview가 아닌 **별도 관리자 페이지**(`Admin.tsx`)에서만
열람합니다. 세 모델의 매출·재고·사용량을 한 스냅샷으로 합산하는 크로스모델 집계기입니다.

| 구성 | 위치 |
|---|---|
| 라우트 | `api/routes/business.py` |
| 집계 소스 | `entitlements_store.list_sales()`(결제 원장) + `scan_catalog`/`scan_policies`(가격) + `mlops_store.usage_summary()` |
| 프론트 | `dashboard/src/pages/Admin.tsx` |

**인증** — admin 토큰 게이팅. 백엔드 env `ADMIN_TOKEN`(기본값 `odin-admin`)과 일치해야 하며,
모든 응답은 `X-Admin-Token` 헤더를 요구합니다. 프론트는 패스코드를 `localStorage`에 저장하고
토큰이 만료/무효(401)면 자동으로 잠금 화면으로 복귀합니다.

**매출 정의** — "판매"는 **결제된 entitlement**(`source ∈ {mock, stripe}`)만 집계하며,
manual/dev 수동 발급은 제외합니다. 각 판매를 상품 가격·종류와 조인해 모델별로 분해합니다.

주요 엔드포인트:
- `POST /api/admin/login` — 패스코드 검증(게이트 해제용)
- `GET /api/business/summary` — 통합 스냅샷(아래 구성요소)
- `GET /api/business/sales.csv` — 전체 판매 원장 CSV 내보내기(회계용, 첨부 다운로드)

`/api/business/summary` 응답 구성:
- `revenue` — 실현 매출·주문수·구독 MRR·카탈로그 가치, `by_model`로 데이터셋/정책 분해
- `recent_sales` — 최신 판매 12건(상품·종류·금액·결제수단·구매자·시각)
- `top_products` — 상품별 매출 랭킹 상위 8개(판매 건수·누적 매출)
- `revenue_trend` — 일별 매출/주문 + 누적 매출(차트용, 날짜 오름차순)
- `datasets`/`policies`/`mlops` — 모델별 재고·사용량 요약

대시보드 구성(위→아래): **KPI 카드 → 모델별 카드 → 매출 분해 막대 → 매출 추세 차트
(recharts) → 상품 랭킹 → 판매 내역 테이블**, 헤더에 CSV 내보내기·잠금 버튼.

---

## 파일 맵 (비즈니스 레이어)

```
PhysicalAI/
├─ api/
│  ├─ billing.py                 # Stripe/mock 결제 추상화 (공통)
│  ├─ entitlements_store.py      # 라이선스/세션 원장 (공통, SQLite)
│  └─ routes/
│      ├─ catalog.py             # #1 DaaS
│      ├─ entitlements.py        # 라이선스 발급/조회 (공통)
│      ├─ billing.py             # 체크아웃/웹훅 (공통)
│      ├─ policies.py            # #3 Marketplace
│      ├─ mlops.py               # #2 MLOps SaaS + 등록 핸드오프
│      └─ business.py            # 관리자 매출 집계 + CSV (크로스모델, admin-게이트)
├─ randomization.py              # #1 변형 생성기
├─ export/
│  ├─ manifest.py                # #1 데이터셋 매니페스트
│  ├─ policy_manifest.py         # #3 정책 매니페스트
│  └─ policy_exporter.py         # ONNX 내보내기
├─ mlops/
│  ├─ experiments_store.py       # #2 실험·사용량 스토어
│  └─ runner.py                  # #2 학습 시뮬레이터
├─ scripts/seed_policies.py      # #3 초기 정책 시드
└─ dashboard/src/pages/
   ├─ Datasets.tsx               # #1 스토어프론트
   ├─ MLOps.tsx                  # #2 콘솔
   ├─ Marketplace.tsx            # #3 스토어프론트
   └─ Admin.tsx                  # 관리자 매출 분석 대시보드 (기밀, 패스코드 게이트)
```

---

## 결제(Stripe) 운영

현재 키가 없으면 **mock 모드**로 동작하며, 키리스로 전체 데모가 가능합니다.

**실제 결제 켜기 (코드 수정 불필요):**

1. 백엔드 env에 `STRIPE_SECRET_KEY=sk_live_...`(테스트는 `sk_test_...`) 설정
   → `stripe_enabled()`가 자동으로 stripe 모드로 전환.
2. Stripe 대시보드에서 웹훅 엔드포인트 `POST /api/billing/webhook` 등록
   (`checkout.session.completed` 이벤트), 발급 시크릿을 `STRIPE_WEBHOOK_SECRET=whsec_...`로.
3. `pip install -r requirements-api.txt`로 `stripe` 패키지 설치 확인.

프론트(Datasets/Marketplace)는 stripe 모드 응답에 `checkout_url`이 있으면
Stripe 호스티드 결제 페이지로 리다이렉트하고, 웹훅이 `fulfill()`을 호출해 라이선스 키를
발급 → 다운로드 게이트가 해제됩니다.

**검증 완료 항목:** mock 결제(데이터셋·정책) end-to-end, Stripe API 표면,
키 감지(`stripe_enabled`), 체크아웃 실 배선, 웹훅 서명 위조 거부, 프론트 분기.

---

## 설계 원칙

- **GPU 없이 데모 가능** — 변형 생성기·학습 시뮬레이터는 결정론적 mock. `MOCK_PIPELINE`과 동일 철학.
- **상품 종류에 무관한 결제** — entitlements는 `product_id`만 알면 됨 → 새 상품 종류 추가가 쉬움.
- **매니페스트가 진실원천** — DB 없이도 카탈로그 성립, 사이드카만 옮기면 상품이 이동.
- **닫힌 가치 사슬** — 데이터 → 학습 → 정책이 계보로 연결되어 한 모델의 산출이 다음 모델의 입력이 됨.
