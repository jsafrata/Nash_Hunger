from env.actions import ACTION_CANCEL_ALL, PRICE_BUCKETS, QTY_BUCKETS, decode, encode_trade
from env.env import FoodTradingEnv
from env.market import post_order

from agents.greedy_agent import GreedyAgent, MIN_REQUIRED_ESTIMATE


def _seeded_obs(seed: int = 42):
    env = FoodTradingEnv(seed=seed)
    obs = env.reset()
    return env, obs


def _clear_market(env) -> None:
    for food in ("A", "B", "C", "D"):
        env.state.order_books[food].bids.clear()
        env.state.order_books[food].asks.clear()
    env.state.trades.clear()


def _player_required_foods(obs):
    return [food for food in ("A", "B", "C", "D") if food != obs["produces"]]


def _seed_high_ask_market(env, player_idx: int, base_price: int, skip_foods: set[str]) -> None:
    for idx, player in enumerate(env.state.players):
        if idx == player_idx:
            continue
        food = player.produces
        if food in skip_foods:
            continue
        env.state.players[idx].inventory[food] = max(env.state.players[idx].inventory[food], 10)
        env.state.players[idx].reserved_inventory[food] = 0
        post_order(
            env.state,
            player_idx=idx,
            side="ask",
            food_type=food,
            quantity=1,
            price_per_unit=base_price,
        )


def test_unified_market_anchor_combines_visible_bids_and_asks():
    env, obs = _seeded_obs()
    player_idx = 0
    agent = GreedyAgent()
    now = env.observe(player_idx)
    normalized = agent._normalized_food_values(
        inventory={f: float(now["available_inventory"][f]) for f in ("A", "B", "C", "D")},
        produces=now["produces"],
        required_foods=now["required_foods"],
    )

    ratios = []
    for food in now["required_foods"]:
        seller_idx = next(
            p.idx for p in env.state.players if p.idx != player_idx and p.produces == food
        )
        env.state.players[seller_idx].inventory[food] = 20
        env.state.players[seller_idx].reserved_inventory[food] = 0
        post_order(env.state, player_idx=seller_idx, side="ask", food_type=food, quantity=1, price_per_unit=8)
        env.state.players[player_idx].cash = 100
        post_order(env.state, player_idx=player_idx, side="bid", food_type=food, quantity=1, price_per_unit=2)
        ratios.append(8.0 / normalized[food])
        ratios.append(2.0 / normalized[food])

    refreshed = env.observe(player_idx)
    assert agent._market_anchor(refreshed, normalized) == sum(ratios) / len(ratios)


def test_market_anchor_falls_back_to_last_trades_when_quotes_absent():
    env, obs = _seeded_obs()
    player_idx = 0
    own_food = obs[player_idx]["produces"]
    required = _player_required_foods(obs[player_idx])
    buy_food = required[0]

    _clear_market(env)
    seller_idx = next(p.idx for p in env.state.players if p.idx != player_idx and p.produces == buy_food)
    env.state.players[seller_idx].inventory[buy_food] = 10
    env.state.players[seller_idx].reserved_inventory[buy_food] = 0
    env.state.players[player_idx].cash = 100
    post_order(env.state, player_idx=seller_idx, side="ask", food_type=buy_food, quantity=1, price_per_unit=6)
    post_order(env.state, player_idx=player_idx, side="bid", food_type=buy_food, quantity=1, price_per_unit=6)
    env.state.order_books[buy_food].bids.clear()
    env.state.order_books[buy_food].asks.clear()

    agent = GreedyAgent()
    now = env.observe(player_idx)
    normalized = agent._normalized_food_values(
        inventory={f: float(now["available_inventory"][f]) for f in ("A", "B", "C", "D")},
        produces=own_food,
        required_foods=now["required_foods"],
    )
    expected = 6.0 / normalized[buy_food]
    assert agent._market_anchor(now, normalized) == expected


