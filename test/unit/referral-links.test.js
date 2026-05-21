const assert = require('node:assert/strict');
const test = require('node:test');

const { getCampaign } = require('../../lib/campaigns');
const { getExchangePageContent } = require('../../lib/exchange-page-content');

const BITFLYER_REFERRAL_URL = 'https://bitflyer.com/invitation?id=ml1wjtkl&lang=ja-JP';

function withEnvValue(key, value, fn) {
  const previous = process.env[key];
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }

  try {
    fn();
  } finally {
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
}

test('bitFlyer referral link is populated by default', () => {
  withEnvValue('BITFLYER_REFERRAL_URL', undefined, () => {
    assert.equal(getCampaign('bitflyer').affiliateUrl, BITFLYER_REFERRAL_URL);
    assert.equal(getCampaign('bitflyer').referralCode, 'ml1wjtkl');
    assert.equal(getExchangePageContent('bitflyer').referralUrl, BITFLYER_REFERRAL_URL);
    assert.equal(getExchangePageContent('bitflyer').referralCode, 'ml1wjtkl');
  });
});

test('bitFlyer referral link can still be overridden through env', () => {
  const overrideUrl = 'https://example.com/bitflyer-referral';

  withEnvValue('BITFLYER_REFERRAL_URL', overrideUrl, () => {
    assert.equal(getCampaign('bitflyer').affiliateUrl, overrideUrl);
    assert.equal(getExchangePageContent('bitflyer').referralUrl, overrideUrl);
  });
});
