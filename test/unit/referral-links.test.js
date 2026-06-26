const assert = require('node:assert/strict');
const test = require('node:test');

const { getCampaign } = require('../../lib/campaigns');
const { getExchangePageContent } = require('../../lib/exchange-page-content');

const BITFLYER_REFERRAL_URL = 'https://bitflyer.com/invitation?id=ml1wjtkl&lang=ja-JP';
const OKJ_REFERRAL_URL = 'https://www.okcoin.jp/account/join?invitation=C250678&type=0';
const BINANCE_JAPAN_REFERRAL_URL = 'https://s.binance.com/OKkHnAGC?ref=GRO_55250_0VBAH';
const BITTRADE_REFERRAL_URL = 'https://www.bittrade.co.jp/ja-jp/register/?invite_code=tHc3p';
const GMO_COIN_AFFILIATE_URL = 'https://h.accesstrade.net/sp/cc?rk=0100mtgp00osx0';
const GMO_COIN_TRACKING_PIXEL_URL = 'https://h.accesstrade.net/sp/rr?rk=0100mtgp00osx0';
const COINCHECK_AFFILIATE_URL = 'https://h.accesstrade.net/sp/cc?rk=0100nerr00osx0';
const COINCHECK_TRACKING_PIXEL_URL = 'https://h.accesstrade.net/sp/rr?rk=0100nerr00osx0';

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

test('provided referral links are populated by default', () => {
  [
    {
      envKey: 'OKJ_REFERRAL_URL',
      campaignSlug: 'okj',
      exchangeId: 'okj',
      url: OKJ_REFERRAL_URL,
      code: 'C250678',
    },
    {
      envKey: 'BINANCE_JAPAN_REFERRAL_URL',
      campaignSlug: 'binance-japan',
      exchangeId: 'binance-japan',
      url: BINANCE_JAPAN_REFERRAL_URL,
      code: 'GRO_55250_0VBAH',
    },
    {
      envKey: 'BITTRADE_REFERRAL_URL',
      campaignSlug: 'bittrade',
      exchangeId: 'bittrade',
      url: BITTRADE_REFERRAL_URL,
      code: 'tHc3p',
    },
  ].forEach(({ envKey, campaignSlug, exchangeId, url, code }) => {
    withEnvValue(envKey, undefined, () => {
      assert.equal(getCampaign(campaignSlug).affiliateUrl, url);
      assert.equal(getCampaign(campaignSlug).referralCode, code);
      assert.equal(getExchangePageContent(exchangeId).referralUrl, url);
      assert.equal(getExchangePageContent(exchangeId).referralCode, code);
    });
  });
});

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
    const exchangeContent = getExchangePageContent('gmo');
    assert.equal(campaign.affiliateUrl, GMO_COIN_AFFILIATE_URL);
    assert.equal(campaign.trackingPixelUrl, GMO_COIN_TRACKING_PIXEL_URL);
    assert.equal(campaign.affiliateRel, 'nofollow');
    assert.equal(campaign.affiliateReferrerPolicy, 'no-referrer-when-downgrade');
    assert.equal(campaign.affiliateTarget, null);
    assert.equal(exchangeContent.referralUrl, GMO_COIN_AFFILIATE_URL);
    assert.equal(exchangeContent.referralRel, 'nofollow');
    assert.equal(exchangeContent.referralReferrerPolicy, 'no-referrer-when-downgrade');
    assert.equal(exchangeContent.referralTarget, null);
    assert.equal(exchangeContent.referralTrackingPixelUrl, GMO_COIN_TRACKING_PIXEL_URL);
  });
});

test('Coincheck affiliate link is populated by default', () => {
  withEnvValue('COINCHECK_REFERRAL_URL', undefined, () => {
    const campaign = getCampaign('coincheck');
    const exchangeContent = getExchangePageContent('coincheck');
    assert.equal(campaign.affiliateUrl, COINCHECK_AFFILIATE_URL);
    assert.equal(campaign.trackingPixelUrl, COINCHECK_TRACKING_PIXEL_URL);
    assert.equal(campaign.affiliateRel, 'nofollow');
    assert.equal(campaign.affiliateReferrerPolicy, 'no-referrer-when-downgrade');
    assert.equal(campaign.affiliateTarget, null);
    assert.equal(exchangeContent.referralUrl, COINCHECK_AFFILIATE_URL);
    assert.equal(exchangeContent.referralRel, 'nofollow');
    assert.equal(exchangeContent.referralReferrerPolicy, 'no-referrer-when-downgrade');
    assert.equal(exchangeContent.referralTarget, null);
    assert.equal(exchangeContent.referralTrackingPixelUrl, COINCHECK_TRACKING_PIXEL_URL);
  });
});
