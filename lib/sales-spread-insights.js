const DEFAULT_CONFIG = {
  periods: 1,
  window: 8,
  maxInsights: 6,
  minSpreadChange: 0.1,
  zscoreThreshold: 2.0,
  minRankChangeSpread: 0.1,
  gapChangeThreshold: 0.1,
  minStreak: 3,
  maxMovementInsights: 4,
  maxRankMovementInsights: 2,
  maxGapInsights: 2,
  includeRankInsights: false,
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
    minSpreadChange: normalizeNonNegativeNumber(config.minSpreadChange, DEFAULT_CONFIG.minSpreadChange),
    zscoreThreshold: normalizeNonNegativeNumber(config.zscoreThreshold, DEFAULT_CONFIG.zscoreThreshold),
    minRankChangeSpread: normalizeNonNegativeNumber(
      config.minRankChangeSpread,
      config.minSpreadChange ?? DEFAULT_CONFIG.minRankChangeSpread
    ),
    gapChangeThreshold: normalizeNonNegativeNumber(
      config.gapChangeThreshold,
      config.minSpreadChange ?? DEFAULT_CONFIG.gapChangeThreshold
    ),
    minStreak: normalizePositiveInteger(config.minStreak, DEFAULT_CONFIG.minStreak, 2, 365),
    maxMovementInsights: normalizePositiveInteger(
      config.maxMovementInsights,
      DEFAULT_CONFIG.maxMovementInsights,
      1,
      12
    ),
    maxRankMovementInsights: normalizePositiveInteger(
      config.maxRankMovementInsights,
      DEFAULT_CONFIG.maxRankMovementInsights,
      1,
      12
    ),
    maxGapInsights: normalizePositiveInteger(config.maxGapInsights, DEFAULT_CONFIG.maxGapInsights, 1, 12),
    includeRankInsights: config.includeRankInsights === true,
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

function buildSalesSpreadFrame(historyRows = [], filters = {}) {
  const instrumentFilter = normalizeFilterValue(filters.instrumentId, { uppercase: true });
  const exchangeFilter = normalizeFilterValue(filters.exchangeId, { lowercase: true });
  const entityType = instrumentFilter ? 'exchange' : 'instrument';
  const byDateEntity = new Map();
  const dates = new Set();

  for (const row of historyRows || []) {
    const date = normalizeDate(row.date);
    if (!date) continue;

    const instrumentId = String(row.instrumentId || '').toUpperCase();
    const exchangeId = String(row.exchangeId || '').toLowerCase();
    if (!instrumentId || !exchangeId) continue;
    if (instrumentFilter && instrumentId !== instrumentFilter) continue;
    if (exchangeFilter && exchangeId !== exchangeFilter) continue;

    const spreadPct = parseNumber(row.spreadPct);
    if (spreadPct == null || spreadPct < 0) continue;

    const spread = parseNumber(row.spread);
    const entityId = entityType === 'exchange' ? exchangeId : instrumentId;
    const entityLabel = entityType === 'exchange'
      ? (row.exchangeLabel || exchangeId)
      : (row.instrumentLabel || instrumentId);
    const key = `${date}:${entityType}:${entityId}`;
    const existing = byDateEntity.get(key) || {
      date,
      entityType,
      entityId,
      entityLabel,
      exchangeId: entityType === 'exchange' ? exchangeId : exchangeFilter,
      exchangeLabel: entityType === 'exchange' ? (row.exchangeLabel || exchangeId) : null,
      instrumentId: entityType === 'instrument' ? instrumentId : instrumentFilter,
      instrumentLabel: entityType === 'instrument' ? (row.instrumentLabel || instrumentId) : null,
      spread: 0,
      spreadPct: 0,
      sampleCount: 0,
      venueIds: new Set(),
    };

    if (spread != null) existing.spread += spread;
    existing.spreadPct += spreadPct;
    existing.sampleCount += 1;
    existing.venueIds.add(exchangeId);
    byDateEntity.set(key, existing);
    dates.add(date);
  }

  const rows = Array.from(byDateEntity.values()).map(row => ({
    ...row,
    spread: row.sampleCount > 0 ? row.spread / row.sampleCount : null,
    spreadPct: row.sampleCount > 0 ? row.spreadPct / row.sampleCount : null,
    venueCount: row.venueIds.size,
    venueIds: undefined,
  })).filter(row => isFiniteNumber(row.spreadPct));

  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.spreadPct - b.spreadPct || String(a.entityLabel).localeCompare(String(b.entityLabel), 'ja');
  });

  return {
    rows,
    dates: Array.from(dates).sort(),
    filters: {
      instrumentId: instrumentFilter,
      exchangeId: exchangeFilter,
      entityType,
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
    group.sort((a, b) => a.spreadPct - b.spreadPct || String(a.entityLabel).localeCompare(String(b.entityLabel), 'ja'));
    let currentRank = 0;
    let previousSpread = null;
    group.forEach((row, index) => {
      if (previousSpread === null || row.spreadPct !== previousSpread) {
        currentRank = index + 1;
      }
      row.rank = currentRank;
      previousSpread = row.spreadPct;
    });
  }
}

