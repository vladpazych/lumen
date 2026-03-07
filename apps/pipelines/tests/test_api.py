"""Contract compliance tests — validates the 4-endpoint API against expected shapes."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import web_app


@pytest.fixture
def client():
    return TestClient(web_app)


class TestListPipelines:
    def test_returns_list(self, client: TestClient):
        res = client.get("/pipelines")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_manifest_shape(self, client: TestClient):
        res = client.get("/pipelines")
        manifest = res.json()[0]
        assert "id" in manifest
        assert "name" in manifest
        assert "category" in manifest
        assert manifest["category"] in ("image", "video")
        # Manifest should NOT include params or output
        assert "params" not in manifest
        assert "output" not in manifest


class TestGetPipeline:
    def test_returns_config(self, client: TestClient):
        res = client.get("/pipelines/echo")
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == "echo"
        assert "params" in data
        assert "output" in data
        assert isinstance(data["params"], list)

    def test_params_have_type_and_name(self, client: TestClient):
        res = client.get("/pipelines/echo")
        for param in res.json()["params"]:
            assert "type" in param
            assert "name" in param

    def test_not_found(self, client: TestClient):
        res = client.get("/pipelines/nonexistent")
        assert res.status_code == 404


class TestGenerate:
    def test_returns_completed(self, client: TestClient):
        res = client.post("/pipelines/echo/generate", json={"prompt": "hello world"})
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "completed"
        assert "runId" in data
        assert isinstance(data["outputs"], list)
        assert len(data["outputs"]) > 0

    def test_output_asset_shape(self, client: TestClient):
        res = client.post("/pipelines/echo/generate", json={"prompt": "test"})
        asset = res.json()["outputs"][0]
        assert "url" in asset
        assert "type" in asset
        assert asset["type"] in ("image", "video")

    def test_not_found(self, client: TestClient):
        res = client.post("/pipelines/nonexistent/generate", json={})
        assert res.status_code == 404


class TestGetRun:
    def test_returns_status(self, client: TestClient):
        res = client.get("/pipelines/echo/runs/abc123")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] in ("completed", "running", "queued", "failed")
        assert data["runId"] == "abc123"
