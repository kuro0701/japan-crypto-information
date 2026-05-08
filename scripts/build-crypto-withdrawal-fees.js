#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { getExchange } = require('../lib/exchanges');

const ROOT_DIR = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'public', 'data', 'crypto-withdrawal-fees.json');

const sources = {
  okj: {
    label: 'OKJ',
    url: 'https://www.okcoin.jp/pages/products/deposit-withdraw.html',
    dataUrl: 'https://www.okcoin.jp/v2/asset/introduction/withdrawRules',
  },
  coincheck: {
    label: 'Coincheck',
    url: 'https://coincheck.com/ja/info/fee',
  },
  bitflyer: {
    label: 'bitFlyer',
    url: 'https://bitflyer.com/ja-jp/s/commission',
  },
  bitbank: {
    label: 'bitbank',
    url: 'https://bitbank.cc/guide/fee',
  },
  gmo: {
    label: 'GMOコイン',
    url: 'https://coin.z.com/jp/corp/guide/deposit-withdrawal/',
    dataUrl: 'https://api.coin.z.com/public/v1/symbols',
  },
  'binance-japan': {
    label: 'Binance Japan',
    url: 'https://www.binance.com/ja/fee/cryptoFee',
    dataUrl: 'https://www.binance.com/bapi/capital/v2/public/capital/getNetworkCoinAll?includeEtf=true&lang=ja',
  },
  bittrade: {
    label: 'BitTrade',
    url: 'https://www.bittrade.co.jp/ja-jp/support/fee/',
    dataUrl: 'https://www.bittrade.co.jp/-/j/open/v1/trade_rule/currency/info',
  },
};

const exchangeOrder = ['okj', 'coincheck', 'bitflyer', 'bitbank', 'gmo', 'binance-japan', 'bittrade'];
const assetPriority = ['BTC', 'ETH', 'XRP', 'SOL', 'ADA', 'DOGE', 'BNB', 'BCH', 'LTC', 'XLM', 'DOT', 'LINK', 'DAI', 'SHIB', 'PEPE'];
const assetAliases = {
  BCC: 'BCH',
};

const bitflyerSymbolByName = {
  'ビットコイン': 'BTC',
  'イーサ（イーサリアム）': 'ETH',
  'イーサ（イーサリアム・クラシック）': 'ETC',
  'ライトコイン': 'LTC',
  'ビットコインキャッシュ': 'BCH',
  'モナコイン': 'MONA',
  'リスク': 'LSK',
  'エックスアールピー（XRP）': 'XRP',
  'ベーシックアテンショントークン': 'BAT',
  'ステラルーメン': 'XLM',
  'ネム': 'XEM',
  'テゾス': 'XTZ',
  'ポルカドット': 'DOT',
  'チェーンリンク': 'LINK',
  'シンボル': 'XYM',
  'ポリゴン': 'MATIC',
  'メイカー': 'MKR',
  'フレア': 'FLR',
  'シバイヌ': 'SHIB',
  'パレットトークン': 'PLT',
  'ザ・サンドボックス': 'SAND',
  'エルフトークン': 'ELF',
  'レンダートークン': 'RNDR',
  'ポリゴンエコシステムトークン': 'POL',
  'ペペ': 'PEPE',
};

const coincheckVariableAssets = new Set([
  'BTC',
  'ETH',
  'LSK',
  'SAND',
  'FNCT',
  'CHZ',
  'LINK',
  'DAI',
  'APE',
  'AXS',
  'IMX',
  'WBTC',
  'SHIB',
  'GRT',
  'MANA',
  'MASK',
  'PEPE',
]);

