"""Baseline agents for Nash Hunger."""
from .base import Agent
from .random_agent import RandomAgent
from .noop_agent import NoopAgent
from .greedy_agent import GreedyAgent
from .old_greedy_agent import OldGreedyAgent
from .buffer_agent import BufferAgent

# Convenience registry for the CLI runners
AGENT_REGISTRY = {
    "random": RandomAgent,
    "noop": NoopAgent,
    "greedy": GreedyAgent,
    "old_greedy": OldGreedyAgent,
    "buffer": BufferAgent,
}
