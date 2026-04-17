const SALE_CURRENCIES_URL = 'https://www.okcoin.jp/v2/asset/transaction/public/currencies';

class OKJSaleClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || SALE_CURRENCIES_URL;
  }

  async fetchCurrencies() {
    const url = new URL(this.baseUrl);
    url.searchParams.set('checkOnline', 'false');
    url.searchParams.set('dynamicQuotePrecision', 'true');
    url.searchParams.set('instrument', 'vendor');

    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const payload = await res.json();
    if (payload.code !== 0 && payload.error_code !== '0') {
      throw new Error(payload.msg || payload.error_message || `OKJ sale API code ${payload.code}`);
    }

    if (!Array.isArray(payload.data)) {
      throw new Error('Unexpected OKJ sale API response');
    }

    return payload.data;
  }
}

module.exports = OKJSaleClient;
