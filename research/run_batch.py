"""Run many games and report per-agent statistics.

Usage:
    python run_batch.py --agents greedy buffer random noop --num_games 1000

Each seed `s ∈ [seed_base, seed_base+num_games)` is one game.
For multi-seat fairness, the same agent assignment is used for every seed; the
output is a per-slot summary. Use repeated runs with permuted agent orders if
you want true seat-balanced statistics.
"""
from __future__ import annotations

import argparse
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parent))

from agents import AGENT_REGISTRY  # noqa: E402
from env.env import FoodTradingEnv  # noqa: E402


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Run many Nash Hunger games.")
    p.add_argument(
        "--agents",
        nargs="+",
        required=True,
        help="4 agent names from: " + ", ".join(AGENT_REGISTRY),
    )
    p.add_argument("--num_games", type=int, default=100)
    p.add_argument("--seed_base", type=int, default=0)
    p.add_argument("--workers", type=int, default=1, help="multiprocessing workers")
    return p.parse_args()


def play_one(seed: int, agent_names: List[str]) -> Dict:
    agents = []
    for i, n in enumerate(agent_names):
        cls = AGENT_REGISTRY[n]
        try:
            agents.append(cls(seed=seed * 1000 + i))
        except TypeError:
            agents.append(cls())

    env = FoodTradingEnv(
        seed=seed,
        player_names=[f"{n}{i}" for i, n in enumerate(agent_names)],
    )
    obs = env.reset()
    for a in agents:
        a.reset()
    while not env.is_done():
        actions = {
            i: agents[i].act(obs[i], env.legal_actions(i)) for i in range(4)
        }
        obs, _, _, _ = env.step(actions)
    res = env.get_result()
    return {
        "seed": seed,
        "winner_idxs": res["winner_idxs"],
        "end_reason": res["end_reason"],
        "elapsed_seconds": res["elapsed_seconds"],
        "n_trades": res["n_trades"],
        "alive": [1 if p["status"] == "alive" else 0 for p in res["players"]],
        "death_time": [
            p["died_at"] if p["died_at"] is not None else res["elapsed_seconds"]
            for p in res["players"]
        ],
        "final_cash": [p["final_cash"] for p in res["players"]],
    }


def main(args) -> int:
    if len(args.agents) != 4:
        raise SystemExit(f"need 4 agents, got {len(args.agents)}")
    for n in args.agents:
        if n not in AGENT_REGISTRY:
            raise SystemExit(f"unknown agent '{n}'")

    seeds = list(range(args.seed_base, args.seed_base + args.num_games))
    t0 = time.time()
    results: List[Dict] = []
    if args.workers > 1:
        with ProcessPoolExecutor(max_workers=args.workers) as pool:
            futures = {pool.submit(play_one, s, args.agents): s for s in seeds}
            for fut in as_completed(futures):
                results.append(fut.result())
    else:
        for s in seeds:
            results.append(play_one(s, args.agents))
    elapsed = time.time() - t0

    # Aggregate per-slot stats
    n = len(results)
    win_count = [0, 0, 0, 0]
    survive_count = [0, 0, 0, 0]
    sum_death_time = [0.0, 0.0, 0.0, 0.0]
    sum_cash = [0.0, 0.0, 0.0, 0.0]
    end_reason_count = {"time_limit": 0, "single_survivor": 0, "no_survivors": 0}
    for r in results:
        for w in r["winner_idxs"]:
            # Tie → split equally
            win_count[w] += 1.0 / len(r["winner_idxs"])
        for i in range(4):
            survive_count[i] += r["alive"][i]
            sum_death_time[i] += r["death_time"][i]
            sum_cash[i] += r["final_cash"][i]
        end_reason_count[r["end_reason"]] += 1

    print(f"\nRan {n} games in {elapsed:.2f}s "
          f"({elapsed*1000/n:.2f} ms/game, {n/elapsed:.1f} games/sec)")
    print(f"end reasons: {end_reason_count}\n")
    print(f"{'Slot':<5}{'Agent':<10}{'Win%':>8}{'Survive%':>10}{'AvgDeath':>10}{'AvgCash':>10}")
    for i, name in enumerate(args.agents):
        print(
            f"{i:<5}{name:<10}"
            f"{100*win_count[i]/n:>7.1f}%"
            f"{100*survive_count[i]/n:>9.1f}%"
            f"{sum_death_time[i]/n:>10.1f}"
            f"{sum_cash[i]/n:>10.1f}"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main(parse_args()))
