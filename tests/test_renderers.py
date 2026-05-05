import pandas as pd

from insight_engine.renderers import generate_report, render_insights_ja
from insight_engine.schemas import Insight


def test_render_insights_ja_is_not_empty():
    report = render_insights_ja(
        [
            Insight(
                type="top_gainer",
                exchange="Bybit",
                metric="share_change",
                value=0.008,
                unit="pt",
                direction="up",
                priority=90,
                message_ja="今週の最大シェア増加は Bybit（前週比 +0.8pt）です。",
            )
        ]
    )

    assert "Bybit" in report
    assert report.strip()


def test_generate_report_is_not_empty():
    df = pd.DataFrame(
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

    report = generate_report(df, config={"window": 2})

    assert report.strip()
    assert "・" in report
