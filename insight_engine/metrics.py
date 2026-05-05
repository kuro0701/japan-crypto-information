"""Metric calculation utilities for exchange volume-share time series."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

REQUIRED_COLUMNS = {"date", "exchange", "volume_share"}


def load_data(path: str) -> pd.DataFrame:
    """Load volume-share data from a CSV file."""

    return pd.read_csv(Path(path))


def prepare_data(df: pd.DataFrame) -> pd.DataFrame:
    """Validate, coerce, de-duplicate, and sort input volume-share data.

    The returned frame has one row per ``date`` and ``exchange``. Duplicate
    pairs are summed, which is a conservative default for share-like source
    data that may arrive from multiple partial feeds.
    """

    result = _coerce_required_columns(df)

    extra_columns = [col for col in result.columns if col not in REQUIRED_COLUMNS]
    aggregations: dict[str, str] = {"volume_share": "sum"}
    aggregations.update({col: "first" for col in extra_columns})

    result = (
        result.groupby(["date", "exchange"], as_index=False, dropna=False)
        .agg(aggregations)
        .sort_values(["date", "exchange"])
        .reset_index(drop=True)
    )
    return result


def add_rank(df: pd.DataFrame) -> pd.DataFrame:
    """Add share ranking and previous-rank movement columns.

    Ranking uses ``method="min"`` so ties receive the same best rank.
    ``rank_change`` is positive when an exchange moves up.
    """

    result = _coerce_required_columns(df).copy()
    result = result.sort_values(["date", "exchange"]).reset_index(drop=True)
    result["rank"] = (
        result.groupby("date")["volume_share"]
        .rank(method="min", ascending=False)
        .astype("Int64")
    )
    result = result.sort_values(["exchange", "date"]).reset_index(drop=True)
    result["rank_prev"] = result.groupby("exchange")["rank"].shift(1).astype("Int64")
    result["rank_change"] = result["rank_prev"] - result["rank"]
    result["rank_direction"] = np.select(
        [
            result["rank_change"].gt(0).fillna(False),
            result["rank_change"].lt(0).fillna(False),
        ],
        ["up", "down"],
        default="flat",
    )
    return result.sort_values(["date", "rank", "exchange"]).reset_index(drop=True)


def add_share_change(
    df: pd.DataFrame, periods: int = 1, col_name: str = "share_change"
) -> pd.DataFrame:
    """Add exchange-level share change versus ``periods`` prior rows."""

    if periods < 1:
        raise ValueError("periods must be >= 1")

    result = _coerce_required_columns(df).copy()
    result = result.sort_values(["exchange", "date"]).reset_index(drop=True)
    result[col_name] = result.groupby("exchange")["volume_share"].diff(periods)
    return result.sort_values(["date", "exchange"]).reset_index(drop=True)


def add_gap_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """Add leader, adjacent-rank, and below-rank share gap metrics."""

    result = _coerce_required_columns(df).copy()
    if "rank" not in result.columns:
        result = add_rank(result)

    result = result.sort_values(["date", "rank", "exchange"]).reset_index(drop=True)
    result["leader_share"] = result.groupby("date")["volume_share"].transform("max")
    result["gap_to_leader"] = result["leader_share"] - result["volume_share"]
    result["share_above"] = result.groupby("date")["volume_share"].shift(1)
    result["share_below"] = result.groupby("date")["volume_share"].shift(-1)
    result["gap_to_above"] = result["share_above"] - result["volume_share"]
    result["gap_to_below"] = result["volume_share"] - result["share_below"]
    return result


def add_concentration_metrics(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Add date-level concentration metrics and return row/date frames.

    Returns:
        A tuple of ``(row_level_df, concentration_by_date_df)``.
    """

    result = _coerce_required_columns(df).copy()
    rows: list[dict[str, object]] = []
    for date, group in result.groupby("date", sort=True):
        shares = group["volume_share"].dropna().sort_values(ascending=False)
        rows.append(
            {
                "date": date,
                "top3_share": float(shares.head(3).sum()),
                "top5_share": float(shares.head(5).sum()),
                "hhi": float((shares**2).sum()),
                "exchange_count": int(shares.shape[0]),
            }
        )

    concentration = pd.DataFrame(rows).sort_values("date").reset_index(drop=True)
    merged = result.merge(concentration, on="date", how="left")
    return merged.sort_values(["date", "exchange"]).reset_index(drop=True), concentration


