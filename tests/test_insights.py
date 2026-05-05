import pandas as pd

from insight_engine.insights import generate_structured_insights


def _weekly_df():
    return pd.DataFrame(
        {
            "date": [
                "2026-01-01",
                "2026-01-01",
                "2026-01-01",
                "2026-01-08",
                "2026-01-08",
                "2026-01-08",
            ],
            "exchange": ["A", "B", "C", "A", "B", "C"],
            "volume_share": [0.50, 0.30, 0.20, 0.40, 0.45, 0.15],
        }
    )


def test_top_gainer_and_loser_insights_are_generated():
    insights = generate_structured_insights(
        _weekly_df(), config={"window": 2, "max_insights": 8}
    )
    types = {insight.type for insight in insights}

    assert "top_gainer" in types
    assert "top_loser" in types


def test_leader_change_insight_is_generated():
    insights = generate_structured_insights(
        _weekly_df(), config={"window": 2, "max_insights": 8}
    )
    leader_changes = [insight for insight in insights if insight.type == "leader_change"]

    assert leader_changes
    assert leader_changes[0].exchange == "B"


def test_small_changes_below_threshold_are_suppressed():
    df = pd.DataFrame(
        {
            "date": ["2026-01-01", "2026-01-01", "2026-01-08", "2026-01-08"],
            "exchange": ["A", "B", "A", "B"],
            "volume_share": [0.501, 0.499, 0.5015, 0.4985],
        }
    )

    insights = generate_structured_insights(
        df,
        config={
            "window": 2,
            "max_insights": 8,
            "min_share_change": 0.002,
            "gap_change_threshold": 0.002,
            "concentration_change_threshold": 0.002,
        },
    )
    types = {insight.type for insight in insights}

    assert "top_gainer" not in types
    assert "top_loser" not in types