def test_best_buy_quantity_maximizes_total_marginal_surplus():
    env, obs = _seeded_obs()
    player_idx = 0
    own_food = obs[player_idx]["produces"]
    buy_food = _player_required_foods(obs[player_idx])[0]
    seller_idx = next(p.idx for p in env.state.players if p.idx != player_idx and p.produces == buy_food)

    _clear_market(env)
    env.state.players[player_idx].cash = 100
    env.state.players[player_idx].reserved_cash = 0
    env.state.players[player_idx].inventory = {food: 8 for food in ("A", "B", "C", "D")}
    env.state.players[player_idx].inventory[own_food] = 1
    env.state.players[player_idx].inventory[buy_food] = 4
    env.state.players[player_idx].reserved_inventory = {food: 0 for food in ("A", "B", "C", "D")}

    env.state.players[seller_idx].inventory[buy_food] = 10
    env.state.players[seller_idx].reserved_inventory[buy_food] = 0
    post_order(env.state, player_idx=seller_idx, side="ask", food_type=buy_food, quantity=8, price_per_unit=12)
    _seed_high_ask_market(env, player_idx, base_price=10, skip_foods={buy_food})

    agent = GreedyAgent()
    action = agent.act(env.observe(player_idx), env.legal_actions(player_idx))
    decoded = decode(action)
    assert decoded.side == "bid"
    assert decoded.food_type == buy_food
    assert decoded.quantity == 4


def test_larger_buy_stops_when_extra_units_turn_negative():
    env, obs = _seeded_obs()
    player_idx = 0
    own_food = obs[player_idx]["produces"]
    buy_food = _player_required_foods(obs[player_idx])[0]
    seller_idx = next(p.idx for p in env.state.players if p.idx != player_idx and p.produces == buy_food)

    _clear_market(env)
    env.state.players[player_idx].cash = 100
    env.state.players[player_idx].reserved_cash = 0
    env.state.players[player_idx].inventory = {food: 4 for food in ("A", "B", "C", "D")}
    env.state.players[player_idx].inventory[own_food] = 1
    env.state.players[player_idx].inventory[buy_food] = 1
    env.state.players[player_idx].reserved_inventory = {food: 0 for food in ("A", "B", "C", "D")}

    env.state.players[seller_idx].inventory[buy_food] = 10
    env.state.players[seller_idx].reserved_inventory[buy_food] = 0
    post_order(env.state, player_idx=seller_idx, side="ask", food_type=buy_food, quantity=8, price_per_unit=8)
    _seed_high_ask_market(env, player_idx, base_price=6, skip_foods={buy_food})

    agent = GreedyAgent()
    action = agent.act(env.observe(player_idx), env.legal_actions(player_idx))
    decoded = decode(action)
    assert decoded.side == "bid"
    assert decoded.food_type == buy_food
    assert decoded.quantity == 2


def test_time_advance_updates_opponent_inventory_and_clamps_required_foods():
    env, obs = _seeded_obs()
    player_idx = 0
    agent = GreedyAgent()
    first = env.observe(player_idx)
    agent._ensure_initialized(first)

    opp_idx = next(iter(agent._estimates))
    produces = agent._estimates[opp_idx].produces
    required_food = next(food for food in ("A", "B", "C", "D") if food != produces)
    agent._estimates[opp_idx].inventory[produces] = 3.0
    agent._estimates[opp_idx].inventory[required_food] = 1.2

    env.state.elapsed_seconds = 3
    agent._advance_opponent_tick(env.observe(player_idx))

    assert agent._estimates[opp_idx].inventory[produces] == 9.0
    assert agent._estimates[opp_idx].inventory[required_food] == MIN_REQUIRED_ESTIMATE


def test_trade_adjustment_updates_cash_and_food_once():
    env, obs = _seeded_obs()
    player_idx = 0
    own_food = obs[player_idx]["produces"]
    buy_food = _player_required_foods(obs[player_idx])[0]
    seller_idx = next(p.idx for p in env.state.players if p.idx != player_idx and p.produces == buy_food)

    _clear_market(env)
    env.state.players[player_idx].cash = 100
    env.state.players[seller_idx].inventory[buy_food] = 10
    env.state.players[seller_idx].reserved_inventory[buy_food] = 0
    post_order(env.state, player_idx=seller_idx, side="ask", food_type=buy_food, quantity=1, price_per_unit=4)
    post_order(env.state, player_idx=player_idx, side="bid", food_type=buy_food, quantity=1, price_per_unit=4)

    agent = GreedyAgent()
    now = env.observe(player_idx)
    agent._ensure_initialized(now)
    agent._apply_trades(now)

    seller_est = agent._estimates[seller_idx]
    assert seller_est.cash == 104.0
    assert seller_est.inventory[buy_food] == 24.0

    agent._apply_trades(now)
    assert seller_est.cash == 104.0
    assert seller_est.inventory[buy_food] == 24.0


