const DEFAULT_CONFIG = {
  periods: 1,
  window: 8,
  maxInsights: 6,
  minShareChange: 0.002,
  zscoreThreshold: 2.0,
  minRankChangeShare: 0.002,
  gapChangeThreshold: 0.002,
  concentrationChangeThreshold: 0.002,
  hhiChangeThreshold: 0.0005,
  minStreak: 3,
  maxRankMovementInsights: 2,
  maxGapInsights: 2,
  periodLabel: null,
};

const ALL_VALUE = '__all__';

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePositiveInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeNonNegativeNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeConfig(config = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    periods: normalizePositiveInteger(config.periods, DEFAULT_CONFIG.periods, 1, 365),
    window: normalizePositiveInteger(config.window, DEFAULT_CONFIG.window, 2, 365),
    maxInsights: normalizePositiveInteger(config.maxInsights, DEFAULT_CONFIG.maxInsights, 1, 12),
    minShareChange: normalizeNonNegativeNumber(config.minShareChange, DEFAULT_CONFIG.minShareChange),
    zscoreThreshold: normalizeNonNegativeNumber(config.zscoreThreshold, DEFAULT_CONFIG.zscoreThreshold),
    minRankChangeShare: normalizeNonNegativeNumber(config.minRankChangeShare, config.minShareChange ?? DEFAULT_CONFIG.minRankChangeShare),
    gapChangeThreshold: normalizeNonNegativeNumber(config.gapChangeThreshold, config.minShareChange ?? DEFAULT_CONFIG.gapChangeThreshold),
    concentrationChangeThreshold: normalizeNonNegativeNumber(
      config.concentrationChangeThreshold,
      config.minShareChange ?? DEFAULT_CONFIG.concentrationChangeThreshold
    ),
    hhiChangeThreshold: normalizeNonNegativeNumber(config.hhiChangeThreshold, DEFAULT_CONFIG.hhiChangeThreshold),
    minStreak: normalizePositiveInteger(config.minStreak, DEFAULT_CONFIG.minStreak, 2, 365),
  };
}

function normalizeFilterValue(value, { uppercase = false, lowercase = false } = {}) {
  const text = String(value || '').trim();
  if (!text || text === ALL_VALUE) return null;
  if (uppercase) return text.toUpperCase();
  if (lowercase) return text.toLowerCase();
  return text;
}

function normalizeDate(value) {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const time = Date.parse(text);
  if (!Number.isFinite(time)) return null;
  return new Date(time).toISOString().slice(0, 10);
}

function buildExchangeShareFrame(historyRows = [], filters = {}) {
  const instrumentFilter = normalizeFilterValue(filters.instrumentId, { uppercase: true });
  const exchangeFilter = normalizeFilterValue(filters.exchangeId, { lowercase: true });
  const byDate = new Map();
  const byDateExchange = new Map();

  for (const row of historyRows || []) {
    const date = normalizeDate(row.date);
    if (!date) continue;

    const instrumentId = String(row.instrumentId || '').toUpperCase();
    const exchangeId = String(row.exchangeId || '').toLowerCase();
    if (!exchangeId) continue;
    if (instrumentFilter && instrumentId !== instrumentFilter) continue;
    if (exchangeFilter && exchangeId !== exchangeFilter) continue;

    const quoteVolume = parseNumber(row.quoteVolume);
    if (quoteVolume == null || quoteVolume < 0) continue;

    if (!byDate.has(date)) {
      byDate.set(date, { totalQuoteVolume: 0, exchangeCount: 0 });
    }
    byDate.get(date).totalQuoteVolume += quoteVolume;

    const key = `${date}:${exchangeId}`;
    const existing = byDateExchange.get(key) || {
      date,
      exchangeId,
      exchangeLabel: row.exchangeLabel || exchangeId,
      quoteVolume: 0,
    };
    existing.quoteVolume += quoteVolume;
    byDateExchange.set(key, existing);
  }

  const rows = [];
  for (const row of byDateExchange.values()) {
    const day = byDate.get(row.date);
    const totalQuoteVolume = day ? day.totalQuoteVolume : 0;
    if (!(totalQuoteVolume > 0)) continue;
    rows.push({
      ...row,
      volumeShare: row.quoteVolume / totalQuoteVolume,
    });
  }

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return b.volumeShare - a.volumeShare || String(a.exchangeLabel).localeCompare(String(b.exchangeLabel), 'ja');
  });

  const dates = Array.from(new Set(rows.map(row => row.date))).sort();
  for (const date of dates) {
    const count = rows.filter(row => row.date === date).length;
    byDate.get(date).exchangeCount = count;
  }

  return {
    rows,
    dates,
    filters: {
      instrumentId: instrumentFilter,
      exchangeId: exchangeFilter,
    },
  };
}

