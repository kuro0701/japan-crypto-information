"""Rule-based insight extraction from enriched volume-share metrics."""

from __future__ import annotations

import math
from typing import Any

import pandas as pd

from .metrics import add_all_metrics
from .schemas import Insight, InsightConfig


def generate_structured_insights(
    df: pd.DataFrame, config: dict[str, Any] | None = None
) -> list[Insight]:
    """Generate prioritized structured insights from raw or prepared data."""

    cfg = InsightConfig.from_dict(config)
    metrics_df, concentration = add_all_metrics(df, periods=cfg.periods, window=cfg.window)
    if metrics_df.empty:
        return []

    metrics_df = _add_previous_gap_columns(metrics_df, cfg.periods)
    concentration = _add_concentration_changes(concentration, cfg.periods)

    terms = _period_terms(metrics_df, cfg)
    dates = sorted(metrics_df["date"].dropna().unique())
    if not dates:
        return []

    latest_date = dates[-1]
    previous_date = dates[-1 - cfg.periods] if len(dates) > cfg.periods else None
    latest = metrics_df[metrics_df["date"] == latest_date].copy()
    previous = (
        metrics_df[metrics_df["date"] == previous_date].copy()
        if previous_date is not None
        else pd.DataFrame()
    )

    candidates: list[Insight] = []
    candidates.extend(_top_movers(latest, cfg, terms))
    candidates.extend(_leader_insights(latest, previous, cfg, terms))
    candidates.extend(_rank_movement_insights(latest, cfg, terms))
    candidates.extend(_gap_change_insights(latest, cfg, terms))
    candidates.extend(_streak_insights(latest, cfg, terms))
    candidates.extend(_zscore_insights(latest, cfg, terms))
    candidates.extend(_market_structure_insights(concentration, latest_date, cfg, terms))

    return _deduplicate_and_limit(candidates, cfg.max_insights)


def _top_movers(
    latest: pd.DataFrame, cfg: InsightConfig, terms: dict[str, str]
) -> list[Insight]:
    rows = latest.dropna(subset=["share_change"])
    if rows.empty:
        return []

    insights: list[Insight] = []
    gainer = rows.loc[rows["share_change"].idxmax()]
    loser = rows.loc[rows["share_change"].idxmin()]

    if gainer["share_change"] >= cfg.min_share_change:
        change = float(gainer["share_change"])
        insights.append(
            Insight(
                type="top_gainer",
                exchange=str(gainer["exchange"]),
                metric="share_change",
                value=change,
                unit="pt",
                direction="up",
                priority=90 + min(int(abs(change) * 1000), 9),
                message_ja=(
                    f"{terms['current_label']}の最大シェア増加は "
                    f"{gainer['exchange']}（{terms['comparison_label']} "
                    f"{_fmt_pt(change)}）です。"
                ),
                metadata={"dedupe_key": "top_gainer"},
            )
        )

    if loser["share_change"] <= -cfg.min_share_change:
        change = float(loser["share_change"])
        insights.append(
            Insight(
                type="top_loser",
                exchange=str(loser["exchange"]),
                metric="share_change",
                value=change,
                unit="pt",
                direction="down",
                priority=88 + min(int(abs(change) * 1000), 9),
                message_ja=(
                    f"{terms['current_label']}の最大シェア低下は "
                    f"{loser['exchange']}（{terms['comparison_label']} "
                    f"{_fmt_pt(change)}）です。"
                ),
                metadata={"dedupe_key": "top_loser"},
            )
        )

    return insights


