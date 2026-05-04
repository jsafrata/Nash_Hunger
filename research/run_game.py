"""Run a single game with chosen agents.

Usage:
    python run_game.py --seed 42 --agents greedy,buffer,random,noop
    python run_game.py --seed 7  --agents greedy,greedy,greedy,greedy --log logs/
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import List

# Allow running as a script from repo root
sys.path.insert(0, str(Path(__file__).resolve().parent))

from agents import AGENT_REGISTRY  # noqa: E402
from env.env import FoodTradingEnv  # noqa: E402
from env.logging import GameLogger  # noqa: E402


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Run one Nash Hunger game.")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument(
        "--agents",
        type=str,
        default="greedy,greedy,greedy,greedy",
        help="comma-separated list of 4 agent names from: " + ", ".join(AGENT_REGISTRY),
    )
    p.add_argument(
        "--log",
        type=str,
        default=None,
        help="Optional output directory for per-game JSON log.",
    )
    p.add_argument("--quiet", action="store_true")
    return p.parse_args()


def build_agents(spec: str, base_seed: int) -> List:
    names = [s.strip() for s in spec.split(",")]
    if len(names) != 4:
        raise SystemExit(f"need 4 agent names, got {len(names)}")
    out = []
    for i, n in enumerate(names):
        if n not in AGENT_REGISTRY:
            raise SystemExit(f"unknown agent '{n}'. choices: {list(AGENT_REGISTRY)}")
        cls = AGENT_REGISTRY[n]
        # Pass per-agent seed so RandomAgents in different slots are independent.
        try:
            out.append(cls(seed=base_seed * 1000 + i))
        except TypeError:
            out.append(cls())
    return out


def run(args: argparse.Namespace) -> int:
    agents = build_agents(args.agents, args.seed)
    agent_names = [a.name for a in agents]

    env = FoodTradingEnv(
        seed=args.seed,
        player_names=[f"{a.name}{i}" for i, a in enumerate(agents)],
    )
    obs = env.reset()
    for a in agents:
        a.reset()

    logger = None
    if args.log:
        game_id = f"seed{args.seed}_{'-'.join(agent_names)}"
        logger = GameLogger(args.log, game_id)
        logger.set_meta(
            seed=args.seed,
            agent_types=agent_names,
            initial={
                "players": [
                    {
                        "idx": p.idx,
                        "name": p.name,
                        "produces": p.produces,
                        "inventory": dict(p.inventory),
                        "cash": p.cash,
                    }
                    for p in env.state.players
                ],
            },
        )

    while not env.is_done():
        actions = {
            i: agents[i].act(obs[i], env.legal_actions(i)) for i in range(4)
        }
        obs, rewards, done, info = env.step(actions)
        if logger:
            snaps = {
                i: {"cash": env.state.players[i].cash, "alive": env.state.players[i].status == "alive"}
                for i in range(4)
            }
            logger.log_step(
                tick=info.tick,
                actions=actions,
                applied_info=info.actions_applied,
                deaths=info.deaths_this_tick,
                snapshots=snaps,
            )

    result = env.get_result()
    if logger:
        logger.set_result(result)
        path = logger.flush()
        if not args.quiet:
            print(f"log: {path}")

    if not args.quiet:
        print(json.dumps(_summary(result), indent=2))
    return 0


def _summary(result):
    return {
        "end_reason": result["end_reason"],
        "elapsed_seconds": result["elapsed_seconds"],
        "winner_idxs": result["winner_idxs"],
        "n_trades": result["n_trades"],
        "players": [
            {
                "idx": p["idx"],
                "name": p["name"],
                "produces": p["produces"],
                "status": p["status"],
                "died_at": p["died_at"],
                "final_cash": p["final_cash"],
                "total_bought": p["total_bought"],
                "total_sold": p["total_sold"],
            }
            for p in result["players"]
        ],
    }


if __name__ == "__main__":
    sys.exit(run(parse_args()))