function addGapMetrics(rows) {
  const byDate = groupRowsBy(rows, row => row.date);
  for (const group of byDate.values()) {
    group.sort((a, b) => a.rank - b.rank || String(a.entityLabel).localeCompare(String(b.entityLabel), 'ja'));
    const narrowestSpreadPct = group.length > 0 ? group[0].spreadPct : null;
    group.forEach((row, index) => {
      const above = group[index - 1] || null;
      const below = group[index + 1] || null;
      row.narrowestSpreadPct = narrowestSpreadPct;
      row.gapToNarrowest = narrowestSpreadPct == null ? null : row.spreadPct - narrowestSpreadPct;
      row.gapToAbove = above ? row.spreadPct - above.spreadPct : null;
      row.gapToBelow = below ? below.spreadPct - row.spreadPct : null;
    });
  }
}

function addEntityMetrics(rows, config) {
  const byEntity = groupRowsBy(rows, row => `${row.entityType}:${row.entityId}`);
  for (const group of byEntity.values()) {
    group.sort((a, b) => a.date.localeCompare(b.date));
    let narrowingStreak = 0;
    let wideningStreak = 0;

    group.forEach((row, index) => {
      const previous = group[index - config.periods] || null;
      row.spreadChange = previous ? row.spreadPct - previous.spreadPct : null;
      row.rankPrev = previous ? previous.rank : null;
      row.rankChange = previous ? previous.rank - row.rank : null;
      row.gapToNarrowestPrev = previous ? previous.gapToNarrowest : null;
      row.gapToNarrowestChange = previous
        && isFiniteNumber(previous.gapToNarrowest)
        && isFiniteNumber(row.gapToNarrowest)
        ? row.gapToNarrowest - previous.gapToNarrowest
        : null;
      row.gapToAbovePrev = previous ? previous.gapToAbove : null;
      row.gapToAboveChange = previous
        && isFiniteNumber(previous.gapToAbove)
        && isFiniteNumber(row.gapToAbove)
        ? row.gapToAbove - previous.gapToAbove
        : null;

      const priorWindow = group.slice(Math.max(0, index - config.window), index);
      if (priorWindow.length === config.window) {
        const values = priorWindow.map(item => item.spreadPct);
        const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
        const std = Math.sqrt(variance);
        row.rollingMean = mean;
        row.rollingStd = std;
        row.zscore = std > 0 ? (row.spreadPct - mean) / std : null;
      } else {
        row.rollingMean = null;
        row.rollingStd = null;
        row.zscore = null;
      }

      const directPrevious = group[index - 1] || null;
      const delta = directPrevious ? row.spreadPct - directPrevious.spreadPct : null;
      if (delta == null || delta === 0) {
        narrowingStreak = 0;
        wideningStreak = 0;
      } else if (delta < 0) {
        narrowingStreak += 1;
        wideningStreak = 0;
      } else {
        wideningStreak += 1;
        narrowingStreak = 0;
      }
      row.narrowingStreak = narrowingStreak;
      row.wideningStreak = wideningStreak;
    });
  }
}

