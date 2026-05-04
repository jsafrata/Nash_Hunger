"""Game setup: deck creation, dealing, producer assignment."""
from __future__ import annotations

from typing import List
import numpy as np

from .config import GameConfig
from .types import GameState, OrderBook, Player, empty_inventory
from .rng import shuffle_in_place, shuffled


def create_initial_deck(config: GameConfig) -> List[str]:
    deck: List[str] = []
    for food in config.food_types:
        for _ in range(config.initial_units_per_food_type):
            deck.append(food)
    return deck


def deal_initial_food(
    config: GameConfig, players: List[Player], deck: List[str]
) -> None:
    if len(deck) < config.player_count * config.initial_units_per_player:
        raise ValueError("Deck too small to deal")
    cursor = 0
    for player in players:
        player.inventory = empty_inventory()
        for _ in range(config.initial_units_per_player):
            food = deck[cursor]
            cursor += 1
            player.inventory[food] += 1


def assign_producers(
    rng: np.random.Generator, config: GameConfig, players: List[Player]
) -> None:
    if len(players) != config.player_count:
        raise ValueError(
            f"need exactly {config.player_count} players, got {len(players)}"
        )
    foods = shuffled(rng, list(config.food_types))
    for i, p in enumerate(players):
        p.produces = foods[i]


def initial_state(
    config: GameConfig,
    rng: np.random.Generator,
    player_names: List[str],
) -> GameState:
    if len(player_names) != config.player_count:
        raise ValueError(
            f"expected {config.player_count} player names, got {len(player_names)}"
        )

    players: List[Player] = [
        Player(idx=i, name=name) for i, name in enumerate(player_names)
    ]

    state = GameState(
        config=config,
        players=players,
        order_books={f: OrderBook(food_type=f) for f in config.food_types},
        elapsed_seconds=0,
        phase="active",
    )

    assign_producers(rng, config, players)

    deck = create_initial_deck(config)
    shuffle_in_place(rng, deck)
    deal_initial_food(config, players, deck)

    for p in players:
        p.cash = config.initial_cash

    return state