def _leader_insights(
    latest: pd.DataFrame,
    previous: pd.DataFrame,
    cfg: InsightConfig,
    terms: dict[str, str],
) -> list[Insight]:
    if latest.empty:
        return []

    latest_leader = latest.sort_values(["rank", "exchange"]).iloc[0]
    latest_second_gap = _leader_second_gap(latest)
    insights: list[Insight] = []

    if previous.empty:
        insights.append(
            Insight(
                type="leader_hold",
                exchange=str(latest_leader["exchange"]),
                metric="rank",
                value=1,
                unit="rank",
                direction="flat",
                priority=45,
                message_ja=(
                    f"{latest_leader['exchange']} が首位です"
                    f"（シェア {_fmt_share(float(latest_leader['volume_share']))}）。"
                ),
                metadata={"dedupe_key": "leader_summary"},
            )
        )
        return insights

    previous_leader = previous.sort_values(["rank", "exchange"]).iloc[0]
    previous_second_gap = _leader_second_gap(previous)

    if latest_leader["exchange"] != previous_leader["exchange"]:
        insights.append(
            Insight(
                type="leader_change",
                exchange=str(latest_leader["exchange"]),
                metric="rank",
                value=1,
                unit="rank",
                direction="up",
                priority=100,
                message_ja=(
                    f"首位は {previous_leader['exchange']} から "
                    f"{latest_leader['exchange']} に交代しました"
                    f"（{latest_leader['exchange']} "
                    f"{_fmt_share(float(latest_leader['volume_share']))}）。"
                ),
                metadata={
                    "previous_exchange": str(previous_leader["exchange"]),
                    "dedupe_key": "leader_summary",
                },
            )
        )
        return insights

    gap_change = (
        latest_second_gap - previous_second_gap
        if _is_number(latest_second_gap) and _is_number(previous_second_gap)
        else math.nan
    )
    if _is_number(gap_change) and abs(gap_change) >= cfg.gap_change_threshold:
        direction = "narrow" if gap_change < 0 else "widen"
        direction_ja = "縮小" if direction == "narrow" else "拡大"
        insights.append(
            Insight(
                type="leader_gap_change",
                exchange=str(latest_leader["exchange"]),
                metric="leader_second_gap",
                value=float(gap_change),
                unit="pt",
                direction=direction,
                priority=78 + min(int(abs(gap_change) * 1000), 7),
                message_ja=(
                    f"{latest_leader['exchange']} は首位を維持していますが、"
                    f"2位との差は前回の {_fmt_pt(previous_second_gap, signed=False)} "
                    f"から {_fmt_pt(latest_second_gap, signed=False)} へ{direction_ja}しています。"
                ),
                metadata={
                    "previous_gap": float(previous_second_gap),
                    "latest_gap": float(latest_second_gap),
                    "dedupe_key": "leader_summary",
                },
            )
        )
    else:
        insights.append(
            Insight(
                type="leader_hold",
                exchange=str(latest_leader["exchange"]),
                metric="rank",
                value=1,
                unit="rank",
                direction="flat",
                priority=45,
                message_ja=(
                    f"{latest_leader['exchange']} は首位を維持しています"
                    f"（シェア {_fmt_share(float(latest_leader['volume_share']))}）。"
                ),
                metadata={"dedupe_key": "leader_summary"},
            )
        )

    return insights


def _rank_movement_insights(
    latest: pd.DataFrame, cfg: InsightConfig, terms: dict[str, str]
) -> list[Insight]:
    if latest.empty or "rank_change" not in latest.columns:
        return []

    rows = latest.dropna(subset=["rank_change", "rank_prev", "share_change"]).copy()
    rows = rows[rows["rank_change"] != 0]
    if rows.empty:
        return []

    material = rows[
        (rows["share_change"].abs() >= cfg.min_rank_change_share)
        | (rows["rank_change"].abs() >= 2)
    ].copy()
    if material.empty:
        return []

    material["movement_score"] = (
        material["rank_change"].abs() * 10 + material["share_change"].abs() * 1000
    )
    material = material.sort_values("movement_score", ascending=False)
    insights: list[Insight] = []

    for _, row in material.head(cfg.max_rank_movement_insights).iterrows():
        rank_change = int(row["rank_change"])
        direction = "up" if rank_change > 0 else "down"
        direction_ja = "上昇" if direction == "up" else "低下"
        priority = 74 if direction == "up" else 72
        insights.append(
            Insight(
                type=f"rank_{direction}",
                exchange=str(row["exchange"]),
                metric="rank_change",
                value=rank_change,
                unit="rank",
                direction=direction,
                priority=priority + min(abs(rank_change), 5),
                message_ja=(
                    f"{row['exchange']} は{int(row['rank_prev'])}位から"
                    f"{int(row['rank'])}位へ{direction_ja}しました"
                    f"（{terms['comparison_label']} {_fmt_pt(float(row['share_change']))}）。"
                ),
                metadata={"dedupe_key": f"rank:{row['exchange']}"},
            )
        )

    return insights


