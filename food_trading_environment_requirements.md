# Food Trading Research Environment Requirements

This document summarizes what the research environment for the food trading game has to satisfy before baseline strategies or reinforcement learning models can be evaluated seriously. The playable multiplayer version of the game already exists, so the goal here is different: to build a fast, deterministic, simulation-only environment that can run many games automatically, collect reliable data, and later support RL training and evaluation.

The research environment should be a **fast simulator of the game** with a clean interface for agents.

It should **not** include UI, sockets, real-time waiting, Vercel, Railway, animations, or human input. Its purpose is to run thousands or millions of artificial games quickly and reproducibly.

The environment must satisfy the following requirements:

---

# 1. Faithfully simulate the game rules

The environment must implement the actual mechanics of the game:

- 4 players.
- Each player produces one food type.
- Each player consumes the other food types.
- Players die if they cannot consume required food.
- Players can post bids, asks, and cancellations.
- Orders match through the order book.
- Partial fills work.
- Cash and inventory update correctly.
- Winner is determined correctly.

This is the core requirement. If the environment is wrong, all later RL results are meaningless. The game is a real-time 4-player market survival game with private inventory/cash, continuous consumption, production, and limit-order-book trading.

---

# 2. Run fast

The web version runs in real time: one game takes 3 minutes.

The research environment should not wait 3 minutes. It should simulate the whole game as fast as possible.

Instead of:

```text id="uyl4n7"
wait 1 real second
process production
process consumption
wait 1 real second
...
```

it should do:

```text id="um0bbl"
for t in range(180):
    get agent actions
    process orders
    process production
    process consumption
    check deaths
```

A full 180-second game should ideally run in milliseconds or a few tens of milliseconds, not minutes.

Practical target:

```text id="n1lvbh"
1,000 games should run in seconds or a few minutes, not hours.
```

---

# 3. Be deterministic under a seed

The environment must allow a command such as:

```bash id="wmdaaw"
python run_game.py --seed 42
```

to always produce the same:

- initial inventories,
- player production assignments,
- trades,
- deaths,
- winner,
- final cash,
- final inventories.

This is essential for debugging and for fair comparisons between agents.

Example:

```python id="3ebstc"
env = FoodTradingEnv(seed=42)
```

The same seed should always produce the same game.

---

# 4. Expose a clean agent interface

The environment should support an interface like this:

```python id="zyb073"
obs = env.reset(seed=42)

done = False
while not done:
    actions = {
        0: agent0.act(obs[0]),
        1: agent1.act(obs[1]),
        2: agent2.act(obs[2]),
        3: agent3.act(obs[3]),
    }

    obs, rewards, done, info = env.step(actions)
```

At minimum, the environment needs these functions:

```python id="5jt9y5"
reset(seed)
step(actions)
observe(player_id)
legal_actions(player_id)
is_done()
get_result()
```

This is the heart of the research environment.

---

# 5. Define what each agent observes

Because the game has hidden information, the environment must prevent information leakage.

Each agent should observe:

```text id="t01v0r"
Own inventory
Own cash
Own reserved inventory
Own reserved cash
Own produced food
Own survival buffers
Own open orders
Public order book
Public trades
Alive/dead status of players
Time remaining
```

Each agent should **not** observe:

```text id="b7yly5"
Other players' exact inventories
Other players' exact cash
Other players' reserved resources
Other players' exact starvation timers
```

This is important because if RL agents accidentally see hidden information, the results become invalid.

---

# 6. Start with the natural order-book action space

The first version of the environment should try to use the natural game actions directly:

```text id="r9v3tu"
action type: bid / ask / cancel / do nothing
food type: 4 choices
quantity bucket: 1, 2, 4, 8, 16
price bucket: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
```

This keeps the research environment close to the actual game and avoids prematurely simplifying the problem.

With these choices, the basic bid/ask part of the action space is relatively manageable:

```text id="vucdiy"
2 trade types × 4 food types × 5 quantity buckets × 10 price buckets = 400 bid/ask actions
```

The full action space also needs to include:

```text id="uwhbys"
cancel actions
do nothing
```

The exact number of cancellation actions depends on how cancellation is represented. For example, cancellation could mean:

- cancel all orders,
- cancel the oldest order,
- cancel the most risky order,
- cancel a specific order ID.

The environment should provide legal action masks, because many actions will be invalid depending on the agent's current cash, inventory, open orders, and alive/dead status.

For example, an agent should not be allowed to:

- bid more cash than it has available,
- ask more food than it has available,
- cancel an order that does not exist,
- act after death.

If this natural action space proves too large or too difficult for early RL baselines, a higher-level action abstraction can be added later, such as:

```text id="r87frm"
buy most urgent food cheaply
buy most urgent food aggressively
sell produced food at medium price
cancel risky orders
```

The key point is to avoid simplifying too early, but also to design the environment so that a simplified action interface can be added later if needed.


---

# 7. Handle illegal actions cleanly

Agents, especially RL agents, will try invalid things.

Examples:

