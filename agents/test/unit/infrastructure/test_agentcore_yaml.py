from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType


def _load_yaml_tool() -> ModuleType:
    path = Path(__file__).parents[3] / "scripts" / "agentcore-yaml.py"
    spec = importlib.util.spec_from_file_location("agentcore_yaml", path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_set_lifecycle_defaults_preserves_other_values(tmp_path: Path) -> None:
    manifest = tmp_path / ".bedrock_agentcore.yaml"
    manifest.write_text(
        """agents:
  finantutor:
    name: finantutor
    aws:
      lifecycle_configuration:
        idle_runtime_session_timeout: null
        max_lifetime: null
    bedrock_agentcore:
      agent_id: runtime-123
"""
    )

    _load_yaml_tool().set_lifecycle_defaults(manifest)

    assert (
        manifest.read_text()
        == """agents:
  finantutor:
    name: finantutor
    aws:
      lifecycle_configuration:
        idle_runtime_session_timeout: 900
        max_lifetime: 28800
    bedrock_agentcore:
      agent_id: runtime-123
"""
    )
