const FEE_TIERS = [
  { level: 1, rate: 0.0014 },
  { level: 2, rate: 0.0012 },
  { level: 3, rate: 0.0010 },
  { level: 4, rate: 0.0008 },
  { level: 5, rate: 0.0007 },
  { level: 6, rate: 0.0006 },
];

const DEFAULT_FEE_RATE = FEE_TIERS[0].rate;
const AUTO_CANCEL_IMPACT_PCT = 5;
const CIRCUIT_BREAKER_IMPACT_PCT = 50;
const DEFAULT_IMPACT_TARGETS = [1, 3, 5, 10, 25, 50];
const EPSILON = 1e-10;

function normalizePositiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function hasFiniteNumber(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function decimalPlaces(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || Number.isInteger(numeric)) return 0;
  const text = String(numeric).toLowerCase();
  const exponentIndex = text.indexOf('e-');
  if (exponentIndex >= 0) {
    return Number(text.slice(exponentIndex + 2));
  }
  const dotIndex = text.indexOf('.');
  return dotIndex >= 0 ? text.length - dotIndex - 1 : 0;
}

function scaleFactor(...values) {
  const decimals = values.reduce((max, value) => Math.max(max, decimalPlaces(value)), 0);
  return 10 ** Math.min(decimals, 12);
}

function floorToIncrement(value, increment) {
  const numeric = Number(value);
  const step = normalizePositiveNumber(increment);
  if (!Number.isFinite(numeric) || step == null) return numeric;
  const scale = scaleFactor(numeric, step);
  const scaledValue = Math.max(0, Math.floor((numeric + EPSILON) * scale));
  const scaledStep = Math.max(1, Math.round(step * scale));
  return Math.max(0, Math.floor(scaledValue / scaledStep) * scaledStep / scale);
}

function ceilToIncrement(value, increment) {
  const numeric = Number(value);
  const step = normalizePositiveNumber(increment);
  if (!Number.isFinite(numeric) || step == null) return numeric;
  const scale = scaleFactor(numeric, step);
  const scaledValue = Math.max(0, Math.ceil((numeric - EPSILON) * scale));
  const scaledStep = Math.max(1, Math.round(step * scale));
  return Math.max(0, Math.ceil(scaledValue / scaledStep) * scaledStep / scale);
}

function alignPriceToTick(side, price, tickSize) {
  const numeric = Number(price);
  const step = normalizePositiveNumber(tickSize);
  if (!Number.isFinite(numeric) || step == null) return numeric;
  return side === 'buy'
    ? ceilToIncrement(numeric, step)
    : floorToIncrement(numeric, step);
}