def test_profitable_action_outranks_cleanup():
    env, obs = _seeded_obs()
    player_idx = 0
    own_food = obs[player_idx]["produces"]
    buy_food = _player_required_foods(obs[player_idx])[0]
    seller_idx = next(p.idx for p in env.state.players if p.idx != player_idx and p.produces == buy_food)

    _clear_market(env)
    env.state.players[player_idx].cash = 100
    env.state.players[player_idx].inventory = {food: 8 for food in ("A", "B", "C", "D")}
    env.state.players[player_idx].inventory[own_food] = 1
    env.state.players[player_idx].inventory[buy_food] = 1
    env.state.players[player_idx].reserved_inventory = {food: 0 for food in ("A", "B", "C", "D")}
    env.state.players[player_idx].reserved_cash = 0

    for i in range(5):
        post_order(env.state, player_idx=player_idx, side="bid", food_type=buy_food, quantity=1, price_per_unit=1 + i)

    env.state.players[seller_idx].inventory[buy_food] = 10
    env.state.players[seller_idx].reserved_inventory[buy_food] = 0
    post_order(env.state, player_idx=seller_idx, side="ask", food_type=buy_food, quantity=2, price_per_unit=2)
    _seed_high_ask_market(env, player_idx, base_price=20, skip_foods={buy_food})

    agent = GreedyAgent(cancel_all_threshold=5)
    action = agent.act(env.observe(player_idx), env.legal_actions(player_idx))
    assert action != ACTION_CANCEL_ALL
    assert decode(action).side == "bid"


def test_cleanup_triggers_when_stale_orders_exist_without_profitable_trade():
    env, obs = _seeded_obs()
    player_idx = 0
    buy_food = _player_required_foods(obs[player_idx])[0]

    _clear_market(env)
    env.state.players[player_idx].cash = 100
    env.state.players[player_idx].reserved_cash = 0
    env.state.players[player_idx].inventory[obs[player_idx]["produces"]] = 1
    post_order(env.state, player_idx=player_idx, side="bid", food_type=buy_food, quantity=1, price_per_unit=3)

    agent = GreedyAgent(cancel_all_threshold=5)
    action = agent.act(env.observe(player_idx), env.legal_actions(player_idx))
    assert action == ACTION_CANCEL_ALL


def test_sell_willingness_responds_to_unified_anchor():
    env, obs = _seeded_obs()
    player_idx = 0
    own_food = obs[player_idx]["produces"]
    agent = GreedyAgent()

    env.state.players[player_idx].inventory = {food: 12 for food in ("A", "B", "C", "D")}
    env.state.players[player_idx].inventory[own_food] = 18
    env.state.players[player_idx].reserved_inventory = {food: 0 for food in ("A", "B", "C", "D")}
    env.state.players[player_idx].reserved_cash = 0

    rich_obs = env.observe(player_idx)
    agent._ensure_initialized(rich_obs)
    normalized = agent._normalized_food_values(
        inventory={f: float(rich_obs["available_inventory"][f]) for f in ("A", "B", "C", "D")},
        produces=rich_obs["produces"],
        required_foods=rich_obs["required_foods"],
    )
    market_anchor = agent._market_anchor(rich_obs, normalized)

    opp_idx = next(iter(agent._estimates))
    agent._estimates[opp_idx].cash = 10.0
    for food in ("A", "B", "C", "D"):
        agent._estimates[opp_idx].inventory[food] = 8.0
    agent._estimates[opp_idx].inventory[own_food] = 1.0
    low = agent._best_sell_candidate(rich_obs, env.legal_actions(player_idx), market_anchor)

    agent._estimates[opp_idx].cash = 100.0
    agent._estimates[opp_idx].inventory[own_food] = 1.0
    high = agent._best_sell_candidate(rich_obs, env.legal_actions(player_idx), market_anchor)

    assert low is not None
    assert high is not None
    assert decode(high[1]).price_per_unit >= decode(low[1]).price_per_unit


def test_action_is_always_legal_under_tight_cash():
    env, obs = _seeded_obs()
    player_idx = 0
    env.state.players[player_idx].cash = 2
    env.state.players[player_idx].reserved_cash = 0
    for food in ("A", "B", "C", "D"):
        env.state.players[player_idx].inventory[food] = 1 if food != obs[player_idx]["produces"] else 20
        env.state.players[player_idx].reserved_inventory[food] = 0

    agent = GreedyAgent()
    legal = env.legal_actions(player_idx)
    action = agent.act(env.observe(player_idx), legal)
    assert legal[action]
    decoded = decode(action)
    if hasattr(decoded, "side") and decoded.side == "bid":
        assert decoded.quantity * decoded.price_per_unit <= env.state.players[player_idx].cash
