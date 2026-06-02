import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.subprocess_runner import SubprocessRunner
from api.routes.pipeline import router as pipeline_router
from api.routes.logs import router as logs_router
from api.routes.artifacts import router as artifacts_router
from api.routes.dataset import router as dataset_router

app = FastAPI(title="PhysicalAI Dashboard API")
app.state.runner = SubprocessRunner()

# CORS: 로컬 개발 + Netlify 프로덕션(프리뷰 포함) 허용
# ALLOWED_ORIGINS 환경변수로 추가 도메인 지정 가능 (쉼표 구분)
_default_origins = ["http://localhost:5173", "http://localhost:4173"]
_extra = os.getenv("ALLOWED_ORIGINS", "")
_origins = _default_origins + [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # any Netlify site/preview (the dashboard is hosted on *.netlify.app)
    allow_origin_regex=r"https://([a-z0-9-]+\.)*netlify\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pipeline_router)
app.include_router(logs_router)
app.include_router(artifacts_router)
app.include_router(dataset_router)

@app.get("/api/health")
async def health():
    return {"status": "ok"}
