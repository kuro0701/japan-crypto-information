"""CLI entrypoint for the volume-share insight engine."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from .insights import generate_structured_insights
from .metrics import load_data
from .renderers import render_insights_ja


def main() -> None:
    """Run the CLI."""

    parser = argparse.ArgumentParser(description="Generate volume-share insights.")
    parser.add_argument("--input", required=True, help="Input CSV path")
    parser.add_argument("--periods", type=int, default=1, help="Comparison periods")
    parser.add_argument("--window", type=int, default=8, help="Rolling z-score window")
    parser.add_argument("--max-insights", type=int, default=8, help="Maximum insights")
    parser.add_argument(
        "--min-share-change",
        type=float,
        default=0.002,
        help="Minimum absolute share change to report",
    )
    parser.add_argument(
        "--zscore-threshold",
        type=float,
        default=2.0,
        help="Absolute z-score threshold",
    )
    parser.add_argument("--output-json", help="Optional path to write insight JSON")
    args = parser.parse_args()

    config: dict[str, Any] = {
        "periods": args.periods,
        "window": args.window,
        "max_insights": args.max_insights,
        "min_share_change": args.min_share_change,
        "min_rank_change_share": args.min_share_change,
        "gap_change_threshold": args.min_share_change,
        "concentration_change_threshold": args.min_share_change,
        "zscore_threshold": args.zscore_threshold,
    }

    df = load_data(args.input)
    insights = generate_structured_insights(df, config=config)
    insight_dicts = [insight.to_dict() for insight in insights]
    json_text = json.dumps(insight_dicts, ensure_ascii=False, indent=2)
    report = render_insights_ja(insights)

    if args.output_json:
        Path(args.output_json).write_text(json_text + "\n", encoding="utf-8")

    print("=== structured_insights_json ===")
    print(json_text)
    print()
    print("=== report_ja ===")
    print(report)


if __name__ == "__main__":
    main()
