document.addEventListener('DOMContentLoaded', () => {
  const Api = window.AppApi;
  const AppFmt = window.AppFormatters;
  const AppUtil = window.AppUtils;
  const pagePoller = window.PagePoller.create();
  const WINDOW_LABELS = {
    '1d': '24時間',
    '7d': '7日間',
    '30d': '30日間',
  };
  const WINDOW_GUIDES = {
    '1d': '直近の勢いを見る',
    '7d': '一時的なブレをならして見る',
    '30d': '普段の流動性を見る',
  };
  const PERIOD_COMPARISON_LABELS = {
    '1d': '前日比',
    '7d': '前7日比',
    '30d': '前30日比',
  };
  const VOLUME_COLUMN_LABELS = {
    '1d': '出来高（24時間累計）',
    '7d': '出来高（7日間累計）',
    '30d': '出来高（30日間累計）',
  };
  const ALL_VALUE = '__all__';
  const HISTORY_FETCH_WINDOW = '90d';
  const INSIGHTS_FETCH_WINDOW = '90d';
  const pageRoot = document.querySelector('[data-volume-page]') || document.body;
  const API_BASE = (String(pageRoot.getAttribute('data-volume-api-base') || '/api/volume-share').replace(/\/+$/, '') || '/api/volume-share');
  const IS_DERIVATIVES_PAGE = API_BASE.includes('/derivatives/');
  const DEFAULT_SHOW_ZERO_VOLUME_ROWS = IS_DERIVATIVES_PAGE;
  const DEFAULT_SIMULATOR_MARKET = String(pageRoot.getAttribute('data-volume-default-market') || 'BTC-JPY').trim().toUpperCase();
  const DEFAULT_SIMULATOR_EXCHANGE = String(pageRoot.getAttribute('data-volume-default-exchange') || '').trim().toLowerCase();
  let selectedWindow = '1d';
  let selectedInstrument = ALL_VALUE;
  let selectedExchange = ALL_VALUE;
  let selectedHistoryWindow = '30d';
  let instrumentSearchTerm = '';
  let showZeroVolumeRows = DEFAULT_SHOW_ZERO_VOLUME_ROWS;
  let showAllInstrumentRows = false;
  let latestData = null;
  let volumeHistoryRows = [];
  let volumeHistoryMeta = {};
  let volumeShareHistoryChart = null;
  let shareAbortController = null;
  let volumeHistoryAbortController = null;
  let volumeInsightsAbortController = null;
  const CHART_COLORS = ['#35e0a5', '#ff6b70', '#35c8d2', '#f4c95d', '#dbe7df', '#ff9f7e', '#9ad46a'];
  const SHARE_REFRESH_MS = 60000;
  const VOLUME_HISTORY_REFRESH_MS = 600000;
  const VOLUME_INSIGHTS_REFRESH_MS = 600000;
  const EMPTY_FILTER_MESSAGE = '条件に合う出来高データがありません。フィルターを変更してください。';
  const WAITING_DATA_MESSAGE = '出来高データを取得中です。集計に数秒かかる場合があります。';
  const PARTIAL_DATA_FAILURE_MESSAGE = '一部の取引所APIからデータを取得できていません。取得できた取引所のみで比較しています。';
  const TABLE_DEFAULT_HINT = '銘柄や取引所を絞り込むと、より正確なコスト比較が可能です';
  const INSTRUMENT_PREVIEW_LIMIT = 20;
  const ESTIMATED_DATA_NOTE = '※取引所APIの仕様上、24時間累計値が直接配信されていない場合は、直近のローソク足データ等から算出しています。公式公開データに基づいた参考値です。';
  const SUMMARY_COST_REMINDER = '大きめの注文を出す場合は、手数料や板の厚みによる影響を考慮し、板シミュレーターで実質コストも合わせてご確認ください。';
  const MIN_VISIBLE_VOLUME_JPY = 10000;
  const SHOW_ACCOUNT_OPENING_CTA = !IS_DERIVATIVES_PAGE;
  const EXCHANGE_SHARE_COLSPAN = SHOW_ACCOUNT_OPENING_CTA ? 4 : 3;
  const CAMPAIGN_DATA = window.VolumeShareCampaigns && window.VolumeShareCampaigns.exchanges
    ? window.VolumeShareCampaigns.exchanges
    : {};
  const EXCHANGE_META = window.VolumeShareExchangeMeta && window.VolumeShareExchangeMeta.exchanges
    ? window.VolumeShareExchangeMeta.exchanges
    : {};
  const INSTRUMENT_QUICK_JUMP_IDS = ['BTC-JPY', 'ETH-JPY', 'XRP-JPY', 'SOL-JPY'];
  const EXCHANGE_REASON_LINES = {
    'binance-japan': 'グローバル大手ブランドの国内向け板',
    bitflyer: '主要銘柄とLightningの実績を確認しやすい',
    coincheck: 'アプリ利用者が多く初心者導線を確認しやすい',
    bitbank: 'アルトコインの板取引（取引所）のラインナップが豊富',
    gmo: '即時入金や暗号資産の送金手数料が無料',
    okj: '板データと取扱銘柄をまとめて確認',
    bittrade: '幅広い銘柄の出来高を横断確認',
  };

  const $ = AppUtil.byId;
  const setText = AppUtil.setText;
  const escapeHtml = AppUtil.escapeHtml;
  const exchangePageUrl = AppUtil.exchangePageUrl;
  const marketPageUrl = AppUtil.marketPageUrl;
  const cssVar = AppUtil.cssVar;
  const parseNumber = AppUtil.parseNumber;
  const JPY_INTEGER_FORMATTER = new Intl.NumberFormat('ja-JP', {
    maximumFractionDigits: 0,
  });
  const JPY_UNIT_FORMATTER = new Intl.NumberFormat('ja-JP', {
    maximumFractionDigits: 1,
  });
  const setHtml = (id, html) => {
    const el = $(id);
    if (el) el.innerHTML = html;
    return el;
  };
  const fmtJpy = formatJpyAmount;
  const fmtPct = AppFmt.pct;
  const fmtPctCompact = (value, digits = 1) => AppFmt.pct(value, digits);
  const fmtDateTime = AppFmt.dateTime;
  const shortDate = AppFmt.shortDate;
  const WINDOW_VALUES = new Set(Object.keys(WINDOW_LABELS));
  const HISTORY_WINDOW_VALUES = new Set(['7d', '30d']);
  const KPI_TONE_CLASSES = ['is-positive', 'is-caution', 'is-danger'];
  const INSIGHT_TYPE_LABELS = {
    top_gainer: 'シェア急拡大',
    top_loser: 'シェア縮小',
    share_up: '取引活発化',
    share_down: 'シェア低下',
    leader_change: '首位交代',
    leader_gap_change: '首位',
    leader_hold: '首位',
    rank_up: '順位上昇',
    rank_down: '順位変動',
    leader_gap_narrow: '差縮小',
    leader_gap_widen: '差拡大',
    above_gap_narrow: '直上差',
    above_gap_widen: '直上差',
    increase_streak: '連続上昇',
    decrease_streak: 'シェア変動',
    zscore_outlier: '注目の動き',
    market_concentration: '市場構造',
    hhi_change: '市場構造',
  };

  function normalizeWindow(value, fallback) {
    return WINDOW_VALUES.has(value) ? value : fallback;
  }

  function normalizeHistoryWindow(value, fallback) {
    return HISTORY_WINDOW_VALUES.has(value) ? value : fallback;
  }

  function normalizeInstrumentId(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(normalized) ? normalized : ALL_VALUE;
  }

  function normalizeExchangeId(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return normalized || ALL_VALUE;
  }

  function normalizeSearchTerm(value) {
    return String(value || '').trim().toLowerCase();
  }

  function readBooleanParam(params, name, fallback) {
    const value = params.get(name);
    if (value == null) return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  function readInitialState() {
    const params = new URLSearchParams(window.location.search);
    return {
      window: normalizeWindow(params.get('window'), '1d'),
      instrumentId: normalizeInstrumentId(params.get('instrumentId') || params.get('instrument') || params.get('market')),
      exchangeId: normalizeExchangeId(params.get('exchange') || params.get('exchangeId')),
      historyWindow: normalizeHistoryWindow(params.get('historyWindow'), '30d'),
      instrumentSearchTerm: normalizeSearchTerm(params.get('q') || params.get('search')),
      showZeroVolumeRows: readBooleanParam(params, 'showNoTrade', DEFAULT_SHOW_ZERO_VOLUME_ROWS),
    };
  }

  function writeUrlState() {
    const params = new URLSearchParams();
    if (selectedWindow !== '1d') params.set('window', selectedWindow);
    if (selectedInstrument !== ALL_VALUE) params.set('instrumentId', selectedInstrument);
    if (selectedExchange !== ALL_VALUE) params.set('exchange', selectedExchange);
    if (selectedHistoryWindow !== '30d') params.set('historyWindow', selectedHistoryWindow);
    if (instrumentSearchTerm) params.set('q', instrumentSearchTerm);
    if (showZeroVolumeRows !== DEFAULT_SHOW_ZERO_VOLUME_ROWS) {
      params.set('showNoTrade', showZeroVolumeRows ? '1' : '0');
    }
    const nextUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState(null, '', nextUrl);
  }

  function syncTabButtons(selector, datasetKey, activeValue) {
    document.querySelectorAll(selector).forEach((button) => {
      const isActive = (button.dataset[datasetKey] || '') === activeValue;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
  }

  function activateWindow(nextWindow) {
    selectedWindow = normalizeWindow(nextWindow, '1d');
    syncTabButtons('[data-window]', 'window', selectedWindow);
    updateWindowGuide();
    loadShare();
  }

  const initialState = readInitialState();
  selectedWindow = initialState.window;
  selectedInstrument = initialState.instrumentId;
  selectedExchange = initialState.exchangeId;
  selectedHistoryWindow = initialState.historyWindow;
  instrumentSearchTerm = initialState.instrumentSearchTerm;
  showZeroVolumeRows = initialState.showZeroVolumeRows;
  if (instrumentSearchTerm && selectedInstrument !== ALL_VALUE) {
    selectedInstrument = ALL_VALUE;
  }

  function shareBar(sharePct) {
    const width = Math.max(0, Math.min(100, sharePct || 0));
    return `<div class="share-bar mt-1"><span style="width: ${width}%"></span></div>`;
  }

  function campaignForExchange(exchangeId) {
    const key = String(exchangeId || '').trim().toLowerCase();
    return key ? CAMPAIGN_DATA[key] || null : null;
  }

  function safeHref(value, fallback = '#') {
    const href = String(value || '').trim();
    if (!href) return fallback;
    if (/^(https?:)?\/\//i.test(href) || href.startsWith('/')) return href;
    return fallback;
  }

  function exchangeReason(exchangeId) {
    return EXCHANGE_REASON_LINES[String(exchangeId || '').trim().toLowerCase()] || '出来高と板の厚みを確認';
  }

  function trackingPixelHtml(campaign) {
    if (!campaign || !campaign.trackingPixelUrl) return '';
    return `<img src="${escapeHtml(safeHref(campaign.trackingPixelUrl, ''))}" width="1" height="1" border="0" alt="">`;
  }

  function affiliateAttrs(campaign) {
    if (!campaign || !campaign.affiliateUrl) return '';
    const attrs = [
      campaign.target ? `target="${escapeHtml(campaign.target)}"` : '',
      campaign.rel ? `rel="${escapeHtml(campaign.rel)}"` : 'rel="sponsored noopener"',
      campaign.referrerPolicy ? `referrerpolicy="${escapeHtml(campaign.referrerPolicy)}"` : '',
    ];
    return attrs.filter(Boolean).join(' ');
  }

  function campaignDetailHref(campaign, exchangeId) {
    if (campaign && campaign.path) return safeHref(campaign.path, exchangePageUrl(exchangeId));
    return exchangePageUrl(exchangeId);
  }

  function campaignLastCheckedDisplay(value) {
    const label = String(value || '').trim();
    if (!label || label === '公式確認待ち' || label === '後ほど追加') return '';
    return label;
  }

  function exchangeMetaFor(exchangeId) {
    const key = String(exchangeId || '').trim().toLowerCase();
    return key ? EXCHANGE_META[key] || null : null;
  }

  function marketFeeMetaFor(exchangeId, instrumentId) {
    const exchange = exchangeMetaFor(exchangeId);
    if (!exchange || !instrumentId || !exchange.markets) return null;
    const key = String(instrumentId || '').trim().toUpperCase();
    return exchange.markets[key] || null;
  }

  function formatFeeRate(rate) {
    const numericRate = Number(rate);
    if (!Number.isFinite(numericRate)) return '';
    const pct = numericRate * 100;
    const digits = Math.abs(pct) < 0.1 ? 3 : 2;
    return `${Number(pct.toFixed(digits))}%`;
  }

  function exchangeFeeMeta(exchangeId) {
    const exchange = exchangeMetaFor(exchangeId) || {};
    const market = selectedInstrument !== ALL_VALUE
      ? marketFeeMetaFor(exchangeId, selectedInstrument)
      : null;
    const rate = market && market.takerFeeRate != null
      ? market.takerFeeRate
      : exchange.takerFeeRate;
    const note = (market && market.takerFeeNote) || exchange.takerFeeNote || '';
    const scope = market && market.label
      ? `${market.label} の設定`
      : '取引所の既定値';
    return {
      rate: Number.isFinite(Number(rate)) ? Number(rate) : null,
      note,
      scope,
    };
  }

  function renderExchangeFeeCell(exchangeId) {
    const fee = exchangeFeeMeta(exchangeId);
    const href = `${exchangePageUrl(exchangeId)}#exchange-fees`;
    if (fee.rate == null) {
      return `
        <div class="volume-fee-cell">
          <a class="volume-fee-cell__rate volume-fee-cell__rate--muted" href="${escapeHtml(href)}">公式手数料表を確認</a>
          <span class="volume-fee-cell__note">Maker / taker・銘柄別条件は公式確認</span>
        </div>
      `;
    }

    const note = [fee.scope, fee.note].filter(Boolean).join(' / ');
    return `
      <div class="volume-fee-cell">
        <span class="volume-fee-cell__rate">Taker ${escapeHtml(formatFeeRate(fee.rate))}</span>
        <span class="volume-fee-cell__note">${escapeHtml(note || '条件により変動')}</span>
        <a class="volume-fee-cell__link" href="${escapeHtml(href)}">Maker・条件別</a>
      </div>
    `;
  }

  function renderAccountCta(exchangeId, exchangeLabel) {
    const campaign = campaignForExchange(exchangeId);
    const hasAffiliate = Boolean(campaign && campaign.affiliateUrl);
    const href = hasAffiliate
      ? safeHref(campaign.affiliateUrl, campaignDetailHref(campaign, exchangeId))
      : campaignDetailHref(campaign, exchangeId);
    const attrs = hasAffiliate ? affiliateAttrs(campaign) : '';
    const label = hasAffiliate ? '口座開設へ' : '詳細を見る';
    const className = hasAffiliate
      ? 'volume-account-cta'
      : 'volume-account-cta volume-account-cta--secondary';
    const ariaLabel = hasAffiliate
      ? `${exchangeLabel || exchangeId}の口座開設ページを開く`
      : `${exchangeLabel || exchangeId}の詳細を見る`;
    return `<a class="${className}" href="${escapeHtml(href)}"${attrs ? ` ${attrs}` : ''} aria-label="${escapeHtml(ariaLabel)}">${escapeHtml(label)}${hasAffiliate ? trackingPixelHtml(campaign) : ''}</a>`;
  }

  function renderExchangeNameCell(exchange) {
    const exchangeId = exchange.exchangeId || exchange.id || '';
    const exchangeLabel = exchange.exchangeLabel || exchange.label || exchangeId;
    if (!SHOW_ACCOUNT_OPENING_CTA) return escapeHtml(exchangeLabel);
    return `
      <div class="volume-exchange-entry">
        <div class="volume-exchange-entry__copy">
          <span class="volume-exchange-entry__name">${escapeHtml(exchangeLabel)}</span>
          <span class="volume-exchange-entry__reason">${escapeHtml(exchangeReason(exchangeId))}</span>
        </div>
        ${renderAccountCta(exchangeId, exchangeLabel)}
      </div>
    `;
  }

  function renderCampaignCell(exchangeId) {
    const campaign = campaignForExchange(exchangeId);
    if (!campaign) {
      return `
        <div class="volume-campaign-cell">
          <a class="volume-campaign-tag volume-campaign-tag--muted" href="${escapeHtml(exchangePageUrl(exchangeId))}">詳細を確認</a>
          <span class="volume-campaign-cell__note">キャンペーン情報は随時更新中</span>
        </div>
      `;
    }

    const href = campaignDetailHref(campaign, exchangeId);
    const details = [
      campaign.referralCode ? `コード ${campaign.referralCode}` : '',
      campaignLastCheckedDisplay(campaign.lastChecked),
    ].filter(Boolean).join(' / ');
    return `
      <div class="volume-campaign-cell">
        <a class="volume-campaign-tag" href="${escapeHtml(href)}">${escapeHtml(campaign.tag || '公式キャンペーン確認')}</a>
        <span class="volume-campaign-cell__note">${escapeHtml(details || '最新条件は公式で確認')}</span>
      </div>
    `;
  }

  function hydratePurposeAccountLinks() {
    if (!SHOW_ACCOUNT_OPENING_CTA) return;
    document.querySelectorAll('[data-volume-account-link]').forEach((link) => {
      const exchangeId = String(link.getAttribute('data-volume-account-link') || '').trim().toLowerCase();
      const campaign = campaignForExchange(exchangeId);
      if (!campaign || !campaign.affiliateUrl) return;
      link.setAttribute('href', safeHref(campaign.affiliateUrl, link.getAttribute('href') || '#'));
      const attrs = affiliateAttrs(campaign).match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      attrs.forEach((attr) => {
        const eqIndex = attr.indexOf('=');
        if (eqIndex <= 0) return;
        const name = attr.slice(0, eqIndex);
        const value = attr.slice(eqIndex + 1).replace(/^"|"$/g, '');
        link.setAttribute(name, value);
      });
      if (campaign.trackingPixelUrl && !link.querySelector('img[data-volume-tracking-pixel]')) {
        const img = document.createElement('img');
        img.src = safeHref(campaign.trackingPixelUrl, '');
        img.width = 1;
        img.height = 1;
        img.border = '0';
        img.alt = '';
        img.setAttribute('data-volume-tracking-pixel', 'true');
        link.appendChild(img);
      }
    });
  }

  function sourceLabel(meta) {
    if (meta.source === 'daily-snapshots') return `24hスナップショット ${meta.dailySnapshotCount}件`;
    if (meta.source === 'daily-snapshot') return '24hスナップショット';
    if (meta.source === 'latest-fallback') return '最新24h収集値';
    return '最新24h収集値';
  }

  function volumeColumnLabel(windowKey = selectedWindow) {
    return VOLUME_COLUMN_LABELS[windowKey] || VOLUME_COLUMN_LABELS['1d'];
  }

  function renderVolumeColumnHeading(windowKey = selectedWindow) {
    const label = volumeColumnLabel(windowKey);
    return label.replace(/^出来高/, '出来高<span class="table-heading-sub">') + '</span>';
  }

  function updateVolumeColumnLabels(windowKey = selectedWindow) {
    ['exchange-volume-heading', 'instrument-volume-heading'].forEach((id) => {
      const el = $(id);
      if (el) el.innerHTML = renderVolumeColumnHeading(windowKey);
    });
  }

  function provisionalSnapshotNote(meta, latestKey, countKey) {
    if (!meta) return '';
    const latestDate = meta[latestKey];
    const count = Number(meta[countKey]) || 0;
    if (!latestDate) return '';
    const targetLabel = latestDate === todayJstDateString() ? '本日分' : `${latestDate}分`;
    return count > 1
      ? `（${targetLabel}を含む${count}件は集計中の暫定値）`
      : `（${targetLabel}は集計中の暫定値）`;
  }

  function partialSnapshotNote(meta, latestKey, countKey) {
    if (!meta) return '';
    const latestDate = meta[latestKey];
    const count = Number(meta[countKey]) || 0;
    if (!latestDate || count < 1) return '';
    return count > 1
      ? `欠損あり ${latestDate} まで ${count}件`
      : `欠損あり ${latestDate}`;
  }

  const API_STATUS_LABELS = {
    success: '成功',
    partial: '一部API未取得',
    failed: '失敗',
    waiting: '待機中',
  };

  const DATA_KIND_LABELS = {
    measured: '実測',
    estimated: '推計',
    mixed: '実測+推計',
    unknown: '-',
  };
  const DATA_KIND_DESCRIPTIONS = {
    measured: '実測: 取引所APIから直接取得した出来高またはJPY換算済みの値です。',
    estimated: '推計: 取引所APIの仕様上、24時間累計値が直接配信されていないため、直近のローソク足データ等から算出しています。公式公開データに基づいた参考値です。',
    mixed: '実測+推計: 実測値と推計値が混在しています。推計値は取引所APIの仕様上、24時間累計値が直接配信されていない場合に、直近のローソク足データ等から算出した参考値です。',
  };

  const TRANSPORT_LABELS = {
    websocket: 'WebSocket',
    rest: 'REST',
    web: 'Web',
  };

  function transportLabel(sources) {
    const labels = (sources || [])
      .map(source => TRANSPORT_LABELS[source] || source)
      .filter(Boolean);
    return labels.length > 0 ? labels.join(' + ') : '-';
  }

  function qualityStatusCell(row) {
    const status = row.apiStatus || 'waiting';
    const label = API_STATUS_LABELS[status] || status;
    const note = row.message ? `<div class="quality-note" title="${escapeHtml(row.message)}">${escapeHtml(row.message)}</div>` : '';
    return `<span class="quality-badge quality-badge--${escapeHtml(status)}">${escapeHtml(label)}</span>${note}`;
  }

  function dataKindCell(dataKind) {
    const key = dataKind || 'unknown';
    const label = DATA_KIND_LABELS[key] || key || '-';
    const description = DATA_KIND_DESCRIPTIONS[key];
    if (!description) return escapeHtml(label);
    const helpIcon = key === 'estimated' || key === 'mixed'
      ? '<span class="quality-kind__help" aria-hidden="true">?</span>'
      : '';
    return `<span class="quality-kind" title="${escapeHtml(description)}" aria-label="${escapeHtml(description)}" tabindex="0"><span>${escapeHtml(label)}</span>${helpIcon}</span>`;
  }

  function historySourceLabel(meta) {
    if (!meta) return 'データ取得中';
    if (meta.source === 'daily-snapshots') return `日次 ${meta.historySnapshotCount}件`;
    if (meta.source === 'latest-fallback') return '最新24h収集値';
    return 'データ取得中';
  }

  function chartColor(index) {
    return CHART_COLORS[index % CHART_COLORS.length];
  }

  function uniqueOptions(rows, valueKey, labelKey) {
    const byValue = new Map();
    for (const row of rows || []) {
      const value = row[valueKey];
      if (!value || byValue.has(value)) continue;
      byValue.set(value, {
        value,
        label: row[labelKey] || value,
      });
    }
    return Array.from(byValue.values())
      .sort((a, b) => String(a.label).localeCompare(String(b.label), 'ja'));
  }

  function populateFilter(selectId, options, selectedValue) {
    const select = $(selectId);
    if (!select) return ALL_VALUE;

    const values = new Set(options.map(option => option.value));
    const nextValue = values.has(selectedValue) ? selectedValue : ALL_VALUE;
    select.innerHTML = [
      `<option value="${ALL_VALUE}">すべて</option>`,
      ...options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`),
    ].join('');
    select.value = nextValue;
    return nextValue;
  }

  function syncFilterOptions(data) {
    const rows = data.rows || [];
    selectedInstrument = populateFilter(
      'volume-instrument-filter',
      uniqueOptions(rows, 'instrumentId', 'instrumentLabel'),
      selectedInstrument
    );
    selectedExchange = populateFilter(
      'volume-exchange-filter',
      uniqueOptions(rows, 'exchangeId', 'exchangeLabel'),
      selectedExchange
    );
  }

  function compactSearchText(value) {
    return normalizeSearchTerm(value).replace(/[\s/_-]+/g, '');
  }

  function instrumentMatchesSearch(row) {
    if (!instrumentSearchTerm) return true;
    const haystack = [
      row.instrumentId,
      row.instrumentLabel,
    ].filter(Boolean).join(' ');
    const normalizedHaystack = normalizeSearchTerm(haystack);
    const compactNeedle = compactSearchText(instrumentSearchTerm);
    const compactHaystack = compactSearchText(haystack);
    return normalizedHaystack.includes(instrumentSearchTerm)
      || (compactNeedle && compactHaystack.includes(compactNeedle));
  }

  function hasActiveFilters() {
    return selectedInstrument !== ALL_VALUE || selectedExchange !== ALL_VALUE || Boolean(instrumentSearchTerm);
  }

  function rowMatchesFilters(row) {
    return (selectedInstrument === ALL_VALUE || row.instrumentId === selectedInstrument)
      && (selectedExchange === ALL_VALUE || row.exchangeId === selectedExchange)
      && instrumentMatchesSearch(row);
  }

  function buildFilteredShare(data) {
    const byExchange = new Map();
    const byInstrument = new Map();
    const rows = [];
    let totalQuoteVolume = 0;

    for (const row of data.rows || []) {
      if (!rowMatchesFilters(row)) continue;
      const quoteVolume = parseNumber(row.quoteVolume);
      if (quoteVolume == null || quoteVolume < 0) continue;

      const normalizedRow = {
        ...row,
        quoteVolume,
      };
      rows.push(normalizedRow);
      totalQuoteVolume += quoteVolume;

      if (!byExchange.has(row.exchangeId)) {
        byExchange.set(row.exchangeId, {
          exchangeId: row.exchangeId,
          exchangeLabel: row.exchangeLabel,
          quoteVolume: 0,
        });
      }
      byExchange.get(row.exchangeId).quoteVolume += quoteVolume;

      if (!byInstrument.has(row.instrumentId)) {
        byInstrument.set(row.instrumentId, {
          instrumentId: row.instrumentId,
          instrumentLabel: row.instrumentLabel,
          quoteVolume: 0,
        });
      }
      byInstrument.get(row.instrumentId).quoteVolume += quoteVolume;
    }

    const filteredRows = rows.map(row => {
      const instrumentTotal = byInstrument.get(row.instrumentId);
      return {
        ...row,
        instrumentTotalQuoteVolume: instrumentTotal ? instrumentTotal.quoteVolume : 0,
        instrumentSharePct: instrumentTotal && instrumentTotal.quoteVolume > 0
          ? (row.quoteVolume / instrumentTotal.quoteVolume) * 100
          : 0,
        totalSharePct: totalQuoteVolume > 0 ? (row.quoteVolume / totalQuoteVolume) * 100 : 0,
      };
    }).sort((a, b) => {
      const instrumentVolumeDiff = (Number(b.instrumentTotalQuoteVolume) || 0) - (Number(a.instrumentTotalQuoteVolume) || 0);
      if (instrumentVolumeDiff !== 0) return instrumentVolumeDiff;
      if (a.instrumentId !== b.instrumentId) return a.instrumentId.localeCompare(b.instrumentId);
      const rowVolumeDiff = (Number(b.quoteVolume) || 0) - (Number(a.quoteVolume) || 0);
      if (rowVolumeDiff !== 0) return rowVolumeDiff;
      return String(a.exchangeLabel || a.exchangeId || '').localeCompare(String(b.exchangeLabel || b.exchangeId || ''), 'ja');
    });

    const exchanges = Array.from(byExchange.values())
      .map(exchange => ({
        ...exchange,
        sharePct: totalQuoteVolume > 0 ? (exchange.quoteVolume / totalQuoteVolume) * 100 : 0,
      }))
      .sort((a, b) => b.quoteVolume - a.quoteVolume);

    const instruments = Array.from(byInstrument.values())
      .map(instrument => ({
        ...instrument,
        sharePct: totalQuoteVolume > 0 ? (instrument.quoteVolume / totalQuoteVolume) * 100 : 0,
      }))
      .sort((a, b) => b.quoteVolume - a.quoteVolume);

    return {
      exchanges,
      instruments,
      rows: filteredRows,
      totalQuoteVolume,
    };
  }

  function hasPositiveQuoteVolume(row) {
    return Number(row && row.quoteVolume) > 0;
  }

  function visibleInstrumentRows(rows) {
    if (showZeroVolumeRows) return rows || [];
    return (rows || []).filter(hasPositiveQuoteVolume);
  }

  function uniqueInstrumentCount(rows) {
    const ids = new Set();
    for (const row of rows || []) {
      const key = row.instrumentId || row.instrumentLabel;
      if (key) ids.add(key);
    }
    return ids.size;
  }

  function instrumentRowsForDisplay(rows) {
    const allRows = rows || [];
    const totalInstrumentCount = uniqueInstrumentCount(allRows);
    if (showAllInstrumentRows || hasActiveFilters() || totalInstrumentCount <= INSTRUMENT_PREVIEW_LIMIT) {
      return {
        rows: allRows,
        totalInstrumentCount,
        displayedInstrumentCount: totalInstrumentCount,
        hiddenInstrumentCount: 0,
        hiddenRowCount: 0,
        limit: INSTRUMENT_PREVIEW_LIMIT,
      };
    }

    const allowedInstrumentIds = new Set();
    for (const row of allRows) {
      const key = row.instrumentId || row.instrumentLabel;
      if (!key || allowedInstrumentIds.has(key)) continue;
      if (allowedInstrumentIds.size >= INSTRUMENT_PREVIEW_LIMIT) break;
      allowedInstrumentIds.add(key);
    }

    const previewRows = allRows.filter(row => allowedInstrumentIds.has(row.instrumentId || row.instrumentLabel));
    return {
      rows: previewRows,
      totalInstrumentCount,
      displayedInstrumentCount: allowedInstrumentIds.size,
      hiddenInstrumentCount: Math.max(0, totalInstrumentCount - allowedInstrumentIds.size),
      hiddenRowCount: Math.max(0, allRows.length - previewRows.length),
      limit: INSTRUMENT_PREVIEW_LIMIT,
    };
  }

  function renderInstrumentMoreControl(previewInfo) {
    const container = $('instrument-share-more');
    if (!container) return;

    if (!previewInfo || previewInfo.hiddenInstrumentCount <= 0) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }

    container.hidden = false;
    container.innerHTML = `
      <span class="volume-instrument-more__status">出来高上位${previewInfo.displayedInstrumentCount}銘柄を表示中</span>
      <button class="btn btn-secondary volume-instrument-more__button" type="button" data-volume-show-all-instruments>
        さらに銘柄を表示する（+${previewInfo.hiddenInstrumentCount}銘柄）
      </button>
    `;
  }

  function instrumentAnchorId(instrumentId) {
    const key = String(instrumentId || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return key ? `volume-instrument-${key}` : '';
  }

  function renderInstrumentQuickJumps(rows) {
    const container = $('instrument-quick-jumps');
    if (!container) return;

    const byInstrument = new Map();
    for (const row of rows || []) {
      const instrumentId = row.instrumentId || '';
      if (!instrumentId || byInstrument.has(instrumentId)) continue;
      byInstrument.set(instrumentId, row.instrumentLabel || instrumentId);
    }

    const ids = INSTRUMENT_QUICK_JUMP_IDS.filter(instrumentId => byInstrument.has(instrumentId));
    if (selectedInstrument !== ALL_VALUE && byInstrument.has(selectedInstrument) && !ids.includes(selectedInstrument)) {
      ids.unshift(selectedInstrument);
    }

    if (ids.length === 0) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }

    container.hidden = false;
    container.innerHTML = [
      '<span class="volume-quick-jumps__label">主要銘柄</span>',
      ...ids.map((instrumentId) => {
        const label = String(byInstrument.get(instrumentId) || instrumentId).split('/')[0];
        return `<a class="volume-quick-jump" href="#${escapeHtml(instrumentAnchorId(instrumentId))}" data-volume-jump-instrument="${escapeHtml(instrumentId)}">${escapeHtml(label)}</a>`;
      }),
    ].join('');
  }

  function scrollToInstrument(instrumentId) {
    const targetId = instrumentAnchorId(instrumentId);
    if (!targetId) return false;
    const target = $(targetId);
    if (!target) return false;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  }

  function updateInstrumentTableHint(hiddenZeroRows, previewInfo) {
    const messages = [];
    if (previewInfo && previewInfo.hiddenInstrumentCount > 0) {
      messages.push(`銘柄別シェアは出来高上位${previewInfo.displayedInstrumentCount}銘柄を表示中です。検索やフィルターで対象を絞れます。`);
    }
    if (hiddenZeroRows > 0 && !showZeroVolumeRows) {
      messages.push(`${hiddenZeroRows}件の取引なし銘柄を非表示にしています。必要な場合は「取引なしの銘柄も表示する」をオンにしてください。`);
    }
    if (messages.length > 0) {
      setText('volume-table-hint', messages.join(' '));
      return;
    }
    setText('volume-table-hint', TABLE_DEFAULT_HINT);
  }

  function resetInstrumentPreview() {
    showAllInstrumentRows = false;
  }

  function renderExchangeRows(exchanges, emptyMessage = WAITING_DATA_MESSAGE) {
    const tbody = $('exchange-share-tbody');
    if (!tbody) return;
    const volumeLabel = volumeColumnLabel();

    if (!exchanges || exchanges.length === 0) {
      tbody.innerHTML = `<tr><td colspan="${EXCHANGE_SHARE_COLSPAN}" class="text-center text-gray-500 py-4">${escapeHtml(emptyMessage)}</td></tr>`;
      return;
    }

    tbody.innerHTML = exchanges.map((exchange, index) => `
      <tr class="border-b border-gray-800/60 ${index === 0 ? 'data-table__row--rank-1' : ''}">
        <td class="font-bold text-gray-200" data-label="${SHOW_ACCOUNT_OPENING_CTA ? '取引所（口座開設）' : '取引所'}">${renderExchangeNameCell(exchange)}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="${escapeHtml(volumeLabel)}">${volumeDisplay(exchange.quoteVolume)}</td>
        <td class="is-num text-right font-mono text-yellow-300" data-label="シェア">
          ${fmtPct(exchange.sharePct)}
          ${shareBar(exchange.sharePct)}
        </td>
        ${SHOW_ACCOUNT_OPENING_CTA ? `<td class="text-gray-300" data-label="取引手数料（板・既定taker）">${renderExchangeFeeCell(exchange.exchangeId)}</td>` : ''}
      </tr>
    `).join('');
  }

  function renderInstrumentRows(rows, emptyMessage = WAITING_DATA_MESSAGE, options = {}) {
    const tbody = $('instrument-share-tbody');
    if (!tbody) return;
    const volumeLabel = volumeColumnLabel();
    const hiddenZeroRows = Number(options.hiddenZeroRows) || 0;

    if (!rows || rows.length === 0) {
      const message = hiddenZeroRows > 0 && !showZeroVolumeRows
        ? '出来高がある銘柄はありません。「取引なしの銘柄も表示する」をオンにすると確認できます。'
        : emptyMessage;
      tbody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">${escapeHtml(message)}</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row, index) => {
      const instrumentLabel = row.instrumentLabel || row.instrumentId || '銘柄';
      const linkTitle = `${instrumentLabel}の取引所間コストを比較`;
      const previousRow = rows[index - 1];
      const isGroupStart = !previousRow || previousRow.instrumentId !== row.instrumentId;
      const rowClasses = [
        'border-b',
        'border-gray-800/60',
        'volume-instrument-row',
        isGroupStart ? 'volume-instrument-row--group-start' : 'volume-instrument-row--group-follow',
        index === 0 ? 'data-table__row--rank-1' : '',
      ].filter(Boolean).join(' ');
      const instrumentCell = isGroupStart
        ? `
          <td class="font-bold text-gray-200 volume-instrument-cell volume-instrument-cell--leader" data-label="銘柄">
            <a class="market-link" href="${marketPageUrl(row.instrumentId)}" title="${escapeHtml(linkTitle)}" aria-label="${escapeHtml(linkTitle)}">${escapeHtml(instrumentLabel)}</a>
          </td>
        `
        : `
          <td class="volume-instrument-cell volume-instrument-cell--repeat" data-label="銘柄">
            <span class="sr-only">${escapeHtml(instrumentLabel)}</span>
            <span class="volume-instrument-repeat" data-repeat-label="${escapeHtml(instrumentLabel)}（続き）" aria-hidden="true"></span>
          </td>
        `;
      const rowId = isGroupStart ? instrumentAnchorId(row.instrumentId) : '';
      const rowIdAttr = rowId ? ` id="${escapeHtml(rowId)}"` : '';
      return `
        <tr${rowIdAttr} class="${rowClasses}">
          ${instrumentCell}
          <td class="text-gray-300" data-label="取引所">${escapeHtml(row.exchangeLabel)}</td>
          <td class="is-num text-right font-mono text-gray-300" data-label="${escapeHtml(volumeLabel)}">
            ${volumeDisplay(row.quoteVolume)}
          </td>
          <td class="is-num text-right font-mono text-green-300" data-label="銘柄内シェア">
            ${fmtPct(row.instrumentSharePct)}
            ${shareBar(row.instrumentSharePct)}
          </td>
          <td class="is-num text-right font-mono text-yellow-300" data-label="全体シェア">${fmtPct(row.totalSharePct)}</td>
        </tr>
      `;
    }).join('');
  }

  function renderQualityRows(qualityRows) {
    const tbody = $('volume-quality-tbody');
    if (!tbody) return;

    const rows = (qualityRows || []).filter(row => (
      selectedExchange === ALL_VALUE || row.exchangeId === selectedExchange
    ));
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center text-gray-500 py-4">${WAITING_DATA_MESSAGE}</td></tr>`;
      setText('volume-quality-meta', '取引所APIの取得状況を確認中です。');
      setText('volume-quality-note', ESTIMATED_DATA_NOTE);
      return;
    }

    const successCount = rows.filter(row => row.apiStatus === 'success').length;
    const issueCount = rows.filter(row => row.apiStatus === 'partial' || row.apiStatus === 'failed').length;
    const measuredCount = rows.reduce((sum, row) => sum + (Number(row.measuredCount) || 0), 0);
    const estimatedCount = rows.reduce((sum, row) => sum + (Number(row.estimatedCount) || 0), 0);
    const dataBasisLabel = estimatedCount > 0
      ? '推計（公開APIベースのJPY換算）を含む'
      : (measuredCount > 0 ? '実測データ中心' : 'データ種別を確認中');
    setText(
      'volume-quality-meta',
      `${rows.length}取引所 | 成功 ${successCount} | 要確認 ${issueCount} | ${dataBasisLabel}${issueCount > 0 ? ` | ${PARTIAL_DATA_FAILURE_MESSAGE}` : ''}`
    );
    setText('volume-quality-note', estimatedCount > 0
      ? ESTIMATED_DATA_NOTE
      : '取得種別は各社APIの公開範囲に応じて分類しています。');

    tbody.innerHTML = rows.map(row => `
      <tr class="border-b border-gray-800/60">
        <td class="font-bold text-gray-200" data-label="取引所">${escapeHtml(row.exchangeLabel || row.exchangeId)}</td>
        <td class="text-gray-300" data-label="API">${qualityStatusCell(row)}</td>
        <td class="text-gray-300" data-label="経路">${escapeHtml(transportLabel(row.transportSources))}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="サンプル">${Number(row.sampleCount) || 0}</td>
        <td class="text-gray-300" data-label="データ取得種別（実測/推計）">${dataKindCell(row.dataKind)}</td>
        <td class="is-num text-right font-mono text-gray-300" data-label="最終取得">
          ${escapeHtml(fmtDateTime(row.lastFetchedAt))}
          <div class="text-[10px] text-gray-500">元データ ${escapeHtml(fmtDateTime(row.lastSourceAt))}</div>
        </td>
      </tr>
    `).join('');
  }

  function setKpiValue(id, value, tone = '') {
    const el = $(id);
    if (!el) return;
    el.textContent = value ?? '-';
    el.classList.remove(...KPI_TONE_CLASSES);
    if (tone && KPI_TONE_CLASSES.includes(tone)) {
      el.classList.add(tone);
    }
  }

  function updateWindowGuide() {
    document.querySelectorAll('[data-window-guide]').forEach((card) => {
      const isActive = (card.dataset.windowGuide || '') === selectedWindow;
      card.classList.toggle('is-active', isActive);
      card.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  function formatCount(count, suffix) {
    return Number.isFinite(Number(count)) ? `${Number(count)}${suffix}` : '-';
  }

  function formatSignedPercent(value, digits = 2) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    const abs = Math.abs(num).toFixed(digits);
    if (num > 0) return `+${abs}%`;
    if (num < 0) return `-${abs}%`;
    return `0.${'0'.repeat(digits)}%`;
  }

  function nearFlatTrendNote(percentChange) {
    const num = Number(percentChange);
    if (!Number.isFinite(num)) return '';
    return Math.abs(num) < 0.1 ? 'ほぼ横ばい' : '';
  }

  function formatSignedJpy(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    const absLabel = fmtJpy(Math.abs(num));
    if (num > 0) return `+${absLabel}`;
    if (num < 0) return `-${absLabel}`;
    return absLabel;
  }

  function formatJpyAmount(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    const sign = num < 0 ? '-' : '';
    const abs = Math.abs(num);
    if (abs >= 1e8) return `${sign}${JPY_UNIT_FORMATTER.format(abs / 1e8)}億円`;
    if (abs >= 1e4) return `${sign}${JPY_UNIT_FORMATTER.format(abs / 1e4)}万円`;
    return `${sign}${JPY_INTEGER_FORMATTER.format(Math.round(abs))}円`;
  }

  function formatJpyExactYen(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    const sign = num < 0 ? '-' : '';
    return `${sign}${JPY_INTEGER_FORMATTER.format(Math.round(Math.abs(num)))}円`;
  }

  function todayJstDateString() {
    const parts = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  }

  function dateToJstDateString(date) {
    const parts = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  }

  function relativeTimeLabel(date) {
    const elapsedMs = Math.max(0, Date.now() - date.getTime());
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    if (elapsedMinutes < 1) return 'たった今';
    if (elapsedMinutes < 60) return `${elapsedMinutes}分前`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}時間前`;
    return `${Math.floor(elapsedHours / 24)}日前`;
  }

  function updatedAtDisplay(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const timestamp = dateToJstDateString(date) === todayJstDateString()
      ? AppFmt.time(date, { includeSeconds: false })
      : fmtDateTime(date);
    return `${timestamp}（${relativeTimeLabel(date)}）`;
  }

  function volumeDisplay(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) {
      return '<span class="volume-no-trade">取引なし</span>';
    }
    if (num < MIN_VISIBLE_VOLUME_JPY) {
      const exactLabel = formatJpyExactYen(num);
      return `<span class="volume-small" title="${escapeHtml(exactLabel)}" aria-label="${escapeHtml(`${exactLabel}、表示は1万円未満に丸めています`)}">1万円未満</span>`;
    }
    return fmtJpy(num);
  }

  function dominantVolumeRow(rows) {
    const best = (rows || []).reduce((currentBest, row) => {
      if (!currentBest) return row;
      return Number(row.quoteVolume || 0) > Number(currentBest.quoteVolume || 0) ? row : currentBest;
    }, null);
    return Number(best && best.quoteVolume) > 0 ? best : null;
  }

  function topThreeShare(exchanges) {
    return (exchanges || [])
      .slice(0, 3)
      .reduce((sum, exchange) => sum + (Number(exchange.sharePct) || 0), 0);
  }

  function concentrationMeta(sharePct, exchangeCount) {
    if (!exchangeCount) {
      return {
        label: 'データ待ち',
        detail: '比較対象の集計待ち',
        tone: 'is-danger',
      };
    }
    if (exchangeCount === 1) {
      return {
        label: '単独表示',
        detail: '1社のみ表示中',
        tone: 'is-caution',
      };
    }
    if (sharePct >= 85) {
      return {
        label: 'かなり集中',
        detail: '上位数社への偏りが強い状態です',
        tone: 'is-danger',
      };
    }
    if (sharePct >= 70) {
      return {
        label: '比較的集中',
        detail: '上位3社の影響が大きい状態です',
        tone: 'is-caution',
      };
    }
    if (sharePct >= 55) {
      return {
        label: '主要数社への分散傾向',
        detail: '特定の取引所への偏りは少なめです',
        tone: 'is-positive',
      };
    }
    return {
      label: '取引所ごとに分散',
      detail: '特定の取引所への偏りは少なめです',
      tone: 'is-positive',
    };
  }

  function concentrationSummaryBody(label, top3SharePct) {
    const top3Text = fmtPctCompact(top3SharePct, 1);
    if (label === '主要数社への分散傾向' || label === '取引所ごとに分散') {
      return `上位3社で市場全体の約${top3Text}を占めていますが、特定の1社への極端な集中はなく、流動性は適度に分散されています。そのため、ユーザーは各社の強み（銘柄数や手数料）に合わせて取引所を使い分けやすい環境と言えます。`;
    }
    if (label === '比較的集中') {
      return `上位3社で市場全体の約${top3Text}を占めており、上位取引所の影響が大きい状態です。まず首位候補を確認し、板の厚みと実質コストで比べるのがおすすめです。`;
    }
    if (label === 'かなり集中') {
      return `上位3社で市場全体の約${top3Text}を占めており、上位数社への偏りが強い状態です。まず首位候補を確認し、板の厚みと実質コストで比べるのがおすすめです。`;
    }
    if (label === '単独表示') {
      return '表示中の条件では1社のみを表示しています。フィルターを解除すると、ほかの取引所との比較もしやすくなります。';
    }
    return 'データがそろい次第、比較しやすい取引所候補を確認できます。';
  }

  function shareTone(sharePct) {
    const share = Number(sharePct);
    if (!Number.isFinite(share)) return '';
    if (share >= 50) return 'is-danger';
    if (share >= 35) return 'is-caution';
    return 'is-positive';
  }

  function qualityRowsForScope(qualityRows, filtered) {
    const exchangeIds = new Set((filtered.exchanges || []).map(exchange => exchange.exchangeId));
    return (qualityRows || []).filter((row) => {
      if (selectedExchange !== ALL_VALUE) return row.exchangeId === selectedExchange;
      if (exchangeIds.size === 0) return false;
      return exchangeIds.has(row.exchangeId);
    });
  }

  function reliabilityMeta(qualityRows, filtered, referenceTime) {
    const rows = qualityRowsForScope(qualityRows, filtered);
    if (rows.length === 0) {
      return {
        label: '-',
        detail: '取得状況を確認中',
        tone: '',
      };
    }

    const successCount = rows.filter(row => row.apiStatus === 'success').length;
    const partialCount = rows.filter(row => row.apiStatus === 'partial').length;
    const failedCount = rows.filter(row => row.apiStatus === 'failed').length;

    const referenceMs = Date.parse(referenceTime || '');
    const freshCount = Number.isFinite(referenceMs)
      ? rows.filter((row) => {
        const fetchedMs = Date.parse(row.lastFetchedAt || '');
        return Number.isFinite(fetchedMs) && Math.abs(referenceMs - fetchedMs) <= 6 * 60 * 60 * 1000;
      }).length
      : 0;
    const successRatio = successCount / rows.length;
    const freshnessRatio = rows.length > 0 ? freshCount / rows.length : 0;
    const score = successRatio * 0.75 + freshnessRatio * 0.25;

    let label = '高';
    let tone = 'is-positive';
    if (score < 0.55 || (failedCount > 0 && successRatio < 0.6)) {
      label = '要確認';
      tone = 'is-danger';
    } else if (score < 0.8 || partialCount > 0) {
      label = '中';
      tone = 'is-caution';
    }

    const issueCount = failedCount + partialCount;
    const scopeLabel = rows.length === 1 ? '対象1社' : `全${rows.length}社`;
    const normalStatusLabel = rows.length === 1 ? '対象社正常稼働中' : '全社正常稼働中';
    const detail = issueCount > 0
      ? `${scopeLabel}中${successCount}社のデータを取得中（要確認${issueCount}社）`
      : `${normalStatusLabel} | 主要データ反映済み`;

    return {
      label,
      detail,
      tone,
      statusLabel: issueCount > 0 ? `要確認${issueCount}社` : normalStatusLabel,
    };
  }

  function buildDailyTotals() {
    const byDate = new Map();

    for (const row of volumeHistoryRows) {
      if (!row.date || !rowMatchesFilters(row)) continue;
      const quoteVolume = parseNumber(row.quoteVolume);
      if (quoteVolume == null || quoteVolume < 0) continue;
      byDate.set(row.date, (byDate.get(row.date) || 0) + quoteVolume);
    }

    return Array.from(byDate.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([date, totalQuoteVolume]) => ({ date, totalQuoteVolume }));
  }

  function historyRowsForWindow(windowKey) {
    const targetDays = {
      '7d': 7,
      '30d': 30,
    }[windowKey];
    if (!targetDays) return volumeHistoryRows.slice();

    const dates = Array.from(new Set(volumeHistoryRows.map(row => row.date).filter(Boolean))).sort();
    const targetDateSet = new Set(dates.slice(-targetDays));
    return volumeHistoryRows.filter(row => targetDateSet.has(row.date));
  }

  function comparisonMetaForWindow(windowKey, filteredTotalQuoteVolume) {
    const totals = buildDailyTotals();
    const comparisonLabel = PERIOD_COMPARISON_LABELS[windowKey] || '前期間比';

    if (windowKey === '1d') {
      const previous = totals[totals.length - 1];
      if (!previous || !(previous.totalQuoteVolume > 0)) {
        return {
          label: comparisonLabel,
          value: '-',
          detail: '前日データ待ち',
          tone: '',
        };
      }

      const diff = Number(filteredTotalQuoteVolume || 0) - previous.totalQuoteVolume;
      const percentChange = (diff / previous.totalQuoteVolume) * 100;
      const trendNote = nearFlatTrendNote(percentChange);
      return {
        label: comparisonLabel,
        value: formatSignedPercent(percentChange),
        detail: [`${formatSignedJpy(diff)} | 前日 ${shortDate(previous.date)} 比`, trendNote].filter(Boolean).join(' | '),
        tone: diff > 0 ? 'is-positive' : diff < 0 ? 'is-danger' : '',
      };
    }

    const periodDays = {
      '7d': 7,
      '30d': 30,
    }[windowKey];

    if (!periodDays || totals.length < periodDays * 2) {
      return {
        label: comparisonLabel,
        value: '-',
        detail: `${comparisonLabel}の比較期間待ち`,
        tone: '',
      };
    }

    const previousPeriod = totals.slice(-(periodDays * 2), -periodDays);
    const currentPeriod = totals.slice(-periodDays);
    const previousTotal = previousPeriod.reduce((sum, row) => sum + (Number(row.totalQuoteVolume) || 0), 0);
    const currentTotal = Number.isFinite(Number(filteredTotalQuoteVolume))
      ? Number(filteredTotalQuoteVolume)
      : currentPeriod.reduce((sum, row) => sum + (Number(row.totalQuoteVolume) || 0), 0);

    if (!(previousTotal > 0)) {
      return {
        label: comparisonLabel,
        value: '-',
        detail: `${comparisonLabel}の比較期間待ち`,
        tone: 'is-caution',
      };
    }

    const diff = currentTotal - previousTotal;
    const percentChange = (diff / previousTotal) * 100;
    const trendNote = nearFlatTrendNote(percentChange);
    return {
      label: comparisonLabel,
      value: formatSignedPercent(percentChange),
      detail: [`${formatSignedJpy(diff)} | ${shortDate(currentPeriod[0].date)} - ${shortDate(currentPeriod[currentPeriod.length - 1].date)} vs ${shortDate(previousPeriod[0].date)} - ${shortDate(previousPeriod[previousPeriod.length - 1].date)}`, trendNote].filter(Boolean).join(' | '),
      tone: diff > 0 ? 'is-positive' : diff < 0 ? 'is-danger' : '',
    };
  }

  function simulatorUrlForSummary(primaryRow, topExchange) {
    const params = new URLSearchParams();
    const instrumentId = selectedInstrument !== ALL_VALUE
      ? selectedInstrument
      : (primaryRow && primaryRow.instrumentId ? primaryRow.instrumentId : DEFAULT_SIMULATOR_MARKET);
    const exchangeId = selectedExchange !== ALL_VALUE
      ? selectedExchange
      : (topExchange && topExchange.exchangeId
        ? topExchange.exchangeId
        : (primaryRow && primaryRow.exchangeId ? primaryRow.exchangeId : DEFAULT_SIMULATOR_EXCHANGE));

    if (instrumentId) params.set('market', instrumentId);
    if (exchangeId) params.set('exchange', exchangeId);
    params.set('side', 'buy');
    params.set('amountType', 'jpy');
    params.set('amount', '100000');
    return params.toString() ? `/simulator?${params.toString()}` : '/simulator';
  }

  function displayMarketLabel(value) {
    return String(value || DEFAULT_SIMULATOR_MARKET).replace(/-/g, '/');
  }

  function summaryCtaLabel(instrumentLabel) {
    if (IS_DERIVATIVES_PAGE) {
      return instrumentLabel ? `${instrumentLabel}の取引コストを確認する` : '取引コスト計算で確認';
    }
    const label = instrumentLabel || displayMarketLabel(DEFAULT_SIMULATOR_MARKET);
    return `${label} の取引コストを最安にする（板シミュレーター）`;
  }

  function renderKpis(filtered, meta, qualityRows) {
    const label = WINDOW_LABELS[meta.windowKey] || WINDOW_LABELS[selectedWindow];
    const topExchange = filtered.exchanges[0] || null;
    const topShare = topExchange ? Number(topExchange.sharePct) || 0 : null;
    const top3 = topThreeShare(filtered.exchanges);
    const concentration = concentrationMeta(top3, filtered.exchanges.length);
    const reliability = reliabilityMeta(qualityRows, filtered, meta.latestCapturedAt || meta.generatedAt);
    const dailyChange = comparisonMetaForWindow(meta.windowKey || selectedWindow, filtered.totalQuoteVolume);
    const instrumentLabel = activeInstrumentLabel('全銘柄');
    const exchangeLabel = selectedOptionLabel('volume-exchange-filter', '全取引所');

    setKpiValue('total-volume', fmtJpy(filtered.totalQuoteVolume));
    setText('total-volume-meta', `${label}累計 | ${filtered.rows.length}件`);

    setKpiValue('top-exchange', topExchange ? topExchange.exchangeLabel : '-', topExchange ? 'is-positive' : '');
    setText('top-exchange-meta', topExchange ? `全体シェア ${fmtPctCompact(topShare, 1)}` : '首位データ待ち');

    setKpiValue('top-share', topExchange ? fmtPctCompact(topShare, 1) : '-', topExchange ? shareTone(topShare) : '');
    setText('top-share-meta', topExchange ? `${topExchange.exchangeLabel} が首位` : '比較対象待ち');

    setKpiValue('top3-share', filtered.exchanges.length > 0 ? fmtPctCompact(top3, 1) : '-', concentration.tone);
    setText('top3-share-meta', concentration.detail);

    setKpiValue('exchange-count', formatCount(filtered.exchanges.length, '社'));
    setText('exchange-count-meta', (selectedInstrument !== ALL_VALUE || instrumentSearchTerm) ? `${instrumentLabel} の対象取引所数` : 'フィルター後の対象取引所数');

    setKpiValue('instrument-count', formatCount(filtered.instruments.length, '銘柄'));
    setText('instrument-count-meta', selectedExchange !== ALL_VALUE ? `${exchangeLabel} の対象銘柄数` : 'フィルター後の対象銘柄数');

    setText('daily-change-label', dailyChange.label);
    setKpiValue('daily-change', dailyChange.value, dailyChange.tone);
    setText('daily-change-meta', dailyChange.detail);

    const reliabilityValue = reliability.statusLabel && reliability.label === '高'
      ? `${reliability.label}（${reliability.statusLabel}）`
      : reliability.label;
    setKpiValue('data-reliability', reliabilityValue, reliability.tone);
    setText('data-reliability-meta', reliability.detail);

    return {
      concentration,
      dailyChange,
      reliability,
      topExchange,
      top3,
    };
  }

  function renderLiquiditySummary(filtered, meta, summaryParts) {
    const badge = $('volume-summary-badge');
    const topExchange = summaryParts.topExchange;
    const primaryRow = dominantVolumeRow(filtered.rows);
    const label = WINDOW_LABELS[meta.windowKey] || WINDOW_LABELS[selectedWindow];
    const instrumentLabel = activeInstrumentLabel('全銘柄');
    const exchangeLabel = selectedOptionLabel('volume-exchange-filter', '全取引所');

    if (badge) {
      badge.classList.remove('decision-summary-badge--idle', 'decision-summary-badge--loading', 'decision-summary-badge--ready', 'decision-summary-badge--error');
    }

    if (!primaryRow || !topExchange) {
      if (badge) {
        badge.classList.add('decision-summary-badge--error');
        badge.textContent = 'データ待ち';
      }
      setText('volume-summary-lead', '表示中の条件では、出来高データをまだ集計できていません。');
      setText('volume-summary-body', 'フィルター条件を変えるか、次回更新後にもう一度確認してください。');
      setText('volume-summary-note', '大きめの注文を出す前には、手数料や板の厚みによる影響も含めて、板シミュレーターで実質コストを確認してください。');
      setHtml('volume-summary-chips', '<span class="decision-summary-chip">集計待ち</span>');
      const link = $('volume-summary-link');
      if (link) {
        link.href = simulatorUrlForSummary(null, null);
        link.textContent = summaryCtaLabel();
      }
      return;
    }

    if (badge) {
      badge.classList.add('decision-summary-badge--ready');
      badge.textContent = summaryParts.concentration.label;
    }

    let lead = '';
    let body = '';
    if (selectedExchange !== ALL_VALUE && filtered.exchanges.length === 1) {
      if (selectedInstrument !== ALL_VALUE) {
        lead = `${label}では、${instrumentLabel} の出来高として ${exchangeLabel} のデータを表示しています。`;
        body = `${exchangeLabel} に絞り込んでいるため、取引所シェアは 100% 表示です。必要に応じてフィルターを解除し、取引所横断の集中度も確認してください。`;
      } else {
        lead = `${label}では、${exchangeLabel} の取扱銘柄の中で ${primaryRow.instrumentLabel} が最大出来高です。`;
        body = `${exchangeLabel} に絞り込んでいるため、取引所集中度は参考値です。銘柄の偏りと、取引所横断の比較は別々に確認すると判断しやすくなります。`;
      }
    } else if (selectedInstrument !== ALL_VALUE) {
      lead = `${label}（${instrumentLabel}）の出来高トップは ${topExchange.exchangeLabel} です。`;
      body = concentrationSummaryBody(summaryParts.concentration.label, summaryParts.top3);
    } else {
      lead = `${label}（全銘柄合計）の出来高トップは ${topExchange.exchangeLabel} です。`;
      body = concentrationSummaryBody(summaryParts.concentration.label, summaryParts.top3);
    }

    const dailyChangeText = summaryParts.dailyChange.value !== '-'
      ? `${summaryParts.dailyChange.label}は ${summaryParts.dailyChange.value} です。`
      : `${summaryParts.dailyChange.label}はまだ計算できません。`;
    const note = `${dailyChangeText} ${SUMMARY_COST_REMINDER}`;

    setText('volume-summary-lead', lead);
    setText('volume-summary-body', body);
    setText('volume-summary-note', note);

    setHtml(
      'volume-summary-chips',
      [
        `<span class="decision-summary-chip">${escapeHtml(label)}</span>`,
        `<span class="decision-summary-chip">${escapeHtml(WINDOW_GUIDES[selectedWindow] || '')}</span>`,
        `<span class="decision-summary-chip">精度 ${escapeHtml(summaryParts.reliability.label)}</span>`,
        `<span class="decision-summary-chip">${escapeHtml(
          selectedInstrument !== ALL_VALUE
            ? instrumentLabel
            : (selectedExchange !== ALL_VALUE ? exchangeLabel : '全銘柄')
        )}</span>`,
      ].join('')
    );

    const link = $('volume-summary-link');
    if (link) {
      link.href = simulatorUrlForSummary(primaryRow, topExchange);
      link.textContent = summaryCtaLabel(primaryRow && primaryRow.instrumentLabel);
    }
  }

  function insightTone(insight) {
    const direction = insight && insight.direction;
    if (direction === 'up' || direction === 'concentrating') return 'is-positive';
    if (direction === 'down') return 'is-caution';
    if (direction === 'narrow' || direction === 'dispersing') return 'is-caution';
    return '';
  }

  function friendlyInsightMessage(insight) {
    let message = insight.messageJa || insight.message_ja || '';
    message = message
      .replace(/^.+?の最大シェア(?:増加|低下)は\s*([^（]+)（([^、）]+)、([^）]*(?:拡大|縮小)[^）]*)）です。$/g, '$1 のシェアは$2（$3）しています。')
      .replace(/^(.+? のシェア)は([^（]*\+\d+(?:\.\d+)?pt)（([^）]+?) に拡大）しています。$/g, '$1が$2（$3 へ拡大）。')
      .replace(/^(.+? のシェア)は([^（]*-\d+(?:\.\d+)?pt)（([^）]+?) に縮小）しています。$/g, '$1は$2（$3 へ低下）。')
      .replace(/^(.+? のシェア)は([^（]*\+\d+(?:\.\d+)?pt)（([^）]+?)へ拡大）しています。$/g, '$1が$2（$3へ拡大）。')
      .replace(/^(.+? のシェア)は([^（]*-\d+(?:\.\d+)?pt)（([^）]+?)へ低下）しています。$/g, '$1は$2（$3へ低下）。')
      .replace(/へ(拡大|縮小)しています。$/g, 'へ$1。')
      .replace(/連続で上昇しています。$/g, '連続で上昇。')
      .replace(/連続で低下しています。$/g, '連続で低下。')
      .replace(/最大シェア低下/g, '最大シェア変動')
      .replace(/シェア低下/g, 'シェア変動')
      .replace(/順位低下/g, '順位変動')
      .replace(/連続低下/g, '連続変動')
      .replace(/急低下中/g, '大きく変動中')
      .replace(/低下しています/g, '変動しています')
      .replace(/低下しました/g, '変動しました')
      .replace(/異常値/g, '注目の動き');
    return message;
  }

  function formatInsightShare(value) {
    const share = Number(value);
    if (!Number.isFinite(share)) return '-';
    return fmtPctCompact(share * 100, 1);
  }

  function formatInsightPointChange(value) {
    const points = Number(value) * 100;
    if (!Number.isFinite(points)) return '-';
    const abs = Math.abs(points).toFixed(1);
    if (points > 0) return `+${abs}pt`;
    if (points < 0) return `-${abs}pt`;
    return '0.0pt';
  }

  function dashboardInsightMessageHtml(insight, fallbackMessage) {
    const metadata = insight && insight.metadata ? insight.metadata : {};
    const hasShareMovement = insight
      && insight.exchange
      && Number.isFinite(Number(metadata.previousShare))
      && Number.isFinite(Number(metadata.latestShare))
      && Number.isFinite(Number(insight.value));
    if (!hasShareMovement) return escapeHtml(fallbackMessage);

    return [
      `<span class="volume-insight-item__exchange">${escapeHtml(insight.exchange)}</span>: `,
      `${escapeHtml(formatInsightShare(metadata.previousShare))} `,
      '<span class="volume-insight-item__arrow" aria-hidden="true">→</span> ',
      `<strong>${escapeHtml(formatInsightShare(metadata.latestShare))}</strong> `,
      `<span class="volume-insight-item__delta">（${escapeHtml(metadata.comparisonLabel || '前回比')} ${escapeHtml(formatInsightPointChange(insight.value))}）</span>`,
    ].join('');
  }

  function renderInsights(data) {
    const list = $('volume-insights-list');
    if (!list) return;

    const meta = data && data.meta ? data.meta : {};
    const insights = Array.isArray(data && data.insights) ? data.insights : [];
    const period = meta.period || {};
    const filterParts = [];
    const instrumentLabel = activeInstrumentLabel('全銘柄');
    const exchangeLabel = selectedOptionLabel('volume-exchange-filter', '全取引所');
    if (selectedInstrument !== ALL_VALUE) filterParts.push(instrumentLabel);
    if (selectedExchange !== ALL_VALUE) filterParts.push(exchangeLabel);
    const range = meta.earliestDate && meta.latestDate ? `${meta.earliestDate} - ${meta.latestDate}` : '履歴データ待ち';
    setText(
      'volume-insights-meta',
      [
        period.comparisonLabel || '前回比',
        range,
        filterParts.length > 0 ? filterParts.join(' / ') : '全体',
      ].filter(Boolean).join(' | ')
    );

    if (insights.length === 0) {
      list.innerHTML = '<li class="volume-insight-item volume-insight-item--empty">有意な変化は検出されませんでした。</li>';
      return;
    }

    list.innerHTML = insights.map((insight) => {
      const label = INSIGHT_TYPE_LABELS[insight.type] || 'Insight';
      const tone = insightTone(insight);
      const message = friendlyInsightMessage(insight);
      const messageHtml = dashboardInsightMessageHtml(insight, message);
      return `
        <li class="volume-insight-item ${tone ? `volume-insight-item--${tone}` : ''}">
          <span class="volume-insight-item__label">${escapeHtml(label)}</span>
          <p class="volume-insight-item__message">${messageHtml}</p>
        </li>
      `;
    }).join('');
  }

  function renderFilteredShare() {
    if (!latestData) return;

    const meta = latestData.meta || {};
    const filtered = buildFilteredShare(latestData);
    const status = meta.refreshStatus || {};
    const label = WINDOW_LABELS[meta.windowKey] || WINDOW_LABELS[selectedWindow];
    const allRowCount = (latestData.rows || []).length;
    const visibleCountLabel = hasActiveFilters()
      ? `${filtered.rows.length}/${allRowCount}件`
      : `${filtered.rows.length}件`;
    const emptyMessage = hasActiveFilters() ? EMPTY_FILTER_MESSAGE : WAITING_DATA_MESSAGE;

    setText('share-status', status.running ? '更新中' : (allRowCount > 0 ? '集計済み' : '取得中'));
    setText('share-updated-at', updatedAtDisplay(meta.latestCapturedAt || meta.generatedAt));

    const dateRange = meta.earliestVolumeDateJst && meta.latestVolumeDateJst
      ? `${meta.earliestVolumeDateJst} - ${meta.latestVolumeDateJst}`
      : '最新収集値';
    const provisionalNote = provisionalSnapshotNote(meta, 'latestProvisionalVolumeDateJst', 'provisionalDailySnapshotCount');
    const partialNote = partialSnapshotNote(meta, 'latestPartialVolumeDateJst', 'partialDailySnapshotCount');
    setText(
      'share-meta',
      [label, sourceLabel(meta), dateRange, visibleCountLabel, provisionalNote, partialNote].filter(Boolean).join(' | ')
    );
    updateVolumeColumnLabels(meta.windowKey || selectedWindow);

    const summaryParts = renderKpis(filtered, meta, latestData.quality || []);
    const instrumentRows = visibleInstrumentRows(filtered.rows);
    const hiddenZeroRows = filtered.rows.length - instrumentRows.length;
    const instrumentPreview = instrumentRowsForDisplay(instrumentRows);
    renderLiquiditySummary(filtered, meta, summaryParts);
    renderExchangeRows(filtered.exchanges, emptyMessage);
    renderInstrumentQuickJumps(instrumentRows);
    renderInstrumentRows(instrumentPreview.rows, emptyMessage, { hiddenZeroRows });
    renderInstrumentMoreControl(instrumentPreview);
    renderQualityRows(latestData.quality || []);
    updateInstrumentTableHint(hiddenZeroRows, instrumentPreview);
    updateWindowGuide();
    renderVolumeHistory();
    writeUrlState();
  }

  function render(data) {
    latestData = data;
    syncFilterOptions(data);
    renderFilteredShare();
  }

  function baseHistoryChartOptions({ yTitle, yTickCallback, reverseY = false, tooltipLabel }) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: cssVar('--text-2', '#c9d3cd'),
            boxWidth: 14,
            boxHeight: 8,
            font: { size: 11, weight: 700 },
          },
        },
        tooltip: {
          backgroundColor: 'rgba(8, 11, 8, 0.94)',
          borderColor: 'rgba(205, 222, 190, 0.2)',
          borderWidth: 1,
          titleColor: cssVar('--text-1', '#f2f7f4'),
          bodyColor: cssVar('--text-2', '#c9d3cd'),
          callbacks: {
            label: tooltipLabel,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: cssVar('--text-4', '#6f7b76') },
          grid: { color: 'rgba(205, 222, 190, 0.08)' },
        },
        y: {
          beginAtZero: !reverseY,
          reverse: reverseY,
          title: { display: true, text: yTitle, color: cssVar('--text-3', '#9aa6a1') },
          ticks: {
            color: cssVar('--text-4', '#6f7b76'),
            callback: yTickCallback,
          },
          grid: { color: 'rgba(205, 222, 190, 0.08)' },
        },
      },
    };
  }

  function initVolumeHistoryCharts() {
    const shareCanvas = $('volume-share-history-chart');
    if (typeof Chart === 'undefined') return;

    if (shareCanvas) {
      volumeShareHistoryChart = new Chart(shareCanvas, {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: baseHistoryChartOptions({
          yTitle: 'シェア (%)',
          yTickCallback: (value) => `${value}%`,
          tooltipLabel: (ctx) => `${ctx.dataset.label}: ${fmtPct(ctx.parsed.y)}`,
        }),
      });
    }
  }

  function historyInstrumentMatches(row) {
    return (selectedInstrument === ALL_VALUE || row.instrumentId === selectedInstrument)
      && instrumentMatchesSearch(row);
  }

  function latestMapValue(dates, byDate, missingValue = null) {
    for (let index = dates.length - 1; index >= 0; index -= 1) {
      const value = byDate.get(dates[index]);
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return missingValue;
  }

  function selectedOptionLabel(selectId, allLabel) {
    const select = $(selectId);
    if (!select || select.value === ALL_VALUE) return allLabel;
    const option = select.selectedOptions && select.selectedOptions[0];
    return option ? option.textContent : select.value;
  }

  function activeInstrumentLabel(allLabel = '全銘柄') {
    if (selectedInstrument !== ALL_VALUE) return selectedOptionLabel('volume-instrument-filter', allLabel);
    return instrumentSearchTerm ? `検索: ${instrumentSearchTerm.toUpperCase()}` : allLabel;
  }

  function buildVolumeHistorySeries() {
    const scopedRows = historyRowsForWindow(selectedHistoryWindow);
    const dates = Array.from(new Set(scopedRows.map(row => row.date).filter(Boolean))).sort();
    const daily = new Map();

    for (const row of scopedRows) {
      if (!row.date || !historyInstrumentMatches(row)) continue;
      const quoteVolume = parseNumber(row.quoteVolume);
      if (quoteVolume == null || quoteVolume < 0) continue;

      if (!daily.has(row.date)) {
        daily.set(row.date, {
          totalQuoteVolume: 0,
          exchanges: new Map(),
        });
      }

      const day = daily.get(row.date);
      const existing = day.exchanges.get(row.exchangeId) || {
        exchangeId: row.exchangeId,
        exchangeLabel: row.exchangeLabel || row.exchangeId,
        quoteVolume: 0,
      };
      existing.quoteVolume += quoteVolume;
      day.exchanges.set(row.exchangeId, existing);
      day.totalQuoteVolume += quoteVolume;
    }

    const seriesByExchange = new Map();
    for (const date of dates) {
      const day = daily.get(date);
      if (!day || day.totalQuoteVolume <= 0) continue;

      const ranked = Array.from(day.exchanges.values())
        .sort((a, b) => b.quoteVolume - a.quoteVolume);

      ranked.forEach((exchange) => {
        if (!seriesByExchange.has(exchange.exchangeId)) {
          seriesByExchange.set(exchange.exchangeId, {
            exchangeId: exchange.exchangeId,
            label: exchange.exchangeLabel,
            shareByDate: new Map(),
          });
        }

        const series = seriesByExchange.get(exchange.exchangeId);
        series.shareByDate.set(date, (exchange.quoteVolume / day.totalQuoteVolume) * 100);
      });
    }

    let series = Array.from(seriesByExchange.values());
    if (selectedExchange !== ALL_VALUE) {
      series = series.filter(item => item.exchangeId === selectedExchange);
    } else {
      series = series.sort((a, b) => {
        const shareDiff = (latestMapValue(dates, b.shareByDate, -1) ?? -1) - (latestMapValue(dates, a.shareByDate, -1) ?? -1);
        if (shareDiff !== 0) return shareDiff;
        return String(a.label).localeCompare(String(b.label), 'ja');
      });
    }

    return {
      dates,
      series,
    };
  }

  function renderVolumeHistory() {
    setText(
      'volume-history-guide',
      `過去${selectedHistoryWindow === '7d' ? '7' : '30'}日間の出来高シェアの推移です。特定の取引所がシェアを伸ばしているか、市場全体のトレンドを確認できます。`
    );
    if (!volumeShareHistoryChart) return;

    const { dates, series } = buildVolumeHistorySeries();
    const labels = dates.map(shortDate);
    const shareDatasets = series.map((item, index) => {
      const color = chartColor(index);
      return {
        label: item.label,
        data: dates.map(date => item.shareByDate.get(date) ?? null),
        borderColor: color,
        backgroundColor: `${color}24`,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.25,
        spanGaps: true,
      };
    });

    volumeShareHistoryChart.data.labels = labels;
    volumeShareHistoryChart.data.datasets = shareDatasets;
    volumeShareHistoryChart.update('none');

    const range = dates.length > 0
      ? `${dates[0]} - ${dates[dates.length - 1]}`
      : '履歴データ待ち';
    const instrumentLabel = activeInstrumentLabel('全銘柄');
    const exchangeLabel = selectedOptionLabel('volume-exchange-filter', '全取引所');
    const seriesLabel = series.length > 0 ? `${series.length}系列` : '該当なし';
    const provisionalNote = provisionalSnapshotNote(volumeHistoryMeta, 'latestProvisionalVolumeDateJst', 'provisionalDailySnapshotCount');
    const partialNote = partialSnapshotNote(volumeHistoryMeta, 'latestPartialVolumeDateJst', 'partialDailySnapshotCount');

    setText(
      'volume-history-meta',
      [instrumentLabel, exchangeLabel, range, seriesLabel, historySourceLabel(volumeHistoryMeta), provisionalNote, partialNote].filter(Boolean).join(' | ')
    );
  }

  async function loadShare() {
    setText('share-status', '読み込み中');
    if (shareAbortController) {
      shareAbortController.abort();
      shareAbortController = null;
    }
    const controller = new AbortController();
    shareAbortController = controller;
    try {
      const data = await Api.fetchJson(`${API_BASE}?window=${encodeURIComponent(selectedWindow)}`, {
        signal: controller.signal,
      });
      render(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('share-status', '取得できませんでした');
      setText('share-meta', '出来高データを取得できませんでした。時間をおいて再読み込みしてください。');
    } finally {
      if (shareAbortController === controller) {
        shareAbortController = null;
      }
    }
  }

  async function loadVolumeHistory() {
    setText('volume-history-meta', '日次スナップショットを読み込み中');
    if (volumeHistoryAbortController) {
      volumeHistoryAbortController.abort();
      volumeHistoryAbortController = null;
    }
    const controller = new AbortController();
    volumeHistoryAbortController = controller;
    try {
      const data = await Api.fetchJson(`${API_BASE}/history?window=${encodeURIComponent(HISTORY_FETCH_WINDOW)}`, {
        signal: controller.signal,
      });
      volumeHistoryRows = data.rows || [];
      volumeHistoryMeta = data.meta || {};
      if (latestData) {
        renderFilteredShare();
      } else {
        renderVolumeHistory();
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('volume-history-meta', '出来高履歴を取得できませんでした。時間をおいて再読み込みしてください。');
    } finally {
      if (volumeHistoryAbortController === controller) {
        volumeHistoryAbortController = null;
      }
    }
  }

  async function loadInsights() {
    const list = $('volume-insights-list');
    if (list) {
      list.innerHTML = '<li class="volume-insight-item volume-insight-item--loading">インサイトを生成中です。</li>';
    }
    if (volumeInsightsAbortController) {
      volumeInsightsAbortController.abort();
      volumeInsightsAbortController = null;
    }
    const controller = new AbortController();
    volumeInsightsAbortController = controller;
    try {
      const params = new URLSearchParams({
        window: INSIGHTS_FETCH_WINDOW,
        periods: '1',
        zscoreWindow: '8',
        maxInsights: '6',
      });
      if (selectedInstrument !== ALL_VALUE) params.set('instrumentId', selectedInstrument);
      if (selectedExchange !== ALL_VALUE) params.set('exchangeId', selectedExchange);
      const data = await Api.fetchJson(`${API_BASE}/insights?${params.toString()}`, {
        signal: controller.signal,
      });
      renderInsights(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setText('volume-insights-meta', 'インサイトを取得できませんでした。');
      if (list) {
        list.innerHTML = '<li class="volume-insight-item volume-insight-item--empty">時間をおいて再読み込みしてください。</li>';
      }
    } finally {
      if (volumeInsightsAbortController === controller) {
        volumeInsightsAbortController = null;
      }
    }
  }

  const shareRefreshTask = pagePoller.createTask({
    intervalMs: SHARE_REFRESH_MS,
    callback: loadShare,
  });

  const volumeHistoryRefreshTask = pagePoller.createTask({
    intervalMs: VOLUME_HISTORY_REFRESH_MS,
    callback: loadVolumeHistory,
  });

  const volumeInsightsRefreshTask = pagePoller.createTask({
    intervalMs: VOLUME_INSIGHTS_REFRESH_MS,
    callback: loadInsights,
  });

  document.querySelectorAll('[data-window]').forEach(button => {
    button.addEventListener('click', () => {
      resetInstrumentPreview();
      activateWindow(button.dataset.window);
    });
  });

  document.querySelectorAll('[data-window-guide]').forEach(button => {
    button.addEventListener('click', () => {
      resetInstrumentPreview();
      activateWindow(button.dataset.windowGuide);
    });
  });

  const instrumentSearch = $('volume-instrument-search');
  if (instrumentSearch) {
    instrumentSearch.value = instrumentSearchTerm;
    instrumentSearch.addEventListener('input', () => {
      instrumentSearchTerm = normalizeSearchTerm(instrumentSearch.value);
      resetInstrumentPreview();
      if (instrumentSearchTerm && selectedInstrument !== ALL_VALUE) {
        selectedInstrument = ALL_VALUE;
        const select = $('volume-instrument-filter');
        if (select) select.value = ALL_VALUE;
      }
      renderFilteredShare();
    });
  }

  const instrumentFilter = $('volume-instrument-filter');
  if (instrumentFilter) {
    instrumentFilter.addEventListener('change', () => {
      selectedInstrument = instrumentFilter.value || ALL_VALUE;
      resetInstrumentPreview();
      if (selectedInstrument !== ALL_VALUE && instrumentSearchTerm) {
        instrumentSearchTerm = '';
        const search = $('volume-instrument-search');
        if (search) search.value = '';
      }
      renderFilteredShare();
      loadInsights();
    });
  }

  const exchangeFilter = $('volume-exchange-filter');
  if (exchangeFilter) {
    exchangeFilter.addEventListener('change', () => {
      selectedExchange = exchangeFilter.value || ALL_VALUE;
      resetInstrumentPreview();
      renderFilteredShare();
      loadInsights();
    });
  }

  const showNoTradeToggle = $('volume-show-no-trade');
  if (showNoTradeToggle) {
    showNoTradeToggle.checked = showZeroVolumeRows;
    showNoTradeToggle.addEventListener('change', () => {
      showZeroVolumeRows = showNoTradeToggle.checked;
      resetInstrumentPreview();
      renderFilteredShare();
    });
  }

  const instrumentMore = $('instrument-share-more');
  if (instrumentMore) {
    instrumentMore.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest('[data-volume-show-all-instruments]');
      if (!button) return;
      showAllInstrumentRows = true;
      renderFilteredShare();
    });
  }

  const instrumentQuickJumps = $('instrument-quick-jumps');
  if (instrumentQuickJumps) {
    instrumentQuickJumps.addEventListener('click', (event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest('[data-volume-jump-instrument]');
      if (!link) return;
      event.preventDefault();
      const instrumentId = link.getAttribute('data-volume-jump-instrument') || '';
      if (scrollToInstrument(instrumentId)) return;
      showAllInstrumentRows = true;
      renderFilteredShare();
      window.requestAnimationFrame(() => scrollToInstrument(instrumentId));
    });
  }

  document.querySelectorAll('[data-volume-history-window]').forEach(button => {
    button.addEventListener('click', () => {
      selectedHistoryWindow = normalizeHistoryWindow(button.dataset.volumeHistoryWindow, '30d');
      syncTabButtons('[data-volume-history-window]', 'volumeHistoryWindow', selectedHistoryWindow);
      renderVolumeHistory();
      writeUrlState();
    });
  });

  syncTabButtons('[data-window]', 'window', selectedWindow);
  syncTabButtons('[data-volume-history-window]', 'volumeHistoryWindow', selectedHistoryWindow);
  hydratePurposeAccountLinks();
  updateWindowGuide();
  writeUrlState();
  initVolumeHistoryCharts();
  loadShare();
  loadVolumeHistory();
  loadInsights();
  shareRefreshTask.start({ immediate: false });
  volumeHistoryRefreshTask.start({ immediate: false });
  volumeInsightsRefreshTask.start({ immediate: false });
  window.addEventListener('beforeunload', () => {
    pagePoller.dispose();
    if (shareAbortController) shareAbortController.abort();
    if (volumeHistoryAbortController) volumeHistoryAbortController.abort();
    if (volumeInsightsAbortController) volumeInsightsAbortController.abort();
  });
});