def add_zscore(df: pd.DataFrame, window: int = 8) -> pd.DataFrame:
    """Add prior-window rolling mean/std and z-score per exchange.

    The current row is compared against the previous ``window`` observations.
    Rows with insufficient history or zero rolling standard deviation receive
    ``NaN`` z-scores.
    """

    if window < 2:
        raise ValueError("window must be >= 2")

    result = _coerce_required_columns(df).copy()
    result = result.sort_values(["exchange", "date"]).reset_index(drop=True)

    grouped = result.groupby("exchange", group_keys=False)["volume_share"]
    result["rolling_mean"] = grouped.apply(
        lambda series: series.shift(1).rolling(window=window, min_periods=window).mean()
    )
    result["rolling_std"] = grouped.apply(
        lambda series: series.shift(1)
        .rolling(window=window, min_periods=window)
        .std(ddof=0)
    )
    result["rolling_window"] = window
    result["zscore"] = np.where(
        result["rolling_std"].gt(0),
        (result["volume_share"] - result["rolling_mean"]) / result["rolling_std"],
        np.nan,
    )
    return result.sort_values(["date", "exchange"]).reset_index(drop=True)


def add_streaks(df: pd.DataFrame) -> pd.DataFrame:
    """Add consecutive increase/decrease streak lengths per exchange."""

    result = _coerce_required_columns(df).copy()
    result = result.sort_values(["exchange", "date"]).reset_index(drop=True)

    def add_group_streaks(exchange: str, group: pd.DataFrame) -> pd.DataFrame:
        group = group.sort_values("date").copy()
        group["exchange"] = exchange
        increase_streak: list[int] = []
        decrease_streak: list[int] = []
        inc_count = 0
        dec_count = 0

        for delta in group["volume_share"].diff():
            if pd.isna(delta) or delta == 0:
                inc_count = 0
                dec_count = 0
            elif delta > 0:
                inc_count += 1
                dec_count = 0
            else:
                dec_count += 1
                inc_count = 0
            increase_streak.append(inc_count)
            decrease_streak.append(dec_count)

        group["increase_streak"] = increase_streak
        group["decrease_streak"] = decrease_streak
        return group

    pieces = [
        add_group_streaks(str(exchange), group)
        for exchange, group in result.groupby("exchange", sort=False)
    ]
    result = pd.concat(pieces, ignore_index=True) if pieces else result
    return result.sort_values(["date", "exchange"]).reset_index(drop=True)


def add_all_metrics(
    df: pd.DataFrame, periods: int = 1, window: int = 8
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Prepare data and add all metrics required by the insight engine."""

    result = prepare_data(df)
    result = add_rank(result)
    result = add_share_change(result, periods=periods)
    result = add_gap_metrics(result)
    result, concentration = add_concentration_metrics(result)
    result = add_zscore(result, window=window)
    result = add_streaks(result)
    return result, concentration


def _coerce_required_columns(df: pd.DataFrame) -> pd.DataFrame:
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        missing_text = ", ".join(sorted(missing))
        raise ValueError(f"Missing required columns: {missing_text}")

    result = df.copy()
    result["date"] = pd.to_datetime(result["date"], errors="coerce")
    result["exchange"] = result["exchange"].astype("string").str.strip()
    result["volume_share"] = pd.to_numeric(result["volume_share"], errors="coerce")
    result = result.replace({"exchange": {"": pd.NA}})
    result = result.dropna(subset=["date", "exchange", "volume_share"]).copy()
    result["exchange"] = result["exchange"].astype(str)
    return result