def _gap_change_insights(
    latest: pd.DataFrame, cfg: InsightConfig, terms: dict[str, str]
) -> list[Insight]:
    rows = latest.copy()
    insights: list[Insight] = []

    leader_gap_rows = rows.dropna(subset=["gap_to_leader_change", "gap_to_leader_prev"])
    leader_gap_rows = leader_gap_rows[leader_gap_rows["rank"] != 1]
    leader_gap_rows = leader_gap_rows[
        leader_gap_rows["gap_to_leader_change"].abs() >= cfg.gap_change_threshold
    ].copy()

    if not leader_gap_rows.empty:
        leader_gap_rows["score"] = leader_gap_rows["gap_to_leader_change"].abs()
        for _, row in leader_gap_rows.sort_values("score", ascending=False).head(1).iterrows():
            gap_change = float(row["gap_to_leader_change"])
            direction = "narrow" if gap_change < 0 else "widen"
            direction_ja = "縮小" if direction == "narrow" else "拡大"
            insights.append(
                Insight(
                    type="leader_gap_narrow" if direction == "narrow" else "leader_gap_widen",
                    exchange=str(row["exchange"]),
                    metric="gap_to_leader",
                    value=gap_change,
                    unit="pt",
                    direction=direction,
                    priority=66 + min(int(abs(gap_change) * 1000), 6),
                    message_ja=(
                        f"{row['exchange']} は首位との差が前回の "
                        f"{_fmt_pt(float(row['gap_to_leader_prev']), signed=False)} から "
                        f"{_fmt_pt(float(row['gap_to_leader']), signed=False)} へ"
                        f"{direction_ja}しています。"
                    ),
                    metadata={"dedupe_key": f"leader_gap:{row['exchange']}"},
                )
            )

    above_gap_rows = rows.dropna(subset=["gap_to_above_change", "gap_to_above_prev"])
    above_gap_rows = above_gap_rows[above_gap_rows["rank"] > 2]
    above_gap_rows = above_gap_rows[
        above_gap_rows["gap_to_above_change"].abs() >= cfg.gap_change_threshold
    ].copy()

    if not above_gap_rows.empty:
        above_gap_rows["score"] = above_gap_rows["gap_to_above_change"].abs()
        for _, row in above_gap_rows.sort_values("score", ascending=False).head(1).iterrows():
            gap_change = float(row["gap_to_above_change"])
            direction = "narrow" if gap_change < 0 else "widen"
            direction_ja = "縮小" if direction == "narrow" else "拡大"
            insights.append(
                Insight(
                    type="above_gap_narrow" if direction == "narrow" else "above_gap_widen",
                    exchange=str(row["exchange"]),
                    metric="gap_to_above",
                    value=gap_change,
                    unit="pt",
                    direction=direction,
                    priority=62 + min(int(abs(gap_change) * 1000), 6),
                    message_ja=(
                        f"{row['exchange']} は直上順位との差が前回の "
                        f"{_fmt_pt(float(row['gap_to_above_prev']), signed=False)} から "
                        f"{_fmt_pt(float(row['gap_to_above']), signed=False)} へ"
                        f"{direction_ja}しています。"
                    ),
                    metadata={"dedupe_key": f"above_gap:{row['exchange']}"},
                )
            )

    return insights[: cfg.max_gap_insights]


