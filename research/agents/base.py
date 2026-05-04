from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict

import numpy as np


class Agent(ABC):
    """Stateless or stateful policy. Must return a single integer in [0, NUM_ACTIONS)."""

    name: str = "agent"

    @abstractmethod
    def act(self, obs: Dict[str, Any], legal_mask: np.ndarray) -> int:
        ...

    def reset(self) -> None:
        """Called at the start of each episode. Override if the agent has state."""
        pass