- buying without enough cash,
- selling food they do not have,
- cancelling a nonexistent order,
- acting after death,
- posting negative prices,
- posting zero quantity.

The environment must either:

1. reject illegal actions and give a penalty, or  
2. provide an action mask so agents can only choose legal actions.

For RL, action masks are very useful:

```python id="bnoqpk"
mask = env.legal_action_mask(player_id)
```

This tells the agent which actions are currently allowed.

---

# 8. Separate training rewards from evaluation metrics

The true goal of the game is:

```text id="8iauv6"
survive and win, with cash deciding among survivors
```

But RL may need shaped rewards during training.

The environment should therefore distinguish:

```python id="pmhee7"
training_reward()
evaluation_score()
```

For example, training reward might include:

```text id="6s6y48"
+ reward for increasing survival buffer
- penalty for low survival buffer
- penalty for death
+ reward for profitable trade
+ terminal reward for winning
```

Final evaluation should still use the real game result:

```text id="7602ts"
win rate
survival rate
final cash
death time
rank
```

The final paper result should not be judged only using shaped reward.

---

# 9. Log everything needed for analysis

Every game should be able to save:

```text id="zdvd6s"
seed
agent types
initial inventories
actions taken
orders posted
orders cancelled
trades executed
prices
quantities
inventory over time
cash over time
death times
winner
final state
```

This is necessary because later analysis will need to answer questions such as:

- Why did PPO fail?
- Did the agent die because it refused to trade?
- Did it overpay?
- Did it sell too much food?
- Did it fail to cancel risky orders?
- Did it overfit to one opponent type?

Without logs, failures cannot be diagnosed properly.

---

# 10. Support many games automatically

The environment should support batch commands such as:

```bash id="p40vdj"
python run_batch.py --agents greedy random buffer fixed --num_games 10000
```

and produce summary results like:

```text id="mms3wa"
Agent      Win Rate   Survival Rate   Avg Death Time   Avg Final Cash
Greedy     ...
Random     ...
Buffer     ...
Fixed      ...
```

This is necessary for both:

- baseline evaluation,
- RL evaluation.

One game is not enough. Evaluation requires many seeds.

---

# 11. Support different agents in the same game

Because this is multi-agent research, the environment should allow different agents to play in the same game:

```python id="eveqiw"
agents = [
    GreedyAgent(),
    RandomAgent(),
    BufferAgent(),
    MarketMakerAgent()
]
```

Evaluating only:

```text id="qamkxr"
RL vs RL vs RL vs RL
```

is not enough.

The environment should also support evaluations such as:

```text id="pjwc4g"
RL vs greedy vs buffer vs predator
RL vs market-maker vs hoarder vs random
greedy vs buffer vs predator vs cooperative
```

This is how agent robustness can be tested.

---

# 12. Support configuration changes

Eventually, agents should be tested for generalization.

The environment should allow changing:

```text id="gzvajw"
game length
starting cash
starting food
production rate
consumption rate
number of food types
price limits
scarcity level
```

At first, the exact game settings should be used. However, the environment should be designed so that changing parameters is easy.

Example:

```python id="abwogs"
config = GameConfig(
    game_length=180,
    initial_cash=100,
    production_rate=2,
    consumption_rate=1,
)
env = FoodTradingEnv(config=config)
```

This will matter later if the research claim is that the RL model is general and not hard-coded to one version of the game.

---

# 13. Be testable

Before training RL, the environment should have tests.

Minimum tests:

```text id="7dpg9e"
initial setup is correct
production works
consumption works
death works
bids require cash
asks require inventory
orders match correctly
partial fills work
cancellations work
reserved resources update correctly
winner calculation works
same seed gives same result
```

Internal checks should also be added:

```python id="bcdcy7"
assert cash >= 0
assert inventory >= 0
assert reserved_cash <= cash
assert reserved_inventory[food] <= inventory[food]
```

These checks catch bugs early.

---

# 14. Eventually be compatible with RL libraries

This is not necessary on day one, but the environment should be easy to wrap into a standard format.

Ideally, later it can look like:

```python id="wnswk4"
class FoodTradingEnv(ParallelEnv):
    ...
```

or Gymnasium/PettingZoo style.

This matters because it enables:

- easier PPO training,
- easier MAPPO training,
- easier vectorized environments,
- easier comparison with existing MARL baselines.

The first priority, however, should be a clean custom simulator.

---

# The minimum version needed first

The first version does **not** need to be perfect.

The minimum useful environment must have:

```text id="r3jogo"
1. reset(seed)
2. step(actions)
3. observations for each player
4. legal action handling
5. correct game mechanics
6. deterministic seeds
7. simple logging
8. ability to run many games quickly
9. baseline agents can plug into it
```

That is enough to begin useful research.

---

# One-sentence summary

The environment should be a **fast, deterministic, partially observable, multi-agent simulator** of the game, with a clean `reset/step/observe` interface, legal actions, logging, and batch evaluation support.

This is the necessary foundation before serious baselines or RL training.