function groupRowsBy(rows, keyGetter) {
  const groups = new Map();
  for (const row of rows) {
    const key = keyGetter(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function addRanks(rows) {
  const byDate = groupRowsBy(rows, row => row.date);
  for (const group of byDate.values()) {
    group.sort((a, b) => b.volumeShare - a.volumeShare || String(a.exchangeLabel).localeCompare(String(b.exchangeLabel), 'ja'));
    let currentRank = 0;
    let previousShare = null;
    group.forEach((row, index) => {
      if (previousShare === null || row.volumeShare !== previousShare) {
        currentRank = index + 1;
      }
      row.rank = currentRank;
      previousShare = row.volumeShare;
    });
  }
}

function addGapMetrics(rows) {
  const byDate = groupRowsBy(rows, row => row.date);
  for (const group of byDate.values()) {
    group.sort((a, b) => a.rank - b.rank || String(a.exchangeLabel).localeCompare(String(b.exchangeLabel), 'ja'));
    const leaderShare = group.length > 0 ? group[0].volumeShare : null;
    group.forEach((row, index) => {
      const above = group[index - 1] || null;
      const below = group[index + 1] || null;
      row.leaderShare = leaderShare;
      row.gapToLeader = leaderShare == null ? null : leaderShare - row.volumeShare;
      row.gapToAbove = above ? above.volumeShare - row.volumeShare : null;
      row.gapToBelow = below ? row.volumeShare - below.volumeShare : null;
    });
  }
}

function addExchangeMetrics(rows, config) {
  const byExchange = groupRowsBy(rows, row => row.exchangeId);
  for (const group of byExchange.values()) {
    group.sort((a, b) => a.date.localeCompare(b.date));
    let increaseStreak = 0;
    let decreaseStreak = 0;

    group.forEach((row, index) => {
      const previous = group[index - config.periods] || null;
      row.shareChange = previous ? row.volumeShare - previous.volumeShare : null;
      row.rankPrev = previous ? previous.rank : null;
      row.rankChange = previous ? previous.rank - row.rank : null;
      row.gapToLeaderPrev = previous ? previous.gapToLeader : null;
      row.gapToLeaderChange = previous && isFiniteNumber(previous.gapToLeader) && isFiniteNumber(row.gapToLeader)
        ? row.gapToLeader - previous.gapToLeader
        : null;
      row.gapToAbovePrev = previous ? previous.gapToAbove : null;
      row.gapToAboveChange = previous && isFiniteNumber(previous.gapToAbove) && isFiniteNumber(row.gapToAbove)
        ? row.gapToAbove - previous.gapToAbove
        : null;

      const priorWindow = group.slice(Math.max(0, index - config.window), index);
      if (priorWindow.length === config.window) {
        const values = priorWindow.map(item => item.volumeShare);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
        const std = Math.sqrt(variance);
        row.rollingMean = mean;
        row.rollingStd = std;
        row.zscore = std > 0 ? (row.volumeShare - mean) / std : null;
      } else {
        row.rollingMean = null;
        row.rollingStd = null;
        row.zscore = null;
      }

      const directPrevious = group[index - 1] || null;
      const delta = directPrevious ? row.volumeShare - directPrevious.volumeShare : null;
      if (delta == null || delta === 0) {
        increaseStreak = 0;
        decreaseStreak = 0;
      } else if (delta > 0) {
        increaseStreak += 1;
        decreaseStreak = 0;
      } else {
        decreaseStreak += 1;
        increaseStreak = 0;
      }
      row.increaseStreak = increaseStreak;
      row.decreaseStreak = decreaseStreak;
    });
  }
}

function buildConcentration(rows, dates, config) {
  const byDate = groupRowsBy(rows, row => row.date);
  const concentration = dates.map((date) => {
    const shares = (byDate.get(date) || [])
      .map(row => row.volumeShare)
      .filter(isFiniteNumber)
      .sort((a, b) => b - a);
    return {
      date,
      top3Share: shares.slice(0, 3).reduce((sum, value) => sum + value, 0),
      top5Share: shares.slice(0, 5).reduce((sum, value) => sum + value, 0),
      hhi: shares.reduce((sum, value) => sum + (value ** 2), 0),
      exchangeCount: shares.length,
    };
  });

  concentration.forEach((row, index) => {
    const previous = concentration[index - config.periods] || null;
    row.top3ShareChange = previous ? row.top3Share - previous.top3Share : null;
    row.top5ShareChange = previous ? row.top5Share - previous.top5Share : null;
    row.hhiChange = previous ? row.hhi - previous.hhi : null;
  });

  return concentration;
}

function addAllMetrics(frame, config) {
  const rows = frame.rows.map(row => ({ ...row }));
  addRanks(rows);
  addGapMetrics(rows);
  addExchangeMetrics(rows, config);
  const concentration = buildConcentration(rows, frame.dates, config);
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank || String(a.exchangeLabel).localeCompare(String(b.exchangeLabel), 'ja'));
  return { rows, concentration };
}

function generateVolumeShareInsights(historyRows = [], options = {}) {
  const config = normalizeConfig(options.config || {});
  const frame = buildExchangeShareFrame(historyRows, options.filters || {});
  const { rows, concentration } = addAllMetrics(frame, config);
  const terms = periodTerms(frame.dates, config);

  if (rows.length === 0 || frame.dates.length === 0) {
    return {
      meta: buildMeta(frame, options, terms),
      insights: [],
      reportJa: renderVolumeShareInsightsJa([]),
    };
  }

  const latestDate = frame.dates[frame.dates.length - 1];
  const previousDate = frame.dates.length > config.periods
    ? frame.dates[frame.dates.length - 1 - config.periods]
    : null;
  const latest = rows.filter(row => row.date === latestDate);
  const previous = previousDate ? rows.filter(row => row.date === previousDate) : [];

  const candidates = [
    ...topMoverInsights(latest, config, terms),
    ...leaderInsights(latest, previous, config),
    ...rankMovementInsights(latest, config, terms),
    ...gapChangeInsights(latest, config),
    ...streakInsights(latest, config, terms),
    ...zscoreInsights(latest, config, terms),
    ...marketStructureInsights(concentration, latestDate, config, terms),
  ];
  const insights = deduplicateAndLimit(candidates, config.maxInsights);

  return {
    meta: {
      ...buildMeta(frame, options, terms),
      latestDate,
      previousDate,
      insightCount: insights.length,
    },
    insights,
    reportJa: renderVolumeShareInsightsJa(insights),
  };
}

function buildMeta(frame, options, terms) {
  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    earliestDate: frame.dates[0] || null,
    latestDate: frame.dates[frame.dates.length - 1] || null,
    dateCount: frame.dates.length,
    rowCount: frame.rows.length,
    filters: frame.filters,
    period: terms,
  };
}

function topMoverInsights(latest, config, terms) {
  const rows = latest.filter(row => isFiniteNumber(row.shareChange));
  if (rows.length === 0) return [];

  const gainer = rows.reduce((best, row) => (row.shareChange > best.shareChange ? row : best), rows[0]);
  const loser = rows.reduce((best, row) => (row.shareChange < best.shareChange ? row : best), rows[0]);
  const insights = [];

  if (gainer.shareChange >= config.minShareChange) {
    insights.push(createInsight({
      type: 'top_gainer',
      exchange: gainer.exchangeLabel,
      exchangeId: gainer.exchangeId,
      metric: 'share_change',
      value: gainer.shareChange,
      unit: 'pt',
      direction: 'up',
      priority: 90 + Math.min(Math.floor(Math.abs(gainer.shareChange) * 1000), 9),
      messageJa: `${terms.currentLabel}の最大シェア増加は ${gainer.exchangeLabel}（${terms.comparisonLabel} ${fmtPt(gainer.shareChange)}）です。`,
      metadata: { dedupeKey: 'top_gainer' },
    }));
  }

  if (loser.shareChange <= -config.minShareChange) {
    insights.push(createInsight({
      type: 'top_loser',
      exchange: loser.exchangeLabel,
      exchangeId: loser.exchangeId,
      metric: 'share_change',
      value: loser.shareChange,
      unit: 'pt',
      direction: 'down',
      priority: 88 + Math.min(Math.floor(Math.abs(loser.shareChange) * 1000), 9),
      messageJa: `${terms.currentLabel}の最大シェア低下は ${loser.exchangeLabel}（${terms.comparisonLabel} ${fmtPt(loser.shareChange)}）です。`,
      metadata: { dedupeKey: 'top_loser' },
    }));
  }

  return insights;
}

function leaderInsights(latest, previous, config) {
  if (latest.length === 0) return [];
  const latestLeader = sortedByRank(latest)[0];
  const latestSecondGap = leaderSecondGap(latest);

  if (previous.length === 0) {
    return [createInsight({
      type: 'leader_hold',
      exchange: latestLeader.exchangeLabel,
      exchangeId: latestLeader.exchangeId,
      metric: 'rank',
      value: 1,
      unit: 'rank',
      direction: 'flat',
      priority: 45,
      messageJa: `${latestLeader.exchangeLabel} が首位です（シェア ${fmtShare(latestLeader.volumeShare)}）。`,
      metadata: { dedupeKey: 'leader_summary' },
    })];
  }

  const previousLeader = sortedByRank(previous)[0];
  if (latestLeader.exchangeId !== previousLeader.exchangeId) {
    return [createInsight({
      type: 'leader_change',
      exchange: latestLeader.exchangeLabel,
      exchangeId: latestLeader.exchangeId,
      metric: 'rank',
      value: 1,
      unit: 'rank',
      direction: 'up',
      priority: 100,
      messageJa: `首位は ${previousLeader.exchangeLabel} から ${latestLeader.exchangeLabel} に交代しました（${latestLeader.exchangeLabel} ${fmtShare(latestLeader.volumeShare)}）。`,
      metadata: {
        previousExchange: previousLeader.exchangeLabel,
        previousExchangeId: previousLeader.exchangeId,
        dedupeKey: 'leader_summary',
      },
    })];
  }

  const previousSecondGap = leaderSecondGap(previous);
  const gapChange = isFiniteNumber(latestSecondGap) && isFiniteNumber(previousSecondGap)
    ? latestSecondGap - previousSecondGap
    : null;

  if (isFiniteNumber(gapChange) && Math.abs(gapChange) >= config.gapChangeThreshold) {
    const direction = gapChange < 0 ? 'narrow' : 'widen';
    const directionJa = direction === 'narrow' ? '縮小' : '拡大';
    return [createInsight({
      type: 'leader_gap_change',
      exchange: latestLeader.exchangeLabel,
      exchangeId: latestLeader.exchangeId,
      metric: 'leader_second_gap',
      value: gapChange,
      unit: 'pt',
      direction,
      priority: 78 + Math.min(Math.floor(Math.abs(gapChange) * 1000), 7),
      messageJa: `${latestLeader.exchangeLabel} は首位を維持していますが、2位との差は前回の ${fmtPt(previousSecondGap, false)} から ${fmtPt(latestSecondGap, false)} へ${directionJa}しています。`,
      metadata: {
        previousGap: previousSecondGap,
        latestGap: latestSecondGap,
        dedupeKey: 'leader_summary',
      },
    })];
  }

  return [createInsight({
    type: 'leader_hold',
    exchange: latestLeader.exchangeLabel,
    exchangeId: latestLeader.exchangeId,
    metric: 'rank',
    value: 1,
    unit: 'rank',
    direction: 'flat',
    priority: 45,
    messageJa: `${latestLeader.exchangeLabel} は首位を維持しています（シェア ${fmtShare(latestLeader.volumeShare)}）。`,
    metadata: { dedupeKey: 'leader_summary' },
  })];
}

function rankMovementInsights(latest, config, terms) {
  const material = latest
    .filter(row => isFiniteNumber(row.rankChange) && row.rankChange !== 0 && isFiniteNumber(row.shareChange))
    .filter(row => Math.abs(row.shareChange) >= config.minRankChangeShare || Math.abs(row.rankChange) >= 2)
    .map(row => ({
      ...row,
      movementScore: Math.abs(row.rankChange) * 10 + Math.abs(row.shareChange) * 1000,
    }))
    .sort((a, b) => b.movementScore - a.movementScore);

  return material.slice(0, config.maxRankMovementInsights).map((row) => {
    const direction = row.rankChange > 0 ? 'up' : 'down';
    const directionJa = direction === 'up' ? '上昇' : '低下';
    return createInsight({
      type: `rank_${direction}`,
      exchange: row.exchangeLabel,
      exchangeId: row.exchangeId,
      metric: 'rank_change',
      value: row.rankChange,
      unit: 'rank',
      direction,
      priority: (direction === 'up' ? 74 : 72) + Math.min(Math.abs(row.rankChange), 5),
      messageJa: `${row.exchangeLabel} は${row.rankPrev}位から${row.rank}位へ${directionJa}しました（${terms.comparisonLabel} ${fmtPt(row.shareChange)}）。`,
      metadata: { dedupeKey: `rank:${row.exchangeId}` },
    });
  });
}

function gapChangeInsights(latest, config) {
  const insights = [];
  const leaderGapRows = latest
    .filter(row => row.rank !== 1)
    .filter(row => isFiniteNumber(row.gapToLeaderChange) && isFiniteNumber(row.gapToLeaderPrev))
    .filter(row => Math.abs(row.gapToLeaderChange) >= config.gapChangeThreshold)
    .sort((a, b) => Math.abs(b.gapToLeaderChange) - Math.abs(a.gapToLeaderChange));

  if (leaderGapRows.length > 0) {
    const row = leaderGapRows[0];
    const direction = row.gapToLeaderChange < 0 ? 'narrow' : 'widen';
    const directionJa = direction === 'narrow' ? '縮小' : '拡大';
    insights.push(createInsight({
      type: direction === 'narrow' ? 'leader_gap_narrow' : 'leader_gap_widen',
      exchange: row.exchangeLabel,
      exchangeId: row.exchangeId,
      metric: 'gap_to_leader',
      value: row.gapToLeaderChange,
      unit: 'pt',
      direction,
      priority: 66 + Math.min(Math.floor(Math.abs(row.gapToLeaderChange) * 1000), 6),
      messageJa: `${row.exchangeLabel} は首位との差が前回の ${fmtPt(row.gapToLeaderPrev, false)} から ${fmtPt(row.gapToLeader, false)} へ${directionJa}しています。`,
      metadata: { dedupeKey: `leader_gap:${row.exchangeId}` },
    }));
  }

  const aboveGapRows = latest
    .filter(row => row.rank > 2)
    .filter(row => isFiniteNumber(row.gapToAboveChange) && isFiniteNumber(row.gapToAbovePrev))
    .filter(row => Math.abs(row.gapToAboveChange) >= config.gapChangeThreshold)
    .sort((a, b) => Math.abs(b.gapToAboveChange) - Math.abs(a.gapToAboveChange));

  if (aboveGapRows.length > 0) {
    const row = aboveGapRows[0];
    const direction = row.gapToAboveChange < 0 ? 'narrow' : 'widen';
    const directionJa = direction === 'narrow' ? '縮小' : '拡大';
    insights.push(createInsight({
      type: direction === 'narrow' ? 'above_gap_narrow' : 'above_gap_widen',
      exchange: row.exchangeLabel,
      exchangeId: row.exchangeId,
      metric: 'gap_to_above',
      value: row.gapToAboveChange,
      unit: 'pt',
      direction,
      priority: 62 + Math.min(Math.floor(Math.abs(row.gapToAboveChange) * 1000), 6),
      messageJa: `${row.exchangeLabel} は直上順位との差が前回の ${fmtPt(row.gapToAbovePrev, false)} から ${fmtPt(row.gapToAbove, false)} へ${directionJa}しています。`,
      metadata: { dedupeKey: `above_gap:${row.exchangeId}` },
    }));
  }

  return insights.slice(0, config.maxGapInsights);
}

function streakInsights(latest, config, terms) {
  const insights = [];
  for (const row of latest) {
    const unchangedRank = isFiniteNumber(row.rankChange) && row.rankChange === 0;
    const prefix = unchangedRank ? '順位変動はないものの、' : '';
    if (row.increaseStreak >= config.minStreak) {
      insights.push(createInsight({
        type: 'increase_streak',
        exchange: row.exchangeLabel,
        exchangeId: row.exchangeId,
        metric: 'increase_streak',
        value: row.increaseStreak,
        unit: terms.streakUnit,
        direction: 'up',
        priority: 58 + Math.min(row.increaseStreak, 8),
        messageJa: `${row.exchangeLabel} は${prefix}シェアが${row.increaseStreak}${terms.streakUnit}連続で上昇しています。`,
        metadata: { dedupeKey: `streak:${row.exchangeId}` },
      }));
    }
    if (row.decreaseStreak >= config.minStreak) {
      insights.push(createInsight({
        type: 'decrease_streak',
        exchange: row.exchangeLabel,
        exchangeId: row.exchangeId,
        metric: 'decrease_streak',
        value: row.decreaseStreak,
        unit: terms.streakUnit,
        direction: 'down',
        priority: 58 + Math.min(row.decreaseStreak, 8),
        messageJa: `${row.exchangeLabel} は${prefix}シェアが${row.decreaseStreak}${terms.streakUnit}連続で低下しています。`,
        metadata: { dedupeKey: `streak:${row.exchangeId}` },
      }));
    }
  }
  return insights.sort((a, b) => b.priority - a.priority).slice(0, 2);
}

function zscoreInsights(latest, config, terms) {
  return latest
    .filter(row => isFiniteNumber(row.zscore) && Math.abs(row.zscore) >= config.zscoreThreshold)
    .sort((a, b) => Math.abs(b.zscore) - Math.abs(a.zscore))
    .slice(0, 2)
    .map((row) => {
      const direction = row.zscore > 0 ? 'up' : 'down';
      const directionJa = direction === 'up' ? '上振れ' : '下振れ';
      return createInsight({
        type: 'zscore_outlier',
        exchange: row.exchangeLabel,
        exchangeId: row.exchangeId,
        metric: 'zscore',
        value: row.zscore,
        unit: 'sigma',
        direction,
        priority: 54 + Math.min(Math.floor(Math.abs(row.zscore)), 6),
        messageJa: `${row.exchangeLabel} は過去${config.window}${terms.streakUnit}平均対比で ${fmtSigma(row.zscore)} の${directionJa}です。`,
        metadata: { dedupeKey: `zscore:${row.exchangeId}` },
      });
    });
}

function marketStructureInsights(concentration, latestDate, config, terms) {
  const latest = concentration.find(row => row.date === latestDate);
  if (!latest) return [];

  const candidates = [];
  [
    ['top3Share', 'top3ShareChange', 'Top3集中度'],
    ['top5Share', 'top5ShareChange', 'Top5集中度'],
  ].forEach(([metric, changeMetric, label]) => {
    const change = latest[changeMetric];
    if (!isFiniteNumber(change) || Math.abs(change) < config.concentrationChangeThreshold) return;
    const direction = change > 0 ? 'concentrating' : 'dispersing';
    const directionJa = direction === 'concentrating' ? '集中方向' : '分散方向';
    candidates.push(createInsight({
      type: 'market_concentration',
      metric,
      value: change,
      unit: 'pt',
      direction,
      priority: 46 + Math.min(Math.floor(Math.abs(change) * 1000), 5),
      messageJa: `${label}は${terms.comparisonLabel} ${fmtPt(change)} で、市場はやや${directionJa}です。`,
      metadata: { dedupeKey: 'market_structure' },
    }));
  });

  if (isFiniteNumber(latest.hhiChange) && Math.abs(latest.hhiChange) >= config.hhiChangeThreshold) {
    const direction = latest.hhiChange > 0 ? 'concentrating' : 'dispersing';
    const directionJa = direction === 'concentrating' ? '集中方向' : '分散方向';
    candidates.push(createInsight({
      type: 'hhi_change',
      metric: 'hhi',
      value: latest.hhiChange,
      unit: 'index',
      direction,
      priority: 44 + Math.min(Math.floor(Math.abs(latest.hhiChange) * 10000), 5),
      messageJa: `HHIは${terms.comparisonLabel} ${fmtDecimal(latest.hhiChange)} となり、市場構造はやや${directionJa}に動いています。`,
      metadata: { dedupeKey: 'market_structure' },
    }));
  }

  return candidates.sort((a, b) => b.priority - a.priority).slice(0, 1);
}

function createInsight({
  type,
  exchange = null,
  exchangeId = null,
  metric,
  value = null,
  unit = null,
  direction = null,
  priority = 0,
  messageJa = '',
  metadata = {},
}) {
  return {
    type,
    exchange,
    exchangeId,
    metric,
    value,
    unit,
    direction,
    priority,
    messageJa,
    message_ja: messageJa,
    metadata,
  };
}

function renderVolumeShareInsightsJa(insights = []) {
  if (!insights || insights.length === 0) {
    return '・有意な変化は検出されませんでした。';
  }
  return insights
    .slice()
    .sort((a, b) => b.priority - a.priority)
    .map(insight => `・${insight.messageJa || insight.message_ja || ''}`)
    .join('\n');
}

function deduplicateAndLimit(candidates, maxInsights) {
  const selected = [];
  const seen = new Set();
  for (const insight of candidates.slice().sort((a, b) => b.priority - a.priority)) {
    const key = insight.metadata && insight.metadata.dedupeKey
      ? insight.metadata.dedupeKey
      : `${insight.type}:${insight.exchangeId || insight.exchange || '-'}:${insight.metric}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(insight);
    if (selected.length >= maxInsights) break;
  }
  return selected;
}

function sortedByRank(rows) {
  return rows.slice().sort((a, b) => a.rank - b.rank || String(a.exchangeLabel).localeCompare(String(b.exchangeLabel), 'ja'));
}

function leaderSecondGap(rows) {
  const sorted = sortedByRank(rows);
  if (sorted.length < 2) return null;
  return sorted[0].volumeShare - sorted[1].volumeShare;
}

function periodTerms(dates, config) {
  const label = String(config.periodLabel || '').toLowerCase();
  if (['day', 'daily', '日', '日次'].includes(label)) {
    return { currentLabel: '直近日', comparisonLabel: '前日比', streakUnit: '日' };
  }
  if (['week', 'weekly', '週', '週次'].includes(label)) {
    return { currentLabel: '今週', comparisonLabel: '前週比', streakUnit: '週' };
  }
  if (['month', 'monthly', '月', '月次'].includes(label)) {
    return { currentLabel: '今月', comparisonLabel: '前月比', streakUnit: 'カ月' };
  }

  const deltas = [];
  for (let index = 1; index < dates.length; index += 1) {
    const previous = Date.parse(`${dates[index - 1]}T00:00:00.000Z`);
    const current = Date.parse(`${dates[index]}T00:00:00.000Z`);
    if (Number.isFinite(previous) && Number.isFinite(current)) {
      deltas.push((current - previous) / (24 * 60 * 60 * 1000));
    }
  }
  const median = medianNumber(deltas);
  if (median != null && median <= 2) {
    return { currentLabel: '直近日', comparisonLabel: '前日比', streakUnit: '日' };
  }
  if (median != null && median >= 5 && median <= 9) {
    return { currentLabel: '今週', comparisonLabel: '前週比', streakUnit: '週' };
  }
  if (median != null && median >= 25 && median <= 35) {
    return { currentLabel: '今月', comparisonLabel: '前月比', streakUnit: 'カ月' };
  }
  return { currentLabel: '最新期間', comparisonLabel: '前回比', streakUnit: '期間' };
}

function medianNumber(values) {
  const finite = values.filter(isFiniteNumber).sort((a, b) => a - b);
  if (finite.length === 0) return null;
  const mid = Math.floor(finite.length / 2);
  if (finite.length % 2 === 1) return finite[mid];
  return (finite[mid - 1] + finite[mid]) / 2;
}

function fmtShare(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function fmtPt(value, signed = true) {
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(1)}pt`;
}

function fmtSigma(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}σ`;
}

function fmtDecimal(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(4)}`;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

module.exports = {
  buildExchangeShareFrame,
  generateVolumeShareInsights,
  renderVolumeShareInsightsJa,
};
