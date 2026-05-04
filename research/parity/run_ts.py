"""Run the canonical TypeScript implementation as a subprocess and return JSON."""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

from .scenario import Scenario


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
TS_SCRIPT = REPO_ROOT / "backend" / "src" / "test" / "headless_parity.ts"


class TsBridgeError(RuntimeError):
    pass


def _find_tsx() -> Optional[str]:
    """Look for tsx (via the backend's local node_modules first)."""
    backend_bin = REPO_ROOT / "backend" / "node_modules" / ".bin" / "tsx"
    if backend_bin.exists():
        return str(backend_bin)
    # Otherwise try PATH
    from shutil import which

    path_tsx = which("tsx")
    if path_tsx:
        return path_tsx
    return None


def run(scn: Scenario, timeout_s: float = 30.0) -> Dict[str, Any]:
    if not TS_SCRIPT.exists():
        raise TsBridgeError(
            f"TS bridge script not found at {TS_SCRIPT}. "
            "Did you build the backend?"
        )
    tsx = _find_tsx()
    if tsx is None:
        raise TsBridgeError(
            "tsx not found. Install via `cd backend && npm install`."
        )

    proc = subprocess.run(
        [tsx, str(TS_SCRIPT)],
        input=scn.to_json(),
        capture_output=True,
        text=True,
        cwd=str(REPO_ROOT / "backend"),
        timeout=timeout_s,
    )
    if proc.returncode != 0:
        raise TsBridgeError(
            f"TS bridge exited {proc.returncode}\nSTDERR:\n{proc.stderr}"
        )
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        raise TsBridgeError(
            f"could not parse TS bridge output as JSON: {e}\n"
            f"STDOUT (first 500): {proc.stdout[:500]}"
        )
