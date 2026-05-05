# Volume Share Insight Engine

取引所ごとの出来高シェア時系列データから、週次・月次レポート向けの日本語インサイト文を生成するルールベース実装です。LLM は使わず、まず構造化インサイトを作り、その後に日本語へレンダリングします。

## ディレクトリ構成

```text
insight_engine/
  __init__.py
  metrics.py
  insights.py
  renderers.py
  schemas.py
  cli.py
tests/
  test_metrics.py
  test_insights.py
  test_renderers.py
samples/
  volume_share.csv
README.md
pyproject.toml
```

## 入力データ

最低限、以下の列を持つ CSV または `pandas.DataFrame` を渡します。

```csv
date,exchange,volume_share
2026-04-01,Binance,0.312
2026-04-01,Bybit,0.184
2026-04-01,OKX,0.151
```

`volume_share` は `0.312 = 31.2%` のような小数表現です。日次・週次・月次のいずれでも動きます。欠損行や途中参加の取引所は、安全にスキップまたは履歴不足として扱います。

## 使い方

```python
import pandas as pd

from insight_engine import generate_report, generate_structured_insights

df = pd.read_csv("samples/volume_share.csv")

insights = generate_structured_insights(
    df,
    config={
        "periods": 1,
        "window": 8,
        "max_insights": 6,
        "min_share_change": 0.002,
        "zscore_threshold": 2.0,
    },
)

for insight in insights:
    print(insight.to_dict())

print(generate_report(df, config={"periods": 1, "window": 8}))
```

## CLI

```bash
python -m insight_engine.cli --input samples/volume_share.csv --periods 1 --window 8
```

オプション:

- `--input`: 入力 CSV
- `--periods`: 何期間前と比較するか
- `--window`: z-score の rolling window
- `--max-insights`: 最大インサイト件数
- `--min-share-change`: 出力対象にする最小シェア変化幅。デフォルトは `0.002`
- `--zscore-threshold`: 異常値として出す z-score の絶対値。デフォルトは `2.0`
- `--output-json`: 構造化インサイト JSON の保存先

## 出力例

```text
=== structured_insights_json ===
[
  {
    "type": "top_gainer",
    "exchange": "Kraken",
    "metric": "share_change",
    "value": 0.012,
    "unit": "pt",
    "direction": "up",
    "priority": 99,
    "message_ja": "今週の最大シェア増加は Kraken（前週比 +1.2pt）です。"
  }
]

=== report_ja ===
・今週の最大シェア増加は Kraken（前週比 +1.2pt）です。
・Binance は首位を維持していますが、2位との差は前回の 10.9pt から 9.8pt へ縮小しています。
```

## 実装メモ

- `metrics.py`: rank、share change、gap、Top3/Top5/HHI、z-score、streak を計算
- `insights.py`: 最新時点を基準に、最大増減、首位交代、順位変動、ギャップ変化、連続トレンド、異常値、市場構造を抽出
- `renderers.py`: 構造化インサイトを日本語レポートへ変換
- `schemas.py`: `Insight` と `InsightConfig` の dataclass

ノイズ抑制として、シェア変化が `0.2pt` 未満のものはデフォルトで抑制し、z-score は `abs(z) >= 2.0` のみ出力します。似た市場構造インサイトは優先度で 1 件に絞ります。

## テスト

```bash
PYTHONDONTWRITEBYTECODE=1 pytest -p no:cacheprovider
```

テストでは rank、share change、gap、Top3/Top5/HHI、z-score、streak、主要インサイト、閾値抑制、レポート非空を確認しています。
