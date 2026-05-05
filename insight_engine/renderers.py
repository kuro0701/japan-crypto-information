"""Japanese renderers for structured insights."""

from __future__ import annotations

from typing import Any

import pandas as pd

from .insights import generate_structured_insights
from .schemas import Insight


def render_insights_ja(insights: list[Insight | dict[str, Any]]) -> str:
    """Render structured insights into a Japanese bullet report."""

    normalized = [_to_insight(insight) for insight in insights]
    normalized = sorted(normalized, key=lambda item: item.priority, reverse=True)
    if not normalized:
        return "・有意な変化は検出されませんでした。"

    lines = [f"・{insight.message_ja or _fallback_message(insight)}" for insight in normalized]
    return "\n".join(lines)


def generate_report(df: pd.DataFrame, config: dict[str, Any] | None = None) -> str:
    """Generate a Japanese insight report from raw volume-share data."""

    insights = generate_structured_insights(df, config=config)
    return render_insights_ja(insights)


def _to_insight(value: Insight | dict[str, Any]) -> Insight:
    if isinstance(value, Insight):
        return value
    return Insight(
        type=str(value.get("type", "")),
        exchange=value.get("exchange"),
        metric=str(value.get("metric", "")),
        value=value.get("value"),
        unit=value.get("unit"),
        direction=value.get("direction"),
        priority=int(value.get("priority", 0)),
        message_ja=str(value.get("message_ja", "")),
        metadata=dict(value.get("metadata", {})),
    )


def _fallback_message(insight: Insight) -> str:
    subject = insight.exchange or insight.metric
    if insight.unit == "pt" and isinstance(insight.value, (float, int)):
        value = _fmt_pt(float(insight.value))
    elif insight.unit == "sigma" and isinstance(insight.value, (float, int)):
        value = _fmt_sigma(float(insight.value))
    else:
        value = "" if insight.value is None else str(insight.value)
    return f"{subject} に {insight.type} が検出されました（{value}）。"


def _fmt_pt(value: float) -> str:
    sign = "+" if value > 0 else ""
    return f"{sign}{value * 100:.1f}pt"


def _fmt_sigma(value: float) -> str:
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.1f}σ"
