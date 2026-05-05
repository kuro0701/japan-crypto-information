import math

import pandas as pd

from insight_engine.metrics import (
    add_concentration_metrics,
    add_gap_metrics,
    add_rank,
    add_share_change,
    add_streaks,
    add_zscore,
    prepare_data,
)


def test_rank_calculation_is_correct():
    df = prepare_data(
        pd.DataFrame(
            {
                "date": ["2026-01-01", "2026-01-01", "2026-01-01"],
                "exchange": ["A", "B", "C"],
                "volume_share": [0.30, 0.50, 0.20],
            }
        )
    )

    ranked = add_rank(df)
    ranks = dict(zip(ranked["exchange"], ranked["rank"]))

    assert ranks == {"B": 1, "A": 2, "C": 3}


def test_share_change_calculation_is_correct():
    df = prepare_data(
        pd.DataFrame(
            {
                "date": ["2026-01-01", "2026-01-08", "2026-01-01", "2026-01-08"],
                "exchange": ["A", "A", "B", "B"],
                "volume_share": [0.30, 0.35, 0.20, 0.18],
            }
        )
    )

    changed = add_share_change(df)
    latest = changed[changed["date"] == pd.Timestamp("2026-01-08")]
    changes = dict(zip(latest["exchange"], latest["share_change"]))

    assert math.isclose(changes["A"], 0.05)
    assert math.isclose(changes["B"], -0.02)


def test_gap_to_leader_is_correct():
    df = prepare_data(
        pd.DataFrame(
            {
                "date": ["2026-01-01", "2026-01-01", "2026-01-01"],
                "exchange": ["A", "B", "C"],
                "volume_share": [0.50, 0.30, 0.20],
            }
        )
    )

    gapped = add_gap_metrics(add_rank(df))
    row_b = gapped[gapped["exchange"] == "B"].iloc[0]

    assert math.isclose(row_b["gap_to_leader"], 0.20)
    assert math.isclose(row_b["gap_to_above"], 0.20)
    assert math.isclose(row_b["gap_to_below"], 0.10)


def test_top3_top5_hhi_are_correct():
    df = prepare_data(
        pd.DataFrame(
            {
                "date": ["2026-01-01"] * 6,
                "exchange": ["A", "B", "C", "D", "E", "F"],
                "volume_share": [0.30, 0.20, 0.10, 0.05, 0.04, 0.01],
            }
        )
    )

    _, concentration = add_concentration_metrics(df)
    row = concentration.iloc[0]

    assert math.isclose(row["top3_share"], 0.60)
    assert math.isclose(row["top5_share"], 0.69)
    assert math.isclose(row["hhi"], 0.1442)


def test_zscore_is_calculated_with_prior_window():
    df = prepare_data(
        pd.DataFrame(
            {
                "date": ["2026-01-01", "2026-01-08", "2026-01-15"],
                "exchange": ["A", "A", "A"],
                "volume_share": [0.10, 0.20, 0.30],
            }
        )
    )

    scored = add_zscore(df, window=2)
    latest = scored[scored["date"] == pd.Timestamp("2026-01-15")].iloc[0]

    assert math.isclose(latest["rolling_mean"], 0.15)
    assert math.isclose(latest["rolling_std"], 0.05)
    assert math.isclose(latest["zscore"], 3.0)


def test_streaks_are_correct():
    df = prepare_data(
        pd.DataFrame(
            {
                "date": ["2026-01-01", "2026-01-08", "2026-01-15", "2026-01-22"],
                "exchange": ["A", "A", "A", "A"],
                "volume_share": [0.10, 0.20, 0.30, 0.25],
            }
        )
    )

    streaked = add_streaks(df)
    third = streaked[streaked["date"] == pd.Timestamp("2026-01-15")].iloc[0]
    fourth = streaked[streaked["date"] == pd.Timestamp("2026-01-22")].iloc[0]

    assert third["increase_streak"] == 2
    assert third["decrease_streak"] == 0
    assert fourth["increase_streak"] == 0
    assert fourth["decrease_streak"] == 1
