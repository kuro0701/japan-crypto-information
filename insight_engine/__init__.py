"""Rule-based insight engine for exchange volume-share time series."""

from .insights import generate_structured_insights
from .metrics import (
    add_concentration_metrics,
    add_gap_metrics,
    add_rank,
    add_share_change,
    add_streaks,
    add_zscore,
    load_data,
    prepare_data,
)
from .renderers import generate_report, render_insights_ja
from .schemas import Insight, InsightConfig

__all__ = [
    "Insight",
    "InsightConfig",
    "add_concentration_metrics",
    "add_gap_metrics",
    "add_rank",
    "add_share_change",
    "add_streaks",
    "add_zscore",
    "generate_report",
    "generate_structured_insights",
    "load_data",
    "prepare_data",
    "render_insights_ja",
]
