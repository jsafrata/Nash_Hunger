"""Centralized RNG so every random draw is reproducible from a single seed."""
from __future__ import annotations

from typing import Iterable, List, TypeVar
import numpy as np


T = TypeVar("T")


def make_rng(seed: int) -> np.random.Generator:
    """Construct an isolated PCG64 generator from `seed`. Same seed → same draws."""
    return np.random.default_rng(seed)


def shuffle_in_place(rng: np.random.Generator, items: List[T]) -> None:
    """In-place Fisher-Yates with the given generator."""
    n = len(items)
    for i in range(n - 1, 0, -1):
        j = int(rng.integers(0, i + 1))
        items[i], items[j] = items[j], items[i]


def shuffled(rng: np.random.Generator, items: Iterable[T]) -> List[T]:
    out = list(items)
    shuffle_in_place(rng, out)
    return out
