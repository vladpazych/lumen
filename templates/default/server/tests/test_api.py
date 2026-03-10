from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from lumen_server import registry
from lumen_server.auth import read_auth_token
from lumen_server.web import create_app


def create_client() -> tuple[TestClient, str]:
    auth_path = Path(".authkey")
    if not auth_path.exists():
        auth_path.write_text("test-token\n")

    registry.discover("pipelines")
    token = read_auth_token()
    app = create_app()
    client = TestClient(app)
    return client, token


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_lists_pipelines() -> None:
    client, token = create_client()
    res = client.get("/pipelines", headers=auth_headers(token))
    assert res.status_code == 200
    assert [pipeline["id"] for pipeline in res.json()] == [
        "echo",
        "fal-nano-banana",
        "fal-nano-banana-2",
        "fal-nano-banana-pro",
        "z-image-turbo",
    ]


def test_rejects_missing_auth() -> None:
    client, _ = create_client()
    res = client.get("/pipelines")
    assert res.status_code == 401
    assert res.json()["code"] == "UNAUTHORIZED"


def test_get_pipeline() -> None:
    client, token = create_client()
    res = client.get("/pipelines/echo", headers=auth_headers(token))
    assert res.status_code == 200
    assert res.json()["id"] == "echo"


def test_generates_output() -> None:
    client, token = create_client()
    res = client.post(
        "/pipelines/echo/generate",
        headers=auth_headers(token),
        json={"prompt": "Hello world"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "completed"
    assert body["outputs"][0]["type"] == "image"
