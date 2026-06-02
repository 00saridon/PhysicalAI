FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성
COPY requirements-railway.txt .
RUN pip install --no-cache-dir -r requirements-railway.txt

# 소스 복사
COPY . .

# Seed demo artifacts. Real Isaac Lab trajectories committed under
# assets/datasets/ take precedence; the seed script only fills what's missing
# (representative data) so the Simulation / dataset endpoints always work.
RUN mkdir -p configs demos checkpoints/il checkpoints/rl outputs/policy outputs/dataset && \
    python3 -c "[open(f, 'wb').write(b'MOCK' * 1024) for f in ['outputs/policy/policy.onnx', 'checkpoints/il/best.pt', 'checkpoints/rl/best.zip']]" && \
    (cp -n assets/datasets/*.hdf5 outputs/dataset/ 2>/dev/null || true) && \
    python3 scripts/seed_demo_data.py

# Railway는 PORT 환경변수를 자동 주입
ENV MOCK_PIPELINE=true

EXPOSE 8000

CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}
