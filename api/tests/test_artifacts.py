import pytest
from httpx import AsyncClient, ASGITransport
from api.main import app


@pytest.mark.anyio
async def test_list_artifacts_returns_list():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/artifacts")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


@pytest.mark.anyio
async def test_download_missing_artifact_404():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/artifacts/nonexistent_id/download")
    assert r.status_code == 404
