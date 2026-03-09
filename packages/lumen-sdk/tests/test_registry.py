from __future__ import annotations

import sys
from pathlib import Path

from lumen_sdk import registry


def test_discover_collects_serve_secrets(tmp_path: Path):
    pipelines_dir = tmp_path / "pipelines"
    pipelines_dir.mkdir()
    (pipelines_dir / "__init__.py").write_text("")
    (pipelines_dir / "alpha.py").write_text(
        "\n".join(
            [
                "from lumen_sdk import GenerateResult, PipelineConfig, PipelineOutput",
                'serve_secrets = ["fal-api-key", "shared-secret"]',
                'config = PipelineConfig(id="alpha", name="Alpha", output=PipelineOutput())',
                "async def generate(params):",
                '    return GenerateResult(status="completed", run_id="a", outputs=[])',
                "",
            ]
        )
    )
    (pipelines_dir / "beta.py").write_text(
        "\n".join(
            [
                "from lumen_sdk import GenerateResult, PipelineConfig, PipelineOutput",
                'serve_secrets = ["shared-secret", "replicate-api-key"]',
                'config = PipelineConfig(id="beta", name="Beta", output=PipelineOutput())',
                "async def generate(params):",
                '    return GenerateResult(status="completed", run_id="b", outputs=[])',
                "",
            ]
        )
    )

    registry._registry.clear()
    sys.modules.pop("pipelines", None)
    sys.modules.pop("pipelines.alpha", None)
    sys.modules.pop("pipelines.beta", None)

    registry.discover(str(pipelines_dir))

    assert registry.list_serve_secrets() == [
        "fal-api-key",
        "shared-secret",
        "replicate-api-key",
    ]


def test_discover_rejects_invalid_serve_secrets(tmp_path: Path):
    pipelines_dir = tmp_path / "pipelines"
    pipelines_dir.mkdir()
    (pipelines_dir / "__init__.py").write_text("")
    (pipelines_dir / "broken.py").write_text(
        "\n".join(
            [
                "from lumen_sdk import GenerateResult, PipelineConfig, PipelineOutput",
                'serve_secrets = "fal-api-key"',
                'config = PipelineConfig(id="broken", name="Broken", output=PipelineOutput())',
                "async def generate(params):",
                '    return GenerateResult(status="completed", run_id="x", outputs=[])',
                "",
            ]
        )
    )

    registry._registry.clear()
    sys.modules.pop("pipelines", None)
    sys.modules.pop("pipelines.broken", None)

    try:
        registry.discover(str(pipelines_dir))
    except TypeError as exc:
        assert "serve_secrets must be a list or tuple" in str(exc)
    else:
        raise AssertionError("Expected invalid serve_secrets to raise TypeError")
