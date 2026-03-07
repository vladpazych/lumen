"""Pytest fixtures for pipeline contract tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from lumen_server import registry
from lumen_server.app import create_app


@pytest.fixture
def client():
    """TestClient with auth key. Discovers pipelines from ./pipelines/."""
    registry.discover("pipelines")
    web_app = create_app()
    from lumen_server.app import _read_auth_key

    key = _read_auth_key()
    return TestClient(web_app, headers={"Authorization": f"Bearer {key}"})


class TestAuth:
    def test_rejects_missing_token(self):
        registry.discover("pipelines")
        web_app = create_app()
        client = TestClient(web_app)
        res = client.get("/pipelines")
        assert res.status_code == 401

    def test_rejects_bad_token(self):
        registry.discover("pipelines")
        web_app = create_app()
        client = TestClient(web_app, headers={"Authorization": "Bearer wrong"})
        res = client.get("/pipelines")
        assert res.status_code == 401


class TestListPipelines:
    def test_returns_list(self, client: TestClient):
        res = client.get("/pipelines")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0

    def test_config_shape(self, client: TestClient):
        res = client.get("/pipelines")
        config = res.json()[0]
        assert "id" in config
        assert "name" in config
        assert "category" in config
        assert config["category"] in ("image", "video")
        assert "params" in config
        assert "output" in config


class TestGetPipeline:
    def test_params_have_type_and_name(self, client: TestClient):
        pipelines = client.get("/pipelines").json()
        for pipeline in pipelines:
            res = client.get(f"/pipelines/{pipeline['id']}")
            assert res.status_code == 200
            for param in res.json()["params"]:
                assert "type" in param, f"Param missing 'type' in {pipeline['id']}"
                assert "name" in param, f"Param missing 'name' in {pipeline['id']}"

    def test_not_found(self, client: TestClient):
        res = client.get("/pipelines/nonexistent")
        assert res.status_code == 404


class TestGenerate:
    def test_not_found(self, client: TestClient):
        res = client.post("/pipelines/nonexistent/generate", json={})
        assert res.status_code == 404