def _streak_insights(
    latest: pd.DataFrame, cfg: InsightConfig, terms: dict[str, str]
) -> list[Insight]:
    rows = latest.copy()
    candidates: list[Insight] = []

    for _, row in rows.iterrows():
        increase_streak = int(row.get("increase_streak", 0))
        decrease_streak = int(row.get("decrease_streak", 0))
        rank_change = row.get("rank_change")
        unchanged = _is_number(rank_change) and int(rank_change) == 0
        prefix = "順位変動はないものの、" if unchanged else ""

        if increase_streak >= cfg.min_streak:
            candidates.append(
                Insight(
                    type="increase_streak",
                    exchange=str(row["exchange"]),
                    metric="increase_streak",
                    value=increase_streak,
                    unit=terms["streak_unit"],
                    direction="up",
                    priority=58 + min(increase_streak, 8),
                    message_ja=(
                        f"{row['exchange']} は{prefix}シェアが"
                        f"{increase_streak}{terms['streak_unit']}連続で上昇しています。"
                    ),
                    metadata={"dedupe_key": f"streak:{row['exchange']}"},
                )
            )

        if decrease_streak >= cfg.min_streak:
            candidates.append(
                Insight(
                    type="decrease_streak",
                    exchange=str(row["exchange"]),
                    metric="decrease_streak",
                    value=decrease_streak,
                    unit=terms["streak_unit"],
                    direction="down",
                    priority=58 + min(decrease_streak, 8),
                    message_ja=(
                        f"{row['exchange']} は{prefix}シェアが"
                        f"{decrease_streak}{terms['streak_unit']}連続で低下しています。"
                    ),
                    metadata={"dedupe_key": f"streak:{row['exchange']}"},
                )
            )

    return sorted(candidates, key=lambda item: item.priority, reverse=True)[:2]


def _zscore_insights(
    latest: pd.DataFrame, cfg: InsightConfig, terms: dict[str, str]
) -> list[Insight]:
    rows = latest.dropna(subset=["zscore"]).copy()
    rows = rows[rows["zscore"].abs() >= cfg.zscore_threshold]
    if rows.empty:
        return []

    rows["abs_zscore"] = rows["zscore"].abs()
    insights: list[Insight] = []
    for _, row in rows.sort_values("abs_zscore", ascending=False).head(2).iterrows():
        zscore = float(row["zscore"])
        direction = "up" if zscore > 0 else "down"
        direction_ja = "上振れ" if direction == "up" else "下振れ"
        insights.append(
            Insight(
                type="zscore_outlier",
                exchange=str(row["exchange"]),
                metric="zscore",
                value=zscore,
                unit="sigma",
                direction=direction,
                priority=54 + min(int(abs(zscore)), 6),
                message_ja=(
                    f"{row['exchange']} は過去{cfg.window}{terms['streak_unit']}平均対比で "
                    f"{_fmt_sigma(zscore)} の{direction_ja}です。"
                ),
                metadata={"dedupe_key": f"zscore:{row['exchange']}"},
            )
        )

    return insights


def _market_structure_insights(
    concentration: pd.DataFrame,
    latest_date: pd.Timestamp,
    cfg: InsightConfig,
    terms: dict[str, str],
) -> list[Insight]:
    if concentration.empty:
        return []

    latest_rows = concentration[concentration["date"] == latest_date]
    if latest_rows.empty:
        return []

    latest = latest_rows.iloc[0]
    candidates: list[Insight] = []

    for metric, label in [("top3_share", "Top3集中度"), ("top5_share", "Top5集中度")]:
        change_col = f"{metric}_change"
        if change_col not in latest or not _is_number(latest[change_col]):
            continue

        change = float(latest[change_col])
        if abs(change) < cfg.concentration_change_threshold:
            continue

        direction = "concentrating" if change > 0 else "dispersing"
        direction_ja = "集中方向" if direction == "concentrating" else "分散方向"
        candidates.append(
            Insight(
                type="market_concentration",
                metric=metric,
                value=change,
                unit="pt",
                direction=direction,
                priority=46 + min(int(abs(change) * 1000), 5),
                message_ja=(
                    f"{label}は{terms['comparison_label']} {_fmt_pt(change)} で、"
                    f"市場はやや{direction_ja}です。"
                ),
                metadata={"dedupe_key": "market_structure"},
            )
        )

    if "hhi_change" in latest and _is_number(latest["hhi_change"]):
        change = float(latest["hhi_change"])
        if abs(change) >= cfg.hhi_change_threshold:
            direction = "concentrating" if change > 0 else "dispersing"
            direction_ja = "集中方向" if direction == "concentrating" else "分散方向"
            candidates.append(
                Insight(
                    type="hhi_change",
                    metric="hhi",
                    value=change,
                    unit="index",
                    direction=direction,
                    priority=44 + min(int(abs(change) * 10000), 5),
                    message_ja=(
                        f"HHIは{terms['comparison_label']} {_fmt_decimal(change)} となり、"
                        f"市場構造はやや{direction_ja}に動いています。"
                    ),
                    metadata={"dedupe_key": "market_structure"},
                )
            )

    return sorted(candidates, key=lambda item: item.priority, reverse=True)[:1]


