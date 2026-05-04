"""Parity test: drive the SAME scenario through the Python sim and the canonical
TypeScript implementation; assert identical trade lists, deaths, and final state.

If this test fails, the Python rewrite has diverged from the live game and
ALL other research conclusions become suspect.

Skipped automatically if the TS toolchain (tsx + node_modules) isn't present.
"""
from __future__ import annotations

import pytest

from parity.run_python import run as run_python
from parity.run_ts import TsBridgeError, run as run_ts
from parity.scenario import build_scenario


def _have_ts() -> bool:
    try:
        # Build a tiny scenario and ensure tsx + script are available
        scn = build_scenario(seed=0, n_ticks=1)
        run_ts(scn)
        return True
    except TsBridgeError:
        return False


HAVE_TS = _have_ts()


@pytest.mark.skipif(not HAVE_TS, reason="TS toolchain not available (run `cd backend && npm install`)")
@pytest.mark.parametrize("seed", list(range(5)))
def test_parity_random_scenario(seed):
    scn = build_scenario(seed=seed, n_ticks=60)
    py = run_python(scn)
    ts = run_ts(scn)

    # Game-over alignment
    assert py["elapsed_seconds"] == ts["elapsed_seconds"], (
        f"seed={seed}: elapsed mismatch py={py['elapsed_seconds']} ts={ts['elapsed_seconds']}"
    )
    assert py["end_reason"] == ts["end_reason"], (
        f"seed={seed}: end_reason mismatch py={py['end_reason']} ts={ts['end_reason']}"
    )

    # Per-player final state
    assert len(py["players"]) == len(ts["players"])
    for pp, tp in zip(py["players"], ts["players"]):
        assert pp["produces"] == tp["produces"], f"seed={seed} idx={pp['idx']}: produces"
        assert pp["status"] == tp["status"], f"seed={seed} idx={pp['idx']}: status py={pp['status']} ts={tp['status']}"
        assert pp["died_at"] == tp["died_at"], f"seed={seed} idx={pp['idx']}: died_at"
        assert pp["cash"] == tp["cash"], f"seed={seed} idx={pp['idx']}: cash py={pp['cash']} ts={tp['cash']}"
        assert pp["inventory"] == tp["inventory"], (
            f"seed={seed} idx={pp['idx']}: inventory py={pp['inventory']} ts={tp['inventory']}"
        )
        assert pp["total_bought"] == tp["total_bought"], f"seed={seed} idx={pp['idx']}: total_bought"
        assert pp["total_sold"] == tp["total_sold"], f"seed={seed} idx={pp['idx']}: total_sold"

    # Trades — must be identical in order and content
    assert len(py["trades"]) == len(ts["trades"]), (
        f"seed={seed}: trade count py={len(py['trades'])} ts={len(ts['trades'])}"
    )
    for i, (pt, tt) in enumerate(zip(py["trades"], ts["trades"])):
        assert pt == tt, f"seed={seed} trade {i}: py={pt} ts={tt}"

    # Winners
    assert sorted(py["winner_idxs"]) == sorted(ts["winner_idxs"]), (
        f"seed={seed}: winners py={py['winner_idxs']} ts={ts['winner_idxs']}"
    )
