"""Schemas used by the rule-based insight engine."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, fields
from typing import Any


@dataclass(frozen=True)
class Insight:
    """Structured insight object that can be rendered or passed to an LLM."""

    type: str
    metric: str
    value: float | int | None = None
    unit: str | None = None
    direction: str | None = None
    priority: int = 0
    message_ja: str = ""
    exchange: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-serializable dictionary representation."""

        return asdict(self)


@dataclass(frozen=True)
class InsightConfig:
    """Configuration for metric windows, thresholds, and report length."""

    periods: int = 1
    window: int = 8
    max_insights: int = 8
    min_share_change: float = 0.002
    zscore_threshold: float = 2.0
    min_rank_change_share: float = 0.002
    gap_change_threshold: float = 0.002
    concentration_change_threshold: float = 0.002
    hhi_change_threshold: float = 0.0005
    min_streak: int = 3
    max_rank_movement_insights: int = 2
    max_gap_insights: int = 2
    period_label: str | None = None

    @classmethod
    def from_dict(cls, config: dict[str, Any] | None = None) -> "InsightConfig":
        """Create config from a dict while ignoring unknown keys."""

        if config is None:
            return cls()

        allowed = {field.name for field in fields(cls)}
        values = {key: value for key, value in config.items() if key in allowed}
        return cls(**values)
