"""Watch a game unfold tick-by-tick in your terminal.

Usage:
    python watch_game.py --seed 42 --agents greedy,buffer,random,noop
    python watch_game.py --seed 7  --agents greedy,greedy,greedy,greedy --delay 0.05
    python watch_game.py --seed 0  --agents greedy,greedy,greedy,greedy --no-clear

By default it pauses 0.3s between ticks and clears the screen each tick so you
see one frame at a time. Pass --no-clear to print every tick as a stream
(useful when piping to a file).
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import List

sys.path.insert(0, str(Path(__file__).resolve().parent))

from agents import AGENT_REGISTRY  # noqa: E402
from env.actions import (  # noqa: E402
    ACTION_CANCEL_ALL,
    ACTION_CANCEL_BASE,
    ACTION_NOOP,
    NUM_FOODS,
    SIDES,
    decode,
)
from env.config import DEFAULT_CONFIG, FOOD_DISPLAY_NAMES  # noqa: E402
from env.env import FoodTradingEnv  # noqa: E402
from env.types import GameState  # noqa: E402

# ANSI colors
BOLD = "\x1b[1m"
DIM = "\x1b[2m"
GREEN = "\x1b[32m"
RED = "\x1b[31m"
YELLOW = "\x1b[33m"
CYAN = "\x1b[36m"
MAGENTA = "\x1b[35m"
WHITE = "\x1b[37m"
RESET = "\x1b[0m"

# Per-food color
FOOD_COLOR = {
    "A": MAGENTA,  # Ube
    "B": GREEN,    # Iceberg
    "C": YELLOW,   # Oats
    "D": RED,      # Pork
}


def _action_label(action: int, applied: dict) -> str:
    if action == ACTION_NOOP:
        return f"{DIM}noop{RESET}"
    d = decode(action)
    cls = type(d).__name__
    if cls == "TradeAction":
        col = GREEN if d.side == "bid" else RED
        food_col = FOOD_COLOR.get(d.food_type, "")
        verb = "BUY" if d.side == "bid" else "SELL"
        suffix = ""
        if applied.get("applied"):
            n = applied.get("n_trades", 0)
            if n:
                suffix = f" {GREEN}✓×{n}{RESET}"
            else:
                suffix = f" {DIM}(rest){RESET}"
        else:
            suffix = f" {RED}✗{applied.get('code', '')}{RESET}"
        return (
            f"{col}{verb}{RESET} "
            f"{d.quantity}×{food_col}{FOOD_DISPLAY_NAMES[d.food_type][:3]}{RESET} "
            f"@${d.price_per_unit}{suffix}"
        )
    if cls == "CancelAction":
        food_col = FOOD_COLOR.get(d.food_type, "")
        ok = "✓" if applied.get("applied") else "✗"
        return f"{CYAN}cancel{RESET} {d.side} {food_col}{FOOD_DISPLAY_NAMES[d.food_type][:3]}{RESET} {ok}"
    if cls == "CancelAllAction":
        n = applied.get("cancelled", 0) if applied.get("applied") else 0
        return f"{CYAN}cancel-all{RESET} (×{n})"
    return "?"


def _hbar(width: int = 80) -> str:
    return DIM + ("─" * width) + RESET


def render_frame(
    env: FoodTradingEnv,
    actions: dict,
    applied: dict,
    deaths_this_tick: list,
) -> str:
    state: GameState = env.state
    config = env.config
    lines: List[str] = []
    remaining = max(0, config.game_duration_seconds - state.elapsed_seconds)
    alive = state.alive_count()

    # Header
    title = f"{BOLD}NASH HUNGER{RESET}  "
    title += f"tick {state.elapsed_seconds:>3}/{config.game_duration_seconds}  "
    title += f"alive {alive}/{config.player_count}  "
    if remaining <= 30:
        title += f"{RED}{remaining}s left{RESET}"
    elif remaining <= 60:
        title += f"{YELLOW}{remaining}s left{RESET}"
    else:
        title += f"{remaining}s left"
    lines.append(title)
    lines.append(_hbar())

    # Per-player rows
    for p in state.players:
        a = actions.get(p.idx, ACTION_NOOP)
        ap = applied.get(p.idx, {"applied": True, "kind": "noop"})
        status_marker = (
            f"{GREEN}●{RESET}" if p.status == "alive" else f"{RED}†{RESET}"
        )
        if p.idx in deaths_this_tick:
            status_marker = f"{RED}{BOLD}†DIED{RESET}"
        prod_col = FOOD_COLOR.get(p.produces, "")
        prod_label = f"{prod_col}{FOOD_DISPLAY_NAMES.get(p.produces, '?'):>7}{RESET}"

        # Inventory line with survival markers
        inv_parts = []
        for f in config.food_types:
            avail = p.inventory[f] - p.reserved_inventory[f]
            col = FOOD_COLOR.get(f, "")
            short = FOOD_DISPLAY_NAMES[f][:3]
            if p.produces == f:
                cell = f"{col}{short}{RESET}={p.inventory[f]:<3}"
            else:
                if avail <= 3 and p.status == "alive":
                    cell = f"{col}{short}{RESET}={RED}{p.inventory[f]:<3}{RESET}"
                elif avail <= 8 and p.status == "alive":
                    cell = f"{col}{short}{RESET}={YELLOW}{p.inventory[f]:<3}{RESET}"
                else:
                    cell = f"{col}{short}{RESET}={p.inventory[f]:<3}"
            inv_parts.append(cell)

        cash_str = f"${p.cash:<4}"
        if p.reserved_cash > 0:
            cash_str = f"${p.cash:<3}({DIM}-{p.reserved_cash}{RESET})"

        action_str = ""
        if p.status == "alive":
            action_str = _action_label(a, ap)

        lines.append(
            f"  {status_marker} P{p.idx} {p.name[:8]:<8} {prod_label} "
            f"{cash_str}  {' '.join(inv_parts)}  →  {action_str}"
        )

    # Order books — one line per food
    lines.append(_hbar())
    book_parts = []
    for f in config.food_types:
        book = state.order_books[f]
        bid = book.bids[0].price_per_unit if book.bids else None
        ask = book.asks[0].price_per_unit if book.asks else None
        col = FOOD_COLOR.get(f, "")
        short = FOOD_DISPLAY_NAMES[f][:3]
        bid_s = f"{GREEN}${bid}{RESET}" if bid is not None else f"{DIM}—{RESET}"
        ask_s = f"{RED}${ask}{RESET}" if ask is not None else f"{DIM}—{RESET}"
        depth_b = sum(o.remaining_quantity for o in book.bids)
        depth_a = sum(o.remaining_quantity for o in book.asks)
        book_parts.append(
            f"{col}{short}{RESET} {bid_s}({depth_b})/{ask_s}({depth_a})"
        )
    lines.append("  books: " + "   ".join(book_parts))

    # Recent trades (last 5)
    if state.trades:
        lines.append(_hbar())
        lines.append("  recent trades:")
        for t in state.trades[-5:]:
            col = FOOD_COLOR.get(t.food_type, "")
            short = FOOD_DISPLAY_NAMES[t.food_type][:3]
            lines.append(
                f"    t={t.elapsed_second:<3} "
                f"P{t.buyer_idx}{GREEN}←{RESET}{t.quantity}×{col}{short}{RESET}"
                f"{GREEN}←{RESET}P{t.seller_idx} @{YELLOW}${t.price_per_unit}{RESET}"
            )

    if state.phase == "ended":
        lines.append(_hbar())
        winners = ", ".join(f"P{i}" for i in state.winner_idxs) or "(none)"
        reason = state.end_reason or "?"
        lines.append(
            f"  {BOLD}{YELLOW}GAME OVER{RESET}  reason={reason}  winner(s)={winners}"
        )

    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Watch a Nash Hunger game tick-by-tick.")
    p.add_argument("--seed", type=int, default=42)
    p.add_argument(
        "--agents",
        type=str,
        default="greedy,buffer,random,noop",
        help="comma-separated list of 4 agent names: " + ", ".join(AGENT_REGISTRY),
    )
    p.add_argument("--delay", type=float, default=0.3, help="seconds between ticks")
    p.add_argument(
        "--no-clear",
        action="store_true",
        help="don't clear screen between ticks (stream every frame)",
    )
    p.add_argument(
        "--max-ticks",
        type=int,
        default=None,
        help="stop after this many ticks (default: run to game end)",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    names = [s.strip() for s in args.agents.split(",")]
    if len(names) != 4:
        raise SystemExit(f"need 4 agents, got {len(names)}")
    for n in names:
        if n not in AGENT_REGISTRY:
            raise SystemExit(f"unknown agent '{n}'")

    agents = []
    for i, n in enumerate(names):
        cls = AGENT_REGISTRY[n]
        try:
            agents.append(cls(seed=args.seed * 1000 + i))
        except TypeError:
            agents.append(cls())

    env = FoodTradingEnv(
        seed=args.seed,
        player_names=[f"{n}{i}" for i, n in enumerate(names)],
    )
    obs = env.reset()
    for a in agents:
        a.reset()

    # Print initial state
    if not args.no_clear:
        os.system("clear")
    print(render_frame(env, {}, {}, []))
    time.sleep(args.delay)

    tick_count = 0
    while not env.is_done():
        actions = {
            i: agents[i].act(obs[i], env.legal_actions(i)) for i in range(4)
        }
        obs, _, _, info = env.step(actions)
        tick_count += 1

        if not args.no_clear:
            os.system("clear")
        print(
            render_frame(
                env,
                actions,
                info.actions_applied,
                info.deaths_this_tick,
            )
        )

        if args.max_ticks and tick_count >= args.max_ticks:
            break
        if not env.is_done():
            time.sleep(args.delay)

    return 0


if __name__ == "__main__":
    sys.exit(main())