function addAllMetrics(frame, config) {
  const rows = frame.rows.map(row => ({ ...row }));
  addRanks(rows);
  addGapMetrics(rows);
  addEntityMetrics(rows, config);
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.rank - b.rank || String(a.entityLabel).localeCompare(String(b.entityLabel), 'ja'));
  return { rows };
}

function generateSalesSpreadInsights(historyRows = [], options = {}) {
  const config = normalizeConfig(options.config || {});
  const frame = buildSalesSpreadFrame(historyRows, options.filters || {});
  const { rows } = addAllMetrics(frame, config);
  const terms = periodTerms(config);

  if (rows.length === 0 || frame.dates.length === 0) {
    return {
      meta: buildMeta(frame, options, terms),
      insights: [],
      reportJa: renderSalesSpreadInsightsJa([]),
    };
  }

  const latestDate = frame.dates[frame.dates.length - 1];
  const previousDate = frame.dates.length > config.periods
    ? frame.dates[frame.dates.length - 1 - config.periods]
    : null;
  const latest = rows.filter(row => row.date === latestDate);
  const previous = previousDate ? rows.filter(row => row.date === previousDate) : [];

  const candidates = [
    ...spreadMovementInsights(latest, config, terms),
    ...(config.includeRankInsights ? narrowestInsights(latest, previous, config) : []),
    ...(config.includeRankInsights ? rankMovementInsights(latest, config, terms) : []),
    ...(config.includeRankInsights ? gapChangeInsights(latest, config) : []),
    ...streakInsights(latest, config, terms),
    ...zscoreInsights(latest, config, terms),
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
    reportJa: renderSalesSpreadInsightsJa(insights),
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

function spreadMovementInsights(latest, config, terms) {
  const rows = latest.filter(row => (
    isFiniteNumber(row.spreadChange)
    && isFiniteNumber(row.spreadPct)
    && Math.abs(row.spreadChange) >= config.minSpreadChange
  ));
  if (rows.length === 0) return [];

  const insights = [];
  const seenEntityIds = new Set();
  const narrower = rows.reduce((best, row) => (row.spreadChange < best.spreadChange ? row : best), rows[0]);
  const wider = rows.reduce((best, row) => (row.spreadChange > best.spreadChange ? row : best), rows[0]);

  if (narrower.spreadChange < 0) {
    insights.push(createSpreadMovementInsight({
      row: narrower,
      type: 'top_narrowing',
      direction: 'narrow',
      priorityBase: 90,
      terms,
      messageJa: `${terms.currentLabel}の最大スプレッド改善は ${subjectLabel(narrower)}（${terms.comparisonLabel} ${fmtPt(narrower.spreadChange)}、${fmtPct(previousSpread(narrower))} → ${fmtPct(narrower.spreadPct)}）です。`,
      dedupeKey: `spread_change:${narrower.entityType}:${narrower.entityId}`,
    }));
    seenEntityIds.add(narrower.entityId);
  }

  if (wider.spreadChange > 0 && !seenEntityIds.has(wider.entityId)) {
    insights.push(createSpreadMovementInsight({
      row: wider,
      type: 'top_widening',
      direction: 'widen',
      priorityBase: 88,
      terms,
      messageJa: `${terms.currentLabel}の最大スプレッド拡大は ${subjectLabel(wider)}（${terms.comparisonLabel} ${fmtPt(wider.spreadChange)}、${fmtPct(previousSpread(wider))} → ${fmtPct(wider.spreadPct)}）です。`,
      dedupeKey: `spread_change:${wider.entityType}:${wider.entityId}`,
    }));
    seenEntityIds.add(wider.entityId);
  }

  rows
    .slice()
    .sort((a, b) => Math.abs(b.spreadChange) - Math.abs(a.spreadChange))
    .forEach((row) => {
      if (insights.length >= config.maxMovementInsights) return;
      if (seenEntityIds.has(row.entityId)) return;
      const direction = row.spreadChange < 0 ? 'narrow' : 'widen';
      const directionJa = direction === 'narrow' ? '改善' : '拡大';
      insights.push(createSpreadMovementInsight({
        row,
        type: direction === 'narrow' ? 'spread_narrowing' : 'spread_widening',
        direction,
        priorityBase: direction === 'narrow' ? 82 : 80,
        terms,
        messageJa: `${subjectLabel(row)} のスプレッドは${terms.comparisonLabel} ${fmtPt(row.spreadChange)}（${fmtPct(previousSpread(row))} → ${fmtPct(row.spreadPct)}）で${directionJa}しています。`,
        dedupeKey: `spread_change:${row.entityType}:${row.entityId}`,
      }));
      seenEntityIds.add(row.entityId);
    });

  return insights;
}

function createSpreadMovementInsight({
  row,
  type,
  direction,
  priorityBase,
  terms,
  messageJa,
  dedupeKey,
}) {
  return createInsight({
    type,
    row,
    metric: 'spread_change',
    value: row.spreadChange,
    unit: 'pt',
    direction,
    priority: priorityBase + Math.min(Math.floor(Math.abs(row.spreadChange) * 10), 9),
    messageJa,
    metadata: {
      previousSpreadPct: previousSpread(row),
      latestSpreadPct: row.spreadPct,
      comparisonLabel: terms.comparisonLabel,
      dedupeKey,
    },
  });
}

function narrowestInsights(latest, previous, config) {
  if (latest.length === 0) return [];
  const latestLeader = sortedByRank(latest)[0];
  const latestSecondGap = narrowestSecondGap(latest);

  if (previous.length === 0) {
    return [createInsight({
      type: 'narrowest_hold',
      row: latestLeader,
      metric: 'rank',
      value: 1,
      unit: 'rank',
      direction: 'flat',
      priority: 45,
      messageJa: `${subjectLabel(latestLeader)} が最狭です（スプレッド ${fmtPct(latestLeader.spreadPct)}）。`,
      metadata: { dedupeKey: 'narrowest_summary' },
    })];
  }

  const previousLeader = sortedByRank(previous)[0];
  if (latestLeader.entityId !== previousLeader.entityId) {
    return [createInsight({
      type: 'narrowest_change',
      row: latestLeader,
      metric: 'rank',
      value: 1,
      unit: 'rank',
      direction: 'up',
      priority: 100,
      messageJa: `最狭は ${subjectLabel(previousLeader)} から ${subjectLabel(latestLeader)} に変わりました（${fmtPct(latestLeader.spreadPct)}）。`,
      metadata: {
        previousEntity: subjectLabel(previousLeader),
        previousEntityId: previousLeader.entityId,
        dedupeKey: 'narrowest_summary',
      },
    })];
  }

  const previousSecondGap = narrowestSecondGap(previous);
  const gapChange = isFiniteNumber(latestSecondGap) && isFiniteNumber(previousSecondGap)
    ? latestSecondGap - previousSecondGap
    : null;

  if (isFiniteNumber(gapChange) && Math.abs(gapChange) >= config.gapChangeThreshold) {
    const direction = gapChange < 0 ? 'narrow' : 'widen';
    const directionJa = direction === 'narrow' ? '縮小' : '拡大';
    return [createInsight({
      type: 'narrowest_gap_change',
      row: latestLeader,
      metric: 'narrowest_second_gap',
      value: gapChange,
      unit: 'pt',
      direction,
      priority: 78 + Math.min(Math.floor(Math.abs(gapChange) * 10), 7),
      messageJa: `${subjectLabel(latestLeader)} は最狭を維持していますが、2番手との差は前回の ${fmtPt(previousSecondGap, false)} から ${fmtPt(latestSecondGap, false)} へ${directionJa}しています。`,
      metadata: {
        previousGap: previousSecondGap,
        latestGap: latestSecondGap,
        dedupeKey: 'narrowest_summary',
      },
    })];
  }

  return [createInsight({
    type: 'narrowest_hold',
    row: latestLeader,
    metric: 'rank',
    value: 1,
    unit: 'rank',
    direction: 'flat',
    priority: 45,
    messageJa: `${subjectLabel(latestLeader)} は最狭を維持しています（スプレッド ${fmtPct(latestLeader.spreadPct)}）。`,
    metadata: { dedupeKey: 'narrowest_summary' },
  })];
}

function rankMovementInsights(latest, config, terms) {
  const material = latest
    .filter(row => isFiniteNumber(row.rankChange) && row.rankChange !== 0 && isFiniteNumber(row.spreadChange))
    .filter(row => Math.abs(row.spreadChange) >= config.minRankChangeSpread || Math.abs(row.rankChange) >= 2)
    .map(row => ({
      ...row,
      movementScore: Math.abs(row.rankChange) * 10 + Math.abs(row.spreadChange) * 10,
    }))
    .sort((a, b) => b.movementScore - a.movementScore);

  return material.slice(0, config.maxRankMovementInsights).map((row) => {
    const direction = row.rankChange > 0 ? 'up' : 'down';
    const directionJa = direction === 'up' ? '改善' : '悪化';
    return createInsight({
      type: `rank_${direction}`,
      row,
      metric: 'rank_change',
      value: row.rankChange,
      unit: 'rank',
      direction,
      priority: (direction === 'up' ? 74 : 72) + Math.min(Math.abs(row.rankChange), 5),
      messageJa: `${subjectLabel(row)} は${row.rankPrev}位から${row.rank}位へ${directionJa}しました（${terms.comparisonLabel} ${fmtPt(row.spreadChange)}）。`,
      metadata: { dedupeKey: `rank:${row.entityType}:${row.entityId}` },
    });
  });
}

function gapChangeInsights(latest, config) {
  const insights = [];
  const leaderGapRows = latest
    .filter(row => row.rank !== 1)
    .filter(row => isFiniteNumber(row.gapToNarrowestChange) && isFiniteNumber(row.gapToNarrowestPrev))
    .filter(row => Math.abs(row.gapToNarrowestChange) >= config.gapChangeThreshold)
    .sort((a, b) => Math.abs(b.gapToNarrowestChange) - Math.abs(a.gapToNarrowestChange));

  if (leaderGapRows.length > 0) {
    const row = leaderGapRows[0];
    const direction = row.gapToNarrowestChange < 0 ? 'narrow' : 'widen';
    const directionJa = direction === 'narrow' ? '縮小' : '拡大';
    insights.push(createInsight({
      type: direction === 'narrow' ? 'narrowest_gap_narrow' : 'narrowest_gap_widen',
      row,
      metric: 'gap_to_narrowest',
      value: row.gapToNarrowestChange,
      unit: 'pt',
      direction,
      priority: 66 + Math.min(Math.floor(Math.abs(row.gapToNarrowestChange) * 10), 6),
      messageJa: `${subjectLabel(row)} は最狭との差が前回の ${fmtPt(row.gapToNarrowestPrev, false)} から ${fmtPt(row.gapToNarrowest, false)} へ${directionJa}しています。`,
      metadata: { dedupeKey: `narrowest_gap:${row.entityType}:${row.entityId}` },
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
      row,
      metric: 'gap_to_above',
      value: row.gapToAboveChange,
      unit: 'pt',
      direction,
      priority: 62 + Math.min(Math.floor(Math.abs(row.gapToAboveChange) * 10), 6),
      messageJa: `${subjectLabel(row)} は直上順位との差が前回の ${fmtPt(row.gapToAbovePrev, false)} から ${fmtPt(row.gapToAbove, false)} へ${directionJa}しています。`,
      metadata: { dedupeKey: `above_gap:${row.entityType}:${row.entityId}` },
    }));
  }

  return insights.slice(0, config.maxGapInsights);
}

function streakInsights(latest, config, terms) {
  const insights = [];
  for (const row of latest) {
    if (row.narrowingStreak >= config.minStreak) {
      insights.push(createInsight({
        type: 'narrowing_streak',
        row,
        metric: 'narrowing_streak',
        value: row.narrowingStreak,
        unit: terms.streakUnit,
        direction: 'narrow',
        priority: 58 + Math.min(row.narrowingStreak, 8),
        messageJa: `${subjectLabel(row)} はスプレッドが${row.narrowingStreak}${terms.streakUnit}連続で改善しています。`,
        metadata: { dedupeKey: `streak:${row.entityType}:${row.entityId}` },
      }));
    }
    if (row.wideningStreak >= config.minStreak) {
      insights.push(createInsight({
        type: 'widening_streak',
        row,
        metric: 'widening_streak',
        value: row.wideningStreak,
        unit: terms.streakUnit,
        direction: 'widen',
        priority: 58 + Math.min(row.wideningStreak, 8),
        messageJa: `${subjectLabel(row)} はスプレッドが${row.wideningStreak}${terms.streakUnit}連続で拡大しています。`,
        metadata: { dedupeKey: `streak:${row.entityType}:${row.entityId}` },
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
      const direction = row.zscore > 0 ? 'widen' : 'narrow';
      const directionJa = direction === 'widen' ? '上振れ' : '下振れ';
      return createInsight({
        type: 'zscore_outlier',
        row,
        metric: 'zscore',
        value: row.zscore,
        unit: 'sigma',
        direction,
        priority: 54 + Math.min(Math.floor(Math.abs(row.zscore)), 6),
        messageJa: `${subjectLabel(row)} のスプレッドは過去${config.window}${terms.streakUnit}平均対比で ${fmtSigma(row.zscore)} の${directionJa}です。`,
        metadata: { dedupeKey: `zscore:${row.entityType}:${row.entityId}` },
      });
    });
}

function createInsight({
  type,
  row = {},
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
    exchange: row.exchangeLabel || null,
    exchangeId: row.exchangeId || null,
    instrument: row.instrumentLabel || null,
    instrumentId: row.instrumentId || null,
    entityType: row.entityType || null,
    entityId: row.entityId || null,
    entityLabel: row.entityLabel || null,
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

function renderSalesSpreadInsightsJa(insights = []) {
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
      : `${insight.type}:${insight.entityType || '-'}:${insight.entityId || '-'}:${insight.metric}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(insight);
    if (selected.length >= maxInsights) break;
  }
  return selected;
}

function sortedByRank(rows) {
  return rows.slice().sort((a, b) => a.rank - b.rank || String(a.entityLabel).localeCompare(String(b.entityLabel), 'ja'));
}

function narrowestSecondGap(rows) {
  const sorted = sortedByRank(rows);
  if (sorted.length < 2) return null;
  return sorted[1].spreadPct - sorted[0].spreadPct;
}

function previousSpread(row) {
  if (!row || !isFiniteNumber(row.spreadPct) || !isFiniteNumber(row.spreadChange)) return null;
  return row.spreadPct - row.spreadChange;
}

function subjectLabel(row) {
  return row && (row.entityLabel || row.exchangeLabel || row.instrumentLabel || row.entityId || row.exchangeId || row.instrumentId || '対象');
}

function periodTerms(config) {
  const label = String(config.periodLabel || '').toLowerCase();
  if (['24h', '1d', 'day', 'daily', '日', '日次'].includes(label) || config.periods === 1) {
    return { currentLabel: '直近日', comparisonLabel: '前日比', streakUnit: '日' };
  }
  if (['7d', 'week', 'weekly', '週', '週次'].includes(label) || config.periods === 7) {
    return { currentLabel: '直近日', comparisonLabel: '7日前比', streakUnit: '日' };
  }
  if (['30d', 'month', 'monthly', '月', '月次'].includes(label) || config.periods === 30) {
    return { currentLabel: '直近日', comparisonLabel: '30日前比', streakUnit: '日' };
  }
  return { currentLabel: '最新期間', comparisonLabel: `${config.periods}期間前比`, streakUnit: '期間' };
}

function fmtPct(value) {
  if (!isFiniteNumber(value)) return '-';
  return `${value.toFixed(2)}%`;
}

function fmtPt(value, signed = true) {
  if (!isFiniteNumber(value)) return '-';
  const sign = signed && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}pt`;
}

function fmtSigma(value) {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}σ`;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

module.exports = {
  buildSalesSpreadFrame,
  generateSalesSpreadInsights,
  renderSalesSpreadInsightsJa,
};
