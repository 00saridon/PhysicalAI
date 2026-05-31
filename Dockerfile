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

# configs, demos, checkpoints, outputs 디렉터리 생성 + 데모용 샘플 artifact 파일 생성
RUN mkdir -p configs demos checkpoints/il checkpoints/rl outputs/policy outputs/dataset && \
    python3 -c "import os; [open(f, 'wb').write(b'MOCK' * 1024) for f in ['outputs/policy/policy.onnx', 'outputs/dataset/synthetic_v1.hdf5', 'checkpoints/il/best.pt', 'checkpoints/rl/best.zip']]"

# Railway는 PORT 환경변수를 자동 주입
ENV MOCK_PIPELINE=true

EXPOSE 8000

CMD uvicorn api.main:app --host 0.0.0.0 --port ${PORT:-8000}