function formatConstraintValue(value) {
  const numeric = normalizePositiveNumber(value);
  if (numeric == null) return null;
  const places = Math.min(decimalPlaces(numeric), 12);
  return numeric.toFixed(places).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

function normalizeOptions(options = {}) {
  if (typeof options === 'number') {
    const tier = FEE_TIERS.find(item => item.level === options) || FEE_TIERS[0];
    return {
      feeRate: tier.rate,
      feeLabel: `Lv${tier.level}`,
      feeMode: 'tier',
      autoCancelThresholdPct: AUTO_CANCEL_IMPACT_PCT,
      circuitBreakerThresholdPct: CIRCUIT_BREAKER_IMPACT_PCT,
      minSize: null,
      sizeIncrement: null,
      tickSize: null,
      baseCurrency: 'BTC',
      quoteCurrency: 'JPY',
      market: {},
    };
  }

  const market = options.market && typeof options.market === 'object' ? options.market : {};
  let feeRate = null;
  let feeLabel = options.feeLabel || '';
  let feeMode = 'default';

  if (hasFiniteNumber(options.feeRate)) {
    feeRate = Math.max(0, Number(options.feeRate));
    feeLabel = feeLabel || '手入力';
    feeMode = 'manual';
  } else if (hasFiniteNumber(market.takerFeeRate)) {
    feeRate = Math.max(0, Number(market.takerFeeRate));
    feeLabel = feeLabel || market.takerFeeNote || '既定';
    feeMode = 'preset';
  } else {
    feeRate = DEFAULT_FEE_RATE;
    feeLabel = feeLabel || '既定';
  }

  return {
    feeRate,
    feeLabel,
    feeMode,
    autoCancelThresholdPct: Number.isFinite(Number(options.autoCancelThresholdPct))
      ? Number(options.autoCancelThresholdPct)
      : AUTO_CANCEL_IMPACT_PCT,
    circuitBreakerThresholdPct: Number.isFinite(Number(options.circuitBreakerThresholdPct))
      ? Number(options.circuitBreakerThresholdPct)
      : CIRCUIT_BREAKER_IMPACT_PCT,
    minSize: normalizePositiveNumber(options.minSize ?? market.minSize),
    sizeIncrement: normalizePositiveNumber(options.sizeIncrement ?? market.sizeIncrement),
    tickSize: normalizePositiveNumber(options.tickSize ?? market.tickSize),
    baseCurrency: market.baseCurrency || options.baseCurrency || 'BTC',
    quoteCurrency: market.quoteCurrency || options.quoteCurrency || 'JPY',
    market,
  };
}

function priceForImpact(side, midPrice, impactPct) {
  return side === 'buy'
    ? midPrice * (1 + impactPct / 100)
    : midPrice * (1 - impactPct / 100);
}

function directionalImpactPct(side, price, midPrice) {
  if (!midPrice || !price) return null;
  return side === 'buy'
    ? ((price - midPrice) / midPrice) * 100
    : ((midPrice - price) / midPrice) * 100;
}

function isWithinImpactBoundary(side, price, targetPrice) {
  return side === 'buy' ? price <= targetPrice : price >= targetPrice;
}

function calculateThresholdCapacity(side, impactPct, book) {
  const levels = side === 'buy' ? book.asks : book.bids;
  const targetPrice = priceForImpact(side, book.midPrice, impactPct);

  let maxBTCBeforeBreach = 0;
  let maxJPYBeforeBreach = 0;
  let levelsIncluded = 0;
  let ordersIncluded = 0;
  let lastPriceBeforeBreach = null;
  let breachLevel = null;

  for (const level of levels) {
    if (!isWithinImpactBoundary(side, level.price, targetPrice)) {
      breachLevel = level;
      break;
    }

    maxBTCBeforeBreach += level.quantity;
    maxJPYBeforeBreach += level.price * level.quantity;
    levelsIncluded++;
    ordersIncluded += level.orders;
    lastPriceBeforeBreach = level.price;
  }

  const avgPriceBeforeBreach = maxBTCBeforeBreach > EPSILON
    ? maxJPYBeforeBreach / maxBTCBeforeBreach
    : null;

  return {
    side,
    impactPct,
    targetPrice,
    maxBTCBeforeBreach,
    maxJPYBeforeBreach,
    avgPriceBeforeBreach,
    levelsIncluded,
    ordersIncluded,
    lastPriceBeforeBreach,
    breachPrice: breachLevel ? breachLevel.price : null,
    breachImpactPct: breachLevel
      ? directionalImpactPct(side, breachLevel.price, book.midPrice)
      : null,
    limitedByVisibleDepth: !breachLevel,
  };
}

function calculateImpactThresholds(book, targets = DEFAULT_IMPACT_TARGETS) {
  if (!book || book.midPrice === null) {
    return null;
  }

  return {
    targets,
    buy: targets.map(pct => calculateThresholdCapacity('buy', pct, book)),
    sell: targets.map(pct => calculateThresholdCapacity('sell', pct, book)),
  };
}

function buildRiskControls(side, book, options) {
  const autoCancel = calculateThresholdCapacity(side, options.autoCancelThresholdPct, book);
  const circuitBreaker = calculateThresholdCapacity(side, options.circuitBreakerThresholdPct, book);

  return {
    autoCancelThresholdPct: options.autoCancelThresholdPct,
    autoCancelThresholdPrice: autoCancel.targetPrice,
    autoCancelMaxBTCBeforeBreach: autoCancel.maxBTCBeforeBreach,
    autoCancelMaxJPYBeforeBreach: autoCancel.maxJPYBeforeBreach,
    autoCancelAvgPriceBeforeBreach: autoCancel.avgPriceBeforeBreach,
    autoCancelBreachPrice: autoCancel.breachPrice,
    autoCancelBreachImpactPct: autoCancel.breachImpactPct,
    autoCancelLimitedByVisibleDepth: autoCancel.limitedByVisibleDepth,
    circuitBreakerThresholdPct: options.circuitBreakerThresholdPct,
    circuitBreakerThresholdPrice: circuitBreaker.targetPrice,
    circuitBreakerMaxBTCBeforeBreach: circuitBreaker.maxBTCBeforeBreach,
    circuitBreakerMaxJPYBeforeBreach: circuitBreaker.maxJPYBeforeBreach,
    circuitBreakerBreachPrice: circuitBreaker.breachPrice,
    circuitBreakerBreachImpactPct: circuitBreaker.breachImpactPct,
    circuitBreakerLimitedByVisibleDepth: circuitBreaker.limitedByVisibleDepth,
    circuitBreakerUpperPrice: priceForImpact('buy', book.midPrice, options.circuitBreakerThresholdPct),
    circuitBreakerLowerPrice: priceForImpact('sell', book.midPrice, options.circuitBreakerThresholdPct),
  };
}

function trimFillsToBaseQuantity(side, fills, baseQuantity, midPrice) {
  let remaining = Math.max(0, Number(baseQuantity) || 0);
  let cumulativeBTC = 0;
  let cumulativeJPY = 0;
  const trimmed = [];

  for (const fill of fills) {
    if (remaining <= EPSILON) break;
    const quantity = Math.min(fill.quantity, remaining);
    if (quantity <= EPSILON) continue;

    const subtotalJPY = quantity * fill.price;
    cumulativeBTC += quantity;
    cumulativeJPY += subtotalJPY;

    trimmed.push({
      price: fill.price,
      quantity,
      subtotalJPY,
      orders: fill.orders,
      fullyConsumed: quantity >= fill.quantity - EPSILON,
      cumulativeBTC,
      cumulativeJPY,
      cumulativeImpactPct: directionalImpactPct(side, fill.price, midPrice),
    });

    remaining -= quantity;
  }

  return trimmed;
}

function summarizeExecution(side, fills, book, referencePrice) {
  const totalBTCFilled = fills.length > 0 ? fills[fills.length - 1].cumulativeBTC : 0;
  const totalJPYSpent = fills.length > 0 ? fills[fills.length - 1].cumulativeJPY : 0;
  const levelsConsumed = fills.length;
  const ordersConsumed = fills.reduce((total, fill) => total + Number(fill.orders || 0), 0);
  const vwap = totalBTCFilled > EPSILON ? totalJPYSpent / totalBTCFilled : null;
  const worstPrice = fills.length > 0 ? fills[fills.length - 1].price : null;
  const priceRange = worstPrice != null && referencePrice != null
    ? Math.abs(worstPrice - referencePrice)
    : null;

  let slippageFromBestJPY = null;
  let slippageFromBestPct = null;
  if (referencePrice != null && vwap != null && referencePrice > 0) {
    if (side === 'buy') {
      slippageFromBestJPY = vwap - referencePrice;
    } else {
      slippageFromBestJPY = referencePrice - vwap;
    }
    slippageFromBestPct = (slippageFromBestJPY / referencePrice) * 100;
  }

  let slippageFromMidPct = null;
  if (vwap != null && book.midPrice != null && book.midPrice > 0) {
    slippageFromMidPct = side === 'buy'
      ? ((vwap - book.midPrice) / book.midPrice) * 100
      : ((book.midPrice - vwap) / book.midPrice) * 100;
  }

  const marketImpactPct = worstPrice == null
    ? 0
    : Math.max(0, directionalImpactPct(side, worstPrice, book.midPrice));

  return {
    fills,
    totalBTCFilled,
    totalJPYSpent,
    levelsConsumed,
    ordersConsumed,
    vwap,
    worstPrice,
    priceRange,
    slippageFromBestJPY,
    slippageFromBestPct,
    slippageFromMidPct,
    marketImpactPct,
  };
}

function calculateImpact(side, amount, amountType, book, options = {}) {
  const normalizedOptions = normalizeOptions(options);
  const isBaseAmount = amountType === 'base' || amountType === 'btc';
  const normalizedAmountType = isBaseAmount ? 'base' : amountType;

  if (!book || book.midPrice === null) {
    return { error: '板データが取得できていません' };
  }

  const levels = side === 'buy' ? book.asks : book.bids;
  if (levels.length === 0) {
    return { error: '板データが空です' };
  }

  const referencePrice = alignPriceToTick(
    side,
    side === 'buy' ? book.bestAsk : book.bestBid,
    normalizedOptions.tickSize
  );

  const rawFills = [];
  let remainingBTC = isBaseAmount ? amount : Infinity;
  let remainingJPY = normalizedAmountType === 'jpy' ? amount : Infinity;
  let rawTotalBTCFilled = 0;
  let rawTotalJPYSpent = 0;
  let tickAdjustedCount = 0;

  for (const level of levels) {
    const fillPrice = alignPriceToTick(side, level.price, normalizedOptions.tickSize);
    if (Math.abs(fillPrice - Number(level.price)) > EPSILON) {
      tickAdjustedCount += 1;
    }

    let fillQty;
    if (isBaseAmount) {
      fillQty = Math.min(level.quantity, remainingBTC);
    } else {
      const maxBTC = remainingJPY / fillPrice;
      fillQty = Math.min(level.quantity, maxBTC);
    }

    if (fillQty <= EPSILON) break;

    const fillCost = fillQty * fillPrice;
    rawTotalBTCFilled += fillQty;
    rawTotalJPYSpent += fillCost;

    rawFills.push({
      price: fillPrice,
      quantity: fillQty,
      subtotalJPY: fillCost,
      orders: level.orders,
      fullyConsumed: fillQty >= level.quantity - EPSILON,
      cumulativeBTC: rawTotalBTCFilled,
      cumulativeJPY: rawTotalJPYSpent,
      cumulativeImpactPct: directionalImpactPct(side, fillPrice, book.midPrice),
    });

    remainingBTC -= fillQty;
    remainingJPY -= fillCost;

    if (isBaseAmount && remainingBTC <= EPSILON) break;
    if (normalizedAmountType === 'jpy' && remainingJPY < 0.5) break;
  }

  if (rawTotalBTCFilled <= EPSILON) {
    return { error: '約定できる数量がありません' };
  }

  const requestedBaseQuantity = isBaseAmount ? amount : rawTotalBTCFilled;
  const roundedBaseQuantity = normalizedOptions.sizeIncrement == null
    ? requestedBaseQuantity
    : floorToIncrement(requestedBaseQuantity, normalizedOptions.sizeIncrement);
  const quantityRounded = Math.abs(requestedBaseQuantity - roundedBaseQuantity) > EPSILON;
  const targetBaseQuantity = isBaseAmount
    ? Math.min(roundedBaseQuantity, rawTotalBTCFilled)
    : roundedBaseQuantity;
  const adjustedFills = Math.abs(targetBaseQuantity - rawTotalBTCFilled) > EPSILON
    ? trimFillsToBaseQuantity(side, rawFills, targetBaseQuantity, book.midPrice)
    : rawFills;
  const execution = summarizeExecution(side, adjustedFills, book, referencePrice);

  // Check insufficient liquidity after quantity rounding is applied.
  let insufficient = false;
  let shortfallBTC = 0;
  let shortfallJPY = 0;

  if (isBaseAmount && remainingBTC > amount * 0.00001) {
    insufficient = true;
    shortfallBTC = remainingBTC;
  }
  if (normalizedAmountType === 'jpy' && remainingJPY > 1 && rawTotalJPYSpent < amount * 0.99999) {
    insufficient = true;
    shortfallJPY = remainingJPY;
  }

  const blockingReasons = [];
  const constraintNotes = [];
  const sizeIncrementLabel = formatConstraintValue(normalizedOptions.sizeIncrement);
  const minSizeLabel = formatConstraintValue(normalizedOptions.minSize);
  const tickSizeLabel = formatConstraintValue(normalizedOptions.tickSize);
  const baseUnit = normalizedOptions.baseCurrency;
  const quoteUnit = normalizedOptions.quoteCurrency;

  if (quantityRounded && roundedBaseQuantity > EPSILON) {
    constraintNotes.push(
      `数量刻み ${sizeIncrementLabel} ${baseUnit} に合わせて ${formatConstraintValue(requestedBaseQuantity)} ${baseUnit} → ${formatConstraintValue(roundedBaseQuantity)} ${baseUnit} に切り下げ`
    );
  }

  if (tickAdjustedCount > 0) {
    constraintNotes.push(
      `価格刻み ${tickSizeLabel} ${quoteUnit} に合わせて板価格を補正`
    );
  }

  if (roundedBaseQuantity <= EPSILON && normalizedOptions.sizeIncrement != null) {
    blockingReasons.push(
      `数量刻み ${sizeIncrementLabel} ${baseUnit} 未満のため、発注数量が 0 ${baseUnit} になります`
    );
  }

  const minSizeTarget = isBaseAmount ? roundedBaseQuantity : execution.totalBTCFilled;
  if (normalizedOptions.minSize != null && minSizeTarget + EPSILON < normalizedOptions.minSize) {
    blockingReasons.push(
      `最小数量 ${minSizeLabel} ${baseUnit} を下回るため発注できません`
    );
  }

  const feesJPY = execution.totalJPYSpent * normalizedOptions.feeRate;
  const effectiveCostJPY = side === 'buy'
    ? execution.totalJPYSpent + feesJPY
    : execution.totalJPYSpent - feesJPY;
  const effectiveVWAP = execution.totalBTCFilled > EPSILON
    ? effectiveCostJPY / execution.totalBTCFilled
    : null;

  const totalSideVolume = side === 'buy' ? book.totalAskVolume : book.totalBidVolume;
  const remainingLiquidityBTC = totalSideVolume - execution.totalBTCFilled;
  const totalSideDepthJPY = side === 'buy' ? book.totalAskDepthJPY : book.totalBidDepthJPY;
  const remainingLiquidityJPY = totalSideDepthJPY - execution.totalJPYSpent;

  const riskControls = buildRiskControls(side, book, normalizedOptions);
  const autoCancelTriggered = execution.marketImpactPct >= normalizedOptions.autoCancelThresholdPct;
  const circuitBreakerTriggered = execution.marketImpactPct >= normalizedOptions.circuitBreakerThresholdPct;
  let executionStatus = 'executable';
  let executionStatusLabel = '発注可能';
  let recommendedAction = 'この板だけを見る限り、設定した5%ガード内です。';

  if (blockingReasons.length > 0) {
    executionStatus = 'invalid_constraints';
    executionStatusLabel = '実注文条件で不可';
    recommendedAction = '最小数量または刻み値に合う数量へ調整してください。';
  } else if (circuitBreakerTriggered) {
    executionStatus = 'circuit_breaker';
    executionStatusLabel = 'サーキットブレイク想定';
    recommendedAction = `${normalizedOptions.circuitBreakerThresholdPct}%のサーキットブレイク水準に到達するため、発注しないでください。`;
  } else if (autoCancelTriggered) {
    executionStatus = 'auto_cancel';
    executionStatusLabel = '自動キャンセル対象';
    recommendedAction = `${normalizedOptions.autoCancelThresholdPct}%以上の価格変動が見込まれるため、自動キャンセル対象です。`;
  } else if (insufficient) {
    executionStatus = 'insufficient_liquidity';
    executionStatusLabel = '表示板内の流動性不足';
    recommendedAction = '表示されている板だけでは全量約定できません。数量を下げるか、分割執行を検討してください。';
  }

  return {
    // Market state
    midPrice: book.midPrice,
    bestBid: book.bestBid,
    bestAsk: book.bestAsk,
    spread: book.spread,
    spreadPct: book.spreadPct,

    // Request
    side,
    requestedAmount: amount,
    amountType: normalizedAmountType,
    requestedBaseQuantity,
    roundedBaseQuantity,

    // Execution
    totalBTCFilled: execution.totalBTCFilled,
    totalJPYSpent: execution.totalJPYSpent,
    vwap: execution.vwap,
    worstPrice: execution.worstPrice,
    priceRange: execution.priceRange,

    // Raw execution before rounding
    rawTotalBTCFilled,
    rawTotalJPYSpent,
    sizeRoundingDeltaBase: Math.max(0, requestedBaseQuantity - roundedBaseQuantity),
    sizeRoundingDeltaJPY: Math.max(0, rawTotalJPYSpent - execution.totalJPYSpent),
    unusedQuoteJPY: normalizedAmountType === 'jpy'
      ? Math.max(0, amount - execution.totalJPYSpent)
      : 0,

    // Slippage & impact
    slippageFromBestJPY: execution.slippageFromBestJPY,
    slippageFromBestPct: execution.slippageFromBestPct,
    slippageFromMidPct: execution.slippageFromMidPct,
    marketImpactPct: execution.marketImpactPct,

    // Constraints
    constraintSummary: {
      minSize: normalizedOptions.minSize,
      sizeIncrement: normalizedOptions.sizeIncrement,
      tickSize: normalizedOptions.tickSize,
      baseCurrency: baseUnit,
      quoteCurrency: quoteUnit,
    },
    constraintAdjusted: quantityRounded || tickAdjustedCount > 0,
    quantityRounded,
    priceAdjustedToTick: tickAdjustedCount > 0,
    blockingReasons,
    constraintNotes,

    // Depth
    levelsConsumed: execution.levelsConsumed,
    ordersConsumed: execution.ordersConsumed,
    totalLevelsAvailable: levels.length,

    // Fees
    feeLabel: normalizedOptions.feeLabel,
    feeMode: normalizedOptions.feeMode,
    feeRate: normalizedOptions.feeRate,
    feeRatePct: normalizedOptions.feeRate * 100,
    feesJPY,
    effectiveCostJPY,
    effectiveVWAP,

    // Guardrails
    ...riskControls,
    autoCancelTriggered,
    circuitBreakerTriggered,
    executionStatus,
    executionStatusLabel,
    recommendedAction,
    executableUnderGuards: executionStatus === 'executable',
    remainingImpactToAutoCancelPct: normalizedOptions.autoCancelThresholdPct - execution.marketImpactPct,
    remainingImpactToCircuitBreakerPct: normalizedOptions.circuitBreakerThresholdPct - execution.marketImpactPct,

    // Remaining
    remainingLiquidityBTC,
    remainingLiquidityJPY,
    insufficient,
    shortfallBTC,
    shortfallJPY,

    // Fills
    fills: execution.fills,

    // Timestamp
    bookTimestamp: book.timestamp,
  };
}

module.exports = {
  calculateImpact,
  calculateImpactThresholds,
  FEE_TIERS,
  DEFAULT_FEE_RATE,
  AUTO_CANCEL_IMPACT_PCT,
  CIRCUIT_BREAKER_IMPACT_PCT,
  DEFAULT_IMPACT_TARGETS,
};
