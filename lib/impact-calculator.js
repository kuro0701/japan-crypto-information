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

function normalizeOptions(options = {}) {
  if (typeof options === 'number') {
    const tier = FEE_TIERS.find(t => t.level === options) || FEE_TIERS[0];
    return {
      feeRate: tier.rate,
      feeLabel: `Lv${tier.level}`,
      autoCancelThresholdPct: AUTO_CANCEL_IMPACT_PCT,
      circuitBreakerThresholdPct: CIRCUIT_BREAKER_IMPACT_PCT,
    };
  }

  const feeRate = Number.isFinite(Number(options.feeRate))
    ? Math.max(0, Number(options.feeRate))
    : DEFAULT_FEE_RATE;

  return {
    feeRate,
    feeLabel: options.feeLabel || '任意',
    autoCancelThresholdPct: Number.isFinite(Number(options.autoCancelThresholdPct))
      ? Number(options.autoCancelThresholdPct)
      : AUTO_CANCEL_IMPACT_PCT,
    circuitBreakerThresholdPct: Number.isFinite(Number(options.circuitBreakerThresholdPct))
      ? Number(options.circuitBreakerThresholdPct)
      : CIRCUIT_BREAKER_IMPACT_PCT,
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

  const referencePrice = side === 'buy' ? book.bestAsk : book.bestBid;

  const fills = [];
  let remainingBTC = isBaseAmount ? amount : Infinity;
  let remainingJPY = normalizedAmountType === 'jpy' ? amount : Infinity;
  let totalBTCFilled = 0;
  let totalJPYSpent = 0;
  let levelsConsumed = 0;
  let ordersConsumed = 0;

  for (const level of levels) {
    let fillQty;

    if (isBaseAmount) {
      fillQty = Math.min(level.quantity, remainingBTC);
    } else {
      const maxBTC = remainingJPY / level.price;
      fillQty = Math.min(level.quantity, maxBTC);
    }

    if (fillQty < 1e-10) break;

    const fillCost = fillQty * level.price;

    totalBTCFilled += fillQty;
    totalJPYSpent += fillCost;
    levelsConsumed++;
    ordersConsumed += level.orders;

    fills.push({
      price: level.price,
      quantity: fillQty,
      subtotalJPY: fillCost,
      orders: level.orders,
      fullyConsumed: fillQty >= level.quantity - 1e-10,
      cumulativeBTC: totalBTCFilled,
      cumulativeJPY: totalJPYSpent,
      cumulativeImpactPct: directionalImpactPct(side, level.price, book.midPrice),
    });

    remainingBTC -= fillQty;
    remainingJPY -= fillCost;

    if (isBaseAmount && remainingBTC < 1e-10) break;
    if (normalizedAmountType === 'jpy' && remainingJPY < 0.5) break;
  }

  if (totalBTCFilled < 1e-10) {
    return { error: '約定できる数量がありません' };
  }

  // Check insufficient liquidity
  let insufficient = false;
  let shortfallBTC = 0;
  let shortfallJPY = 0;

  if (isBaseAmount && remainingBTC > amount * 0.00001) {
    insufficient = true;
    shortfallBTC = remainingBTC;
  }
  if (normalizedAmountType === 'jpy' && remainingJPY > 1 && totalJPYSpent < amount * 0.99999) {
    insufficient = true;
    shortfallJPY = remainingJPY;
  }

  const vwap = totalJPYSpent / totalBTCFilled;
  const worstPrice = fills[fills.length - 1].price;

  // Slippage from best price
  let slippageFromBestJPY, slippageFromBestPct;
  if (side === 'buy') {
    slippageFromBestJPY = vwap - referencePrice;
    slippageFromBestPct = (slippageFromBestJPY / referencePrice) * 100;
  } else {
    slippageFromBestJPY = referencePrice - vwap;
    slippageFromBestPct = (slippageFromBestJPY / referencePrice) * 100;
  }

  // Slippage from mid
  let slippageFromMidPct;
  if (side === 'buy') {
    slippageFromMidPct = ((vwap - book.midPrice) / book.midPrice) * 100;
  } else {
    slippageFromMidPct = ((book.midPrice - vwap) / book.midPrice) * 100;
  }

  // Market impact
  const marketImpactPct = Math.max(0, directionalImpactPct(side, worstPrice, book.midPrice));

  const priceRange = Math.abs(worstPrice - referencePrice);

  // Fees
  const feesJPY = totalJPYSpent * normalizedOptions.feeRate;

  let effectiveCostJPY;
  if (side === 'buy') {
    effectiveCostJPY = totalJPYSpent + feesJPY;
  } else {
    effectiveCostJPY = totalJPYSpent - feesJPY;
  }

  const effectiveVWAP = effectiveCostJPY / totalBTCFilled;

  // Remaining liquidity
  const totalSideVolume = side === 'buy' ? book.totalAskVolume : book.totalBidVolume;
  const remainingLiquidityBTC = totalSideVolume - totalBTCFilled;
  const totalSideDepthJPY = side === 'buy' ? book.totalAskDepthJPY : book.totalBidDepthJPY;
  const remainingLiquidityJPY = totalSideDepthJPY - totalJPYSpent;

  const riskControls = buildRiskControls(side, book, normalizedOptions);
  const autoCancelTriggered = marketImpactPct >= normalizedOptions.autoCancelThresholdPct;
  const circuitBreakerTriggered = marketImpactPct >= normalizedOptions.circuitBreakerThresholdPct;
  let executionStatus = 'executable';
  let executionStatusLabel = '発注可能';
  let recommendedAction = 'この板だけを見る限り、設定した5%ガード内です。';

  if (circuitBreakerTriggered) {
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

    // Execution
    totalBTCFilled,
    totalJPYSpent,
    vwap,
    worstPrice,
    priceRange,

    // Slippage & impact
    slippageFromBestJPY,
    slippageFromBestPct,
    slippageFromMidPct,
    marketImpactPct,

    // Depth
    levelsConsumed,
    ordersConsumed,
    totalLevelsAvailable: levels.length,

    // Fees
    feeLabel: normalizedOptions.feeLabel,
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
    remainingImpactToAutoCancelPct: normalizedOptions.autoCancelThresholdPct - marketImpactPct,
    remainingImpactToCircuitBreakerPct: normalizedOptions.circuitBreakerThresholdPct - marketImpactPct,

    // Remaining
    remainingLiquidityBTC,
    remainingLiquidityJPY,
    insufficient,
    shortfallBTC,
    shortfallJPY,

    // Fills
    fills,

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