def _add_previous_gap_columns(df: pd.DataFrame, periods: int) -> pd.DataFrame:
    result = df.sort_values(["exchange", "date"]).copy()
    for col in ["gap_to_leader", "gap_to_above", "gap_to_below"]:
        if col in result.columns:
            prev_col = f"{col}_prev"
            change_col = f"{col}_change"
            result[prev_col] = result.groupby("exchange")[col].shift(periods)
            result[change_col] = result[col] - result[prev_col]
    return result.sort_values(["date", "rank", "exchange"]).reset_index(drop=True)


def _add_concentration_changes(concentration: pd.DataFrame, periods: int) -> pd.DataFrame:
    if concentration.empty:
        return concentration

    result = concentration.sort_values("date").copy()
    for col in ["top3_share", "top5_share", "hhi"]:
        if col in result.columns:
            result[f"{col}_change"] = result[col].diff(periods)
    return result.reset_index(drop=True)


def _leader_second_gap(frame: pd.DataFrame) -> float:
    top_rows = frame.sort_values(["rank", "exchange"]).head(2)
    if len(top_rows) < 2:
        return math.nan
    return float(top_rows.iloc[0]["volume_share"] - top_rows.iloc[1]["volume_share"])


def _deduplicate_and_limit(candidates: list[Insight], max_insights: int) -> list[Insight]:
    selected: list[Insight] = []
    seen: set[str] = set()
    for insight in sorted(candidates, key=lambda item: item.priority, reverse=True):
        key = str(
            insight.metadata.get(
                "dedupe_key",
                f"{insight.type}:{insight.exchange or '-'}:{insight.metric}",
            )
        )
        if key in seen:
            continue
        selected.append(insight)
        seen.add(key)
        if len(selected) >= max_insights:
            break
    return selected


def _period_terms(df: pd.DataFrame, cfg: InsightConfig) -> dict[str, str]:
    if cfg.period_label:
        label = cfg.period_label
        if label in {"week", "weekly", "週", "週次"}:
            return {
                "current_label": "今週",
                "comparison_label": "前週比",
                "streak_unit": "週",
            }
        if label in {"month", "monthly", "月", "月次"}:
            return {
                "current_label": "今月",
                "comparison_label": "前月比",
                "streak_unit": "カ月",
            }

    dates = pd.Series(sorted(df["date"].dropna().unique()))
    if len(dates) >= 2:
        deltas = dates.diff().dropna().dt.days
        median_days = float(deltas.median()) if not deltas.empty else math.nan
        if 5 <= median_days <= 9:
            return {
                "current_label": "今週",
                "comparison_label": "前週比",
                "streak_unit": "週",
            }
        if 25 <= median_days <= 35:
            return {
                "current_label": "今月",
                "comparison_label": "前月比",
                "streak_unit": "カ月",
            }

    return {
        "current_label": "最新期間",
        "comparison_label": "前回比",
        "streak_unit": "期間",
    }


def _fmt_share(value: float) -> str:
    return f"{value * 100:.1f}%"


def _fmt_pt(value: float, signed: bool = True) -> str:
    sign = "+" if signed and value > 0 else ""
    return f"{sign}{value * 100:.1f}pt"


def _fmt_sigma(value: float) -> str:
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.1f}σ"


def _fmt_decimal(value: float) -> str:
    sign = "+" if value > 0 else ""
    return f"{sign}{value:.4f}"


def _is_number(value: Any) -> bool:
    if value is None or pd.isna(value):
        return False
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False