function decodeHtml(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripTags(value) {
  return decodeHtml(String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRows(tableHtml) {
  const rows = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRe.exec(tableHtml))) {
    const cells = [];
    const cellRe = /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let cellMatch;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      cells.push(stripTags(cellMatch[2]));
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function normalizeAsset(value) {
  const raw = String(value || '').trim().toUpperCase();
  return assetAliases[raw] || raw;
}

function compactFeeText(value, currency) {
  const text = String(value == null ? '' : value).replace(/,/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (/無料/.test(text)) return '無料';
  const unit = currency ? String(currency).toUpperCase() : '';
  return text
    .replace(/([0-9])([A-Z])/g, '$1 $2')
    .replace(new RegExp(`\\s*${unit}$`, 'i'), unit ? ` ${unit}` : '')
    .trim();
}

function numericAmount(value) {
  const text = String(value == null ? '' : value).replace(/,/g, '');
  if (/無料/.test(text)) return 0;
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) ? amount : null;
}

function feeRangeText(min, max, currency) {
  const unit = String(currency || '').toUpperCase();
  const minText = String(min == null ? '' : min).trim();
  const maxText = String(max == null ? '' : max).trim();
  if (minText === '0' && maxText === '0') return '無料';
  if (minText && maxText && minText !== maxText) return `${minText}〜${maxText} ${unit}`.trim();
  return `${minText || maxText} ${unit}`.trim();
}

function addEntry(rows, exchangeId, currency, network, feeText, options = {}) {
  const officialCurrency = String(currency || '').trim().toUpperCase();
  if (!officialCurrency || officialCurrency === 'JPY') return;
  const asset = normalizeAsset(officialCurrency);
  const normalizedFee = compactFeeText(feeText, officialCurrency);
  const feeMin = options.feeMin != null ? Number(options.feeMin) : numericAmount(normalizedFee);
  const feeMax = options.feeMax != null ? Number(options.feeMax) : feeMin;
  rows.push({
    asset,
    currency: officialCurrency,
    exchangeId,
    exchange: sources[exchangeId].label,
    network: String(network || '公式表').trim(),
    fee: normalizedFee,
    feeMin: Number.isFinite(feeMin) ? feeMin : null,
    feeMax: Number.isFinite(feeMax) ? feeMax : null,
    minWithdrawal: options.minWithdrawal == null ? null : String(options.minWithdrawal),
    maxWithdrawal: options.maxWithdrawal == null ? null : String(options.maxWithdrawal),
    note: options.note || '',
    sourceId: exchangeId,
  });
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 crypto-withdrawal-fee-builder',
      accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

async function fetchJson(url) {
  return JSON.parse(await fetchText(url));
}

async function buildOkj(rows) {
  const payload = await fetchJson(sources.okj.dataUrl);
  for (const item of payload.data || []) {
    addEntry(
      rows,
      'okj',
      item.currency,
      item.network,
      feeRangeText(item.withdraw_fee_min, item.withdraw_fee_max, item.currency),
      {
        feeMin: item.withdraw_fee_min,
        feeMax: item.withdraw_fee_max,
        minWithdrawal: item.withdraw_min_size,
        maxWithdrawal: item.withdraw_max_size,
        note: '範囲内で設定',
      }
    );
  }
}

async function buildCoincheck(rows) {
  const html = await fetchText(sources.coincheck.url);
  const headingIndex = html.indexOf('暗号資産/送金手数料');
  const tableStart = html.indexOf('<table', headingIndex);
  const tableEnd = html.indexOf('</table>', tableStart);
  const table = html.slice(tableStart, tableEnd + '</table>'.length);
  for (const cells of parseRows(table)) {
    if (cells.length < 2) continue;
    const currency = cells[0].trim().toUpperCase();
    const note = coincheckVariableAssets.has(currency) ? '変動手数料制の対象' : '';
    addEntry(rows, 'coincheck', currency, '公式表', cells[1], { note });
  }
}

async function buildBitflyer(rows) {
  const html = await fetchText(sources.bitflyer.url);
  const headingIndex = html.indexOf('各暗号資産（仮想通貨）の送付手数料・最小送付数量');
  const tableStart = html.indexOf('<table', headingIndex);
  const tableEnd = html.indexOf('</table>', tableStart);
  const table = html.slice(tableStart, tableEnd + '</table>'.length);
  for (const cells of parseRows(table)) {
    if (cells.length < 2) continue;
    const name = cells[0].trim();
    const symbol = bitflyerSymbolByName[name] || (cells[1].match(/\b([A-Z][A-Z0-9]{1,6})\b/) || [])[1];
    if (!symbol) continue;
    const minMatch = cells[1].replace(/,/g, '').match(/最小送付数量(?:は|：|:)?、?\s*([0-9]+(?:\.[0-9]+)?)\s*([A-Z0-9]+)/);
    const feeText = cells[1].replace(/（※[\s\S]*$/, '').trim();
    addEntry(rows, 'bitflyer', symbol, '公式表', feeText, {
      minWithdrawal: minMatch ? minMatch[1] : null,
    });
  }
}

async function buildBitbank(rows) {
  const html = await fetchText(sources.bitbank.url);
  const metaMatch = html.match(/<meta name="description" content="([\s\S]*?)"\s*\/?>/i);
  if (!metaMatch) throw new Error('bitbank fee meta description was not found');
  const content = decodeHtml(metaMatch[1]);
  const headingIndex = content.indexOf('入出金手数料');
  const tableStart = content.indexOf('<table', headingIndex);
  const tableEnd = content.indexOf('</table>', tableStart);
  const table = content.slice(tableStart, tableEnd + '</table>'.length);
  let currentCurrency = '';
  for (const cells of parseRows(table)) {
    if (cells.length < 3 || cells[0] === 'ネットワーク') continue;
    if (cells[0] === '日本円') continue;
    const firstSymbol = (cells[0].match(/^([A-Za-z0-9]+)\s*[（(]/) || [])[1];
    if (firstSymbol) {
      currentCurrency = firstSymbol.toUpperCase() === 'MASK' ? 'MASK' : firstSymbol.toUpperCase();
    }
    if (!currentCurrency) continue;
    const hasCurrency = Boolean(firstSymbol);
    const network = hasCurrency ? cells[1] : cells[0];
    const fee = hasCurrency ? cells[3] : cells[2];
    if (!fee) continue;
    addEntry(rows, 'bitbank', currentCurrency, network, fee);
  }
}

async function buildGmo(rows) {
  const payload = await fetchJson(sources.gmo.dataUrl);
  for (const item of payload.data || []) {
    const symbol = String(item.symbol || '').trim().toUpperCase();
    if (!symbol || symbol.includes('_')) continue;
    addEntry(rows, 'gmo', symbol, '公式表', '無料', {
      note: '送付手数料無料',
    });
  }
}

async function buildBinanceJapan(rows) {
  const supported = new Set(
    ((getExchange('binance-japan') || {}).markets || [])
      .map(market => String(market.baseCurrency || '').toUpperCase())
      .filter(Boolean)
  );
  const payload = await fetchJson(sources['binance-japan'].dataUrl);
  for (const coin of payload.data || []) {
    const currency = String(coin.coin || '').toUpperCase();
    if (!supported.has(currency)) continue;
    for (const network of coin.networkList || []) {
      if (!network.withdrawEnable) continue;
      addEntry(
        rows,
        'binance-japan',
        currency,
        network.name || network.networkDisplay || network.network,
        `${network.withdrawFee} ${currency}`,
        {
          feeMin: network.withdrawFee,
          feeMax: network.withdrawFee,
          minWithdrawal: network.withdrawMin,
          note: network.busy ? '混雑表示あり' : '',
        }
      );
    }
  }
}

async function buildBittrade(rows) {
  const payload = await fetchJson(sources.bittrade.dataUrl);
  for (const item of payload.data || []) {
    const currency = String(item.currency || '').toUpperCase();
    if (currency === 'JPY') continue;
    addEntry(rows, 'bittrade', currency, '公式表', `${item.withdraw_fee} ${currency}`, {
      feeMin: item.withdraw_fee,
      feeMax: item.withdraw_fee,
      minWithdrawal: item.min_withdraw_amt,
      maxWithdrawal: item.max_withdraw_amt,
    });
  }
}

function compareAssets(a, b) {
  const ai = assetPriority.indexOf(a);
  const bi = assetPriority.indexOf(b);
  if (ai !== -1 || bi !== -1) {
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  }
  return a.localeCompare(b, 'en');
}

function sortRows(rows) {
  return rows.sort((a, b) => {
    const assetDiff = compareAssets(a.asset, b.asset);
    if (assetDiff !== 0) return assetDiff;
    const exchangeDiff = exchangeOrder.indexOf(a.exchangeId) - exchangeOrder.indexOf(b.exchangeId);
    if (exchangeDiff !== 0) return exchangeDiff;
    const feeA = a.feeMin == null ? Number.POSITIVE_INFINITY : a.feeMin;
    const feeB = b.feeMin == null ? Number.POSITIVE_INFINITY : b.feeMin;
    if (feeA !== feeB) return feeA - feeB;
    return String(a.network).localeCompare(String(b.network), 'ja');
  });
}

function summarizeAssets(rows) {
  return Array.from(new Set(rows.map(row => row.asset))).sort(compareAssets);
}

async function main() {
  const rows = [];
  await buildOkj(rows);
  await buildCoincheck(rows);
  await buildBitflyer(rows);
  await buildBitbank(rows);
  await buildGmo(rows);
  await buildBinanceJapan(rows);
  await buildBittrade(rows);

  const normalizedRows = sortRows(rows);
  const output = {
    generatedAt: new Date().toISOString(),
    checkedDate: new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
    exchanges: exchangeOrder.map(id => ({
      id,
      label: sources[id].label,
      sourceUrl: sources[id].url,
    })),
    assets: summarizeAssets(normalizedRows),
    rows: normalizedRows,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`${output.assets.length} assets, ${output.rows.length} fee rows`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
