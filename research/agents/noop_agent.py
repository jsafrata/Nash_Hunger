from __future__ import annotations

from typing import Any, Dict

import numpy as np

from env.actions import ACTION_NOOP

from .base import Agent


class NoopAgent(Agent):
    """Always do nothing. Used as a control."""

    name = "noop"

    def act(self, obs: Dict[str, Any], legal_mask: np.ndarray) -> int:
        return ACTION_NOOP
