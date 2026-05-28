const assert = require('node:assert/strict');
const test = require('node:test');

const { getCampaign } = require('../../lib/campaigns');
const { getExchangePageContent } = require('../../lib/exchange-page-content');

const BITFLYER_REFERRAL_URL = 'https://bitflyer.com/invitation?id=ml1wjtkl&lang=ja-JP';
const GMO_COIN_AFFILIATE_URL = 'https://h.accesstrade.net/sp/cc?rk=0100mtgp00osx0';
const GMO_COIN_TRACKING_PIXEL_URL = 'https://h.accesstrade.net/sp/rr?rk=0100mtgp00osx0';

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
    assert.equal(getCampaign('bitflyer').inviteeBenefit, '1,500円分のビットコイン');
    assert.equal(getCampaign('bitflyer').referrerBenefit, '1,500円分のビットコイン');
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

test('GMO Coin affiliate link is populated by default', () => {
  withEnvValue('GMO_COIN_REFERRAL_URL', undefined, () => {
    const campaign = getCampaign('gmo-coin');
    assert.equal(campaign.affiliateUrl, GMO_COIN_AFFILIATE_URL);
    assert.equal(campaign.trackingPixelUrl, GMO_COIN_TRACKING_PIXEL_URL);
    assert.equal(campaign.affiliateRel, 'nofollow');
    assert.equal(campaign.affiliateReferrerPolicy, 'no-referrer-when-downgrade');
    assert.equal(campaign.affiliateTarget, null);
    assert.equal(getExchangePageContent('gmo').referralUrl, GMO_COIN_AFFILIATE_URL);
  });
});
