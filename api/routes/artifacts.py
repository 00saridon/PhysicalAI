import hashlib
from pathlib import Path

import yaml
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()

_ROOT = Path(__file__).parent.parent.parent  # PhysicalAI/
_SCAN_DIRS = ["outputs/policy", "outputs/dataset", "checkpoints/il", "checkpoints/rl"]
_EXTENSIONS = {".onnx", ".hdf5", ".pt", ".zip"}
_TYPE_MAP = {".onnx": "onnx", ".hdf5": "hdf5", ".pt": "pt", ".zip": "zip"}


def _scan_artifacts() -> list[dict]:
    results = []
    for d in _SCAN_DIRS:
        base = _ROOT / d
        if not base.exists():
            continue
        for p in base.iterdir():
            if p.suffix in _EXTENSIONS:
                artifact_id = hashlib.md5(str(p).encode()).hexdigest()[:12]
                stat = p.stat()
                results.append({
                    "id": artifact_id,
                    "name": p.name,
                    "path": str(p.relative_to(_ROOT)),
                    "size_bytes": stat.st_size,
                    "type": _TYPE_MAP[p.suffix],
                    "created_at": str(int(stat.st_mtime)),
                })
    results.sort(key=lambda x: x["created_at"], reverse=True)
    return results


@router.get("/api/artifacts")
async def list_artifacts():
    return _scan_artifacts()


@router.get("/api/artifacts/{artifact_id}/download")
async def download_artifact(artifact_id: str):
    for art in _scan_artifacts():
        if art["id"] == artifact_id:
            full_path = _ROOT / art["path"]
            if not full_path.exists():
                raise HTTPException(status_code=404, detail="File not found on disk")
            return FileResponse(path=str(full_path), filename=art["name"])
    raise HTTPException(status_code=404, detail=f"Artifact {artifact_id!r} not found")


@router.get("/api/demos")
async def list_demos():
    demos_dir = _ROOT / "demos"
    if not demos_dir.exists():
        return []
    results = []
    for p in sorted(demos_dir.iterdir()):
        if p.suffix == ".hdf5":
            stat = p.stat()
            results.append({
                "name": p.name,
                "path": str(p.relative_to(_ROOT)),
                "size_bytes": stat.st_size,
                "created_at": int(stat.st_mtime),
            })
    return results


@router.get("/api/config")
async def get_config():
    configs = {}
    for name in ("env", "rl", "il", "collector", "export"):
        path = _ROOT / "configs" / f"{name}.yaml"
        if path.exists():
            with open(path) as f:
                configs[name] = yaml.safe_load(f)
    return configs
