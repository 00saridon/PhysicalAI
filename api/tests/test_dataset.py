import h5py
import numpy as np
import pytest
from httpx import AsyncClient, ASGITransport

from api.main import app
from api.routes import dataset as dataset_route


@pytest.fixture
def dataset_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(dataset_route, "_DATASET_DIR", tmp_path)
    return tmp_path


async def _get(path):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        return await client.get(path)


@pytest.mark.anyio
async def test_trajectory_passes_motion_metadata(dataset_dir):
    n = 100
    with h5py.File(dataset_dir / "dance.hdf5", "w") as f:
        f.create_dataset("joint_state", data=np.zeros((n, 29), np.float32))
        f.create_dataset("root", data=np.tile([0.0, -0.01, 0.0, 0.5], (n, 1)).astype(np.float32))
        f.attrs["layout"] = "g1_29dof"
        f.attrs["fps"] = 30

    r = await _get("/api/dataset/trajectory?name=dance&frames=50")
    assert r.status_code == 200
    d = r.json()
    assert d["layout"] == "g1_29dof"
    assert d["stride"] == 2 and d["fps"] == 15.0          # fps is per returned (strided) frame
    assert len(d["root"]) == d["count"] == 50
    assert d["root"][0] == pytest.approx([0.0, -0.01, 0.0, 0.5])


@pytest.mark.anyio
async def test_trajectory_without_metadata_returns_nulls(dataset_dir):
    with h5py.File(dataset_dir / "walk.hdf5", "w") as f:
        f.create_dataset("joint_state", data=np.zeros((10, 23), np.float32))

    d = (await _get("/api/dataset/trajectory?name=walk")).json()
    assert d["layout"] is None and d["fps"] is None and d["root"] is None
    assert d["joint_dim"] == 23
