# Nash Hunger Research Environment (v1)

A fast, deterministic, partially-observable, multi-agent simulator for the Nash Hunger market-survival game. Built to support research on whether current RL methods can learn good strategies in this game (and to develop ones that can).

This is a **pure-Python rewrite** of the canonical TypeScript game in [`../backend/src`](../backend/src). A parity test (`tests/test_parity.py`) drives the same scenarios through both implementations and asserts identical trades, deaths, and final state. **As long as the parity test passes, the Python sim is byte-equivalent to the live game.**

## Install

```bash
cd research
python3 -m pip install -e .[dev]   # numpy + pytest

# Optional, for the parity test:
cd ../backend && npm install       # provides tsx + the canonical game logic
```

Python ≥ 3.11.

## Quickstart

```bash
# A single game with 4 specified agents
python run_game.py --seed 42 --agents greedy,buffer,random,noop

# With per-game JSON log
python run_game.py --seed 42 --agents greedy,greedy,greedy,greedy --log logs/

# Batch run, prints per-slot stats
python run_batch.py --agents greedy buffer random noop --num_games 1000
```

## API (per [`food_trading_environment_requirements.md`](../food_trading_environment_requirements.md) §4)

```python
from env.env import FoodTradingEnv
from agents import GreedyAgent, BufferAgent, RandomAgent, NoopAgent

env = FoodTradingEnv(seed=42)
agents = [GreedyAgent(), BufferAgent(), RandomAgent(), NoopAgent()]

obs = env.reset()
while not env.is_done():
    actions = {i: agents[i].act(obs[i], env.legal_actions(i)) for i in range(4)}
    obs, rewards, done, info = env.step(actions)

print(env.get_result())
```

The env exposes the standard 6 methods listed in the requirements doc:

| Method | Returns |
|---|---|
| `reset(seed=None)` | dict `{player_idx: observation}` |
| `step(actions)` | `(obs, rewards, done, info)` |
| `observe(player_idx)` | one player's observation dict |
| `legal_actions(player_idx)` | bool array of length `NUM_ACTIONS=410` |
| `is_done()` | bool |
| `get_result()` | dict with winner, end_reason, per-player final stats |

## Action space (410 discrete actions, per [§6](../food_trading_environment_requirements.md))

```
0..399    trade:  side ∈ {bid, ask} × food ∈ {A,B,C,D} × qty ∈ {1,2,4,8,16} × price ∈ {1..10}
400..407  cancel: side ∈ {bid, ask} × food ∈ {A,B,C,D}   (cancels the agent's oldest such order)
408       cancel-all
409       noop
```

`env.legal_actions(player_idx)` returns a boolean mask. Illegal actions submitted via `step()` are silently no-op'd so RL agents can't crash the env (per [§7](../food_trading_environment_requirements.md)).

## Observations (per [§5](../food_trading_environment_requirements.md))

Each player's observation includes their own cash/inventory/reservations/produced food/required foods/starvation timers/open orders, plus the public order book depth, recent trades, and other players' alive/dead/produces (but **never** other players' inventory or cash).

The observation is currently a dict (easy to inspect). For Gymnasium/PettingZoo wrapping in v2, it'll be flattened into a fixed-shape numpy array.

## Layout

```
research/
├── env/                   game logic (mirrors backend/src/{game,market,visibility,...})
│   ├── config.py          GameConfig dataclass; canonical constants
│   ├── types.py           Player, Order, Trade, OrderBook, GameState
│   ├── rng.py             single PCG64 generator per env
│   ├── setup.py           deck, dealing, producer assignment
│   ├── market.py          order book, matching (maker-price), reservations
│   ├── tick.py            production, consumption, death, winner
│   ├── actions.py         discrete action space + legal mask
│   ├── observation.py     per-agent partial-observability
│   ├── env.py             FoodTradingEnv class
│   └── logging.py         per-game JSON logger
├── agents/                baseline agents
│   ├── base.py            Agent ABC
│   ├── noop_agent.py
│   ├── random_agent.py
│   ├── greedy_agent.py    direct port of backend/src/game/bot.ts
│   └── buffer_agent.py    target-buffer reactive trader
├── parity/                bridge to canonical TypeScript implementation
│   ├── scenario.py        deterministic scenario builder
│   ├── run_python.py      replay scenario through Python sim
│   └── run_ts.py          subprocess into backend/src/test/headless_parity.ts
├── tests/                 pytest suite (~50 tests)
│   ├── test_setup.py
│   ├── test_market.py
│   ├── test_tick.py
│   ├── test_winner.py
│   ├── test_legal_actions.py
│   ├── test_determinism.py
│   └── test_parity.py     ← critical: Python ↔ TypeScript byte-equivalence
├── run_game.py
├── run_batch.py
├── pyproject.toml
└── README.md
```

## Tests

```bash
cd research
pytest -q                           # full suite
pytest tests/test_parity.py -v      # the critical correctness check (requires backend/node_modules)
```

## Speed

On an M1 with 1 worker, ~120 games/second for the canonical 4-player setup with bot agents (most games end as `single_survivor` within ~25 ticks because the canonical config is intentionally scarce). 1000 games run in ~10 seconds — well under the §2 target.

For RL training, vectorized envs and a PettingZoo wrapper come in v2.

## Known v1 limitations / future work

Per the requirements doc, deferred to v2:
- §8: shaped-reward training signal vs. evaluation score separation. v1 returns only the terminal `1.0 / 0.5 / 0.0` win signal.
- §11: tournament harness with full agent matrix (currently same agent set across all games — we don't permute seats).
- §12: full configurability is in place via `GameConfig`, but only the canonical preset is exercised by the test suite.
- §14: PettingZoo `ParallelEnv` wrapper. v1 uses a custom dict-of-actions API.
- Vectorized envs and RL training scripts (PPO/MAPPO/IPPO).
