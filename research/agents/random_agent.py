from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np

from env.actions import ACTION_NOOP

from .base import Agent


class RandomAgent(Agent):
    """Uniform random over legal actions. Each instance carries its own RNG.

    NOTE: this RNG is *separate* from the env's RNG. To make a full game
    deterministic, you must seed both.
    """

    name = "random"

    def __init__(self, seed: Optional[int] = None) -> None:
        self.rng = np.random.default_rng(seed)

    def act(self, obs: Dict[str, Any], legal_mask: np.ndarray) -> int:
        legal_indices = np.flatnonzero(legal_mask)
        if legal_indices.size == 0:
            return ACTION_NOOP
        return int(self.rng.choice(legal_indices))

    def reset(self) -> None:
        # Reset to fresh RNG state if desired. For now we keep the existing RNG
        # so consecutive games are different.
        pass
