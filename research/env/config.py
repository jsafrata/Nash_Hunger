"""Game configuration constants. Mirrors backend/src/config.ts."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Tuple


FOOD_TYPES: Tuple[str, ...] = ("A", "B", "C", "D")

FOOD_DISPLAY_NAMES = {
    "A": "Ube",
    "B": "Iceberg",
    "C": "Oats",
    "D": "Pork",
}


@dataclass(frozen=True)
class GameConfig:
    player_count: int = 4
    food_types: Tuple[str, ...] = FOOD_TYPES
    initial_cash: int = 100
    initial_units_per_food_type: int = 100
    initial_units_per_player: int = 100
    game_duration_seconds: int = 180
    production_per_second: int = 2
    consumption_per_required_food_per_second: int = 1
    min_price: int = 0
    min_order_quantity: int = 1
    max_open_orders_per_player: int = 50
    max_new_orders_per_player_per_second: int = 10
    max_cancels_per_player_per_second: int = 20

    def required_foods(self, produces: str) -> Tuple[str, ...]:
        return tuple(f for f in self.food_types if f != produces)


DEFAULT_CONFIG = GameConfig()
