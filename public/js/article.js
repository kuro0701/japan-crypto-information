(() => {
  const THEME_STORAGE_KEY = 'okj.theme.v1';
  const ARTICLE_TERM_SELECTOR = '.article-term[data-term-key]';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const JPY_WITHDRAWAL_FEE_ROWS = [
    {
      id: 'gmo',
      name: 'GMOコイン',
      abbr: 'GMO',
      color: '#35e0a5',
      sourceLabel: 'GMOコイン 入出金',
      sourceUrl: 'https://coin.z.com/jp/corp/guide/deposit-withdrawal/',
      note: '通常出金は無料、大口出金は400円。',
      calculate(amount) {
        const fee = amount >= 30000001 ? 400 : 0;
        return {
          fee,
          feeLabel: fee === 0 ? '無料' : '400円',
          condition: fee === 0 ? '通常出金' : '大口出金: 30,000,001円/回以上',
          note: amount > 100000000 ? '1日上限などは公式画面で確認' : '大口出金は手数料返戻なしの注意あり',
        };
      },
    },
    {
      id: 'binance',
      name: 'Binance Japan',
      abbr: 'BN',
      color: '#f0b90b',
      sourceLabel: 'PayPay 発表',
      sourceUrl: 'https://about.paypay.ne.jp/pr/20260409/01/',
      note: 'PayPayマネー連携の出金手数料。',
      calculate(amount) {
        if (amount > 0 && amount < 1000) {
          return {
            fee: 110,
            feeLabel: '110円',
            condition: 'PayPayマネー連携',
            note: '出金下限 1,000円未満',
            eligible: false,
          };
        }
        if (amount > 1000000) {
          return {
            fee: 110,
            feeLabel: '110円',
            condition: 'PayPayマネー連携',
            note: '24時間上限 100万円超は公式確認',
            eligible: false,
          };
        }
        return {
          fee: 110,
          feeLabel: '110円',
          condition: 'PayPayマネー連携',
          note: '下限1,000円、24時間上限100万円',
        };
      },
    },
    {
      id: 'bitflyer',
      name: 'bitFlyer',
      abbr: 'BF',
      color: '#2f7df6',
      sourceLabel: 'bitFlyer 手数料',
      sourceUrl: 'https://bitflyer.com/ja-jp/s/commission',
      note: '三井住友銀行宛かどうかで変わります。',
      calculate(amount, bankMode) {
        const isSmbc = bankMode === 'smbc';
        const fee = amount < 30000
          ? (isSmbc ? 220 : 550)
          : (isSmbc ? 440 : 770);
        return {
          fee,
          feeLabel: `${fee.toLocaleString('ja-JP')}円`,
          condition: isSmbc ? '三井住友銀行宛' : '三井住友銀行以外',
          note: amount < 30000 ? '3万円未満' : '3万円以上',
        };
      },
    },
    {
      id: 'okj',
      name: 'OKJ',
      abbr: 'OKJ',
      color: '#25d366',
      sourceLabel: 'OKJ 手数料一覧',
      sourceUrl: 'https://www.okcoin.jp/pages/products/fees.html',
      note: '100万円、1,000万円で区分が変わります。',
      calculate(amount) {
        const fee = amount < 1000000 ? 400 : amount < 10000000 ? 770 : 1320;
        return {
          fee,
          feeLabel: `${fee.toLocaleString('ja-JP')}円`,
          condition: '出金額で変動',
          note: amount < 1000000 ? '100万円未満' : amount < 10000000 ? '100万円以上1,000万円未満' : '1,000万円以上',
        };
      },
    },
    {
      id: 'coincheck',
      name: 'Coincheck',
      abbr: 'CC',
      color: '#00d9b1',
      sourceLabel: 'Coincheck 手数料',
      sourceUrl: 'https://coincheck.com/ja/info/fee',
      note: '日本円出金は一律407円。',
      calculate() {
        return {
          fee: 407,
          feeLabel: '407円',
          condition: '一律',
          note: '金額による分岐なし',
        };
      },
    },
    {
      id: 'bitbank',
      name: 'bitbank',
      abbr: 'BB',
      color: '#e63b3f',
      sourceLabel: 'bitbank サポート',
      sourceUrl: 'https://support.bitbank.cc/hc/ja/articles/900000034263-%E6%97%A5%E6%9C%AC%E5%86%86%E3%81%AE%E5%87%BA%E9%87%91%E6%89%8B%E6%95%B0%E6%96%99%E3%81%AF%E3%81%84%E3%81%8F%E3%82%89%E3%81%A7%E3%81%99%E3%81%8B',
      note: '3万円を境に手数料が変わります。',
      calculate(amount) {
        const fee = amount < 30000 ? 550 : 770;
        return {
          fee,
          feeLabel: `${fee.toLocaleString('ja-JP')}円`,
          condition: '出金額で変動',
          note: amount < 30000 ? '3万円未満' : '3万円以上',
        };
      },
    },
    {
      id: 'bittrade',
      name: 'BitTrade',
      abbr: 'BT',
      color: '#3f78ff',
      sourceLabel: 'BitTrade 手数料',
      sourceUrl: 'https://www.bittrade.co.jp/ja-jp/support/fee/',
      note: '公式手数料表は日本円出金を「--」表示。',
      calculate() {
        return {
          fee: null,
          feeLabel: '公式確認',
          condition: '公式表は「--」表示',
          note: '出金画面で最終確認',
          eligible: false,
        };
      },
    },
  ];

  function readStoredTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch (_) {
      return document.documentElement.classList.contains('theme-light') ? 'light' : 'dark';
    }
  }

  function writeStoredTheme(theme) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (_) {
      // noop
    }
  }

  function syncTheme(theme) {
    const isLight = theme === 'light';
    document.documentElement.classList.toggle('theme-light', isLight);
    document.body.classList.toggle('theme-light', isLight);

    $$('[data-theme-toggle]').forEach((button) => {
      const icon = $('[data-theme-toggle-icon]', button);
      const label = $('[data-theme-toggle-label]', button);
      button.classList.toggle('is-light', isLight);
      button.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      button.setAttribute('aria-label', isLight ? 'ダークモードに切り替え' : 'ライトモードに切り替え');
      if (icon) icon.textContent = isLight ? '☾' : '☀';
      if (label) label.textContent = isLight ? 'ダーク' : 'ライト';
    });
  }

  function initThemeToggle() {
    let currentTheme = readStoredTheme();
    syncTheme(currentTheme);

    document.addEventListener('click', (event) => {
      const button = event.target && event.target.closest ? event.target.closest('[data-theme-toggle]') : null;
      if (!button) return;
      event.preventDefault();
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      writeStoredTheme(currentTheme);
      syncTheme(currentTheme);
    });
  }

  function slugify(value, index) {
    const slug = String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
      .replace(/^-+|-+$/g, '');
    return slug || `section-${index + 1}`;
  }

  function buildTocLinks(headings) {
    return headings.map((heading) => (
      `<a class="article-toc__link" href="#${heading.id}" data-article-toc-link="${heading.id}">${heading.textContent.trim()}</a>`
    )).join('');
  }

  function initToc() {
    const body = $('.article-body');
    const toc = $('[data-article-toc]');
    const tocList = $('[data-article-toc-list]');
    const mobileToc = $('[data-article-mobile-toc]');
    const mobileTocList = $('[data-article-mobile-toc-list]');
    if (!body || !toc || !tocList) return;

    const headings = $$('h2', body).filter((heading) => heading.textContent.trim());
    if (headings.length < 2) return;

    const usedIds = new Set();
    headings.forEach((heading, index) => {
      const baseId = heading.id || slugify(heading.textContent, index);
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id) || document.getElementById(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      heading.id = id;
      heading.tabIndex = -1;
    });

    const linksHtml = buildTocLinks(headings);
    tocList.innerHTML = linksHtml;
    toc.hidden = false;
    if (mobileToc && mobileTocList) {
      mobileTocList.innerHTML = linksHtml;
      mobileToc.hidden = false;
    }

    const links = $$('[data-article-toc-link]');
    const setActive = (id) => {
      links.forEach((link) => {
        const active = link.dataset.articleTocLink === id;
        link.classList.toggle('is-active', active);
        if (active) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    };

    setActive(headings[0].id);
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible && visible.target && visible.target.id) {
        setActive(visible.target.id);
      }
    }, {
      rootMargin: '-24% 0px -64% 0px',
      threshold: [0, 1],
    });

    headings.forEach(heading => observer.observe(heading));
  }

  function initReadingProgress() {
    const bar = $('[data-reading-progress]');
    const article = $('.article-main');
    if (!bar || !article) return;

    const update = () => {
      const rect = article.getBoundingClientRect();
      const start = window.scrollY + rect.top;
      const end = start + article.offsetHeight - window.innerHeight;
      const progress = end <= start ? 1 : (window.scrollY - start) / (end - start);
      const clamped = Math.max(0, Math.min(1, progress));
      bar.style.transform = `scaleX(${clamped})`;
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  function formatJpy(value) {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(Math.round(Number(value) || 0));
  }

  function formatJpyNumber(value) {
    return `${new Intl.NumberFormat('ja-JP').format(Math.max(0, Math.round(Number(value) || 0)))}円`;
  }

  function parseJpyAmount(value) {
    const digits = String(value || '').replace(/[^\d]/g, '');
    return digits ? Number(digits) : 0;
  }

  function comparisonRankValue(result) {
    if (!result || result.eligible === false || !Number.isFinite(result.fee)) return Number.POSITIVE_INFINITY;
    return result.fee;
  }

  function renderFeeBadge(result) {
    const label = result && result.feeLabel ? result.feeLabel : '公式確認';
    const isFree = Number(result && result.fee) === 0 && result.eligible !== false;
    const isUnknown = !Number.isFinite(result && result.fee) || result.eligible === false;
    const className = [
      'jpy-fee-badge',
      isFree ? 'is-free' : '',
      isUnknown ? 'is-unknown' : '',
      !isFree && !isUnknown && Number(result && result.fee) <= 220 ? 'is-low' : '',
    ].filter(Boolean).join(' ');
    return `<span class="${className}">${escapeHtml(label)}</span>`;
  }

  function resultStatusLabel(result) {
    if (!result) return '公式確認';
    if (!Number.isFinite(result.fee)) return '公式確認';
    if (result.eligible === false) return '条件確認';
    return '計算対象';
  }

  function renderJpyWithdrawalRows(items, amount) {
    let rank = 0;
    return items.map((item) => {
      const comparable = comparisonRankValue(item.result) < Number.POSITIVE_INFINITY;
      const rowRank = comparable ? String(rank += 1) : '要確認';
      const received = comparable ? formatJpyNumber(Math.max(0, amount - item.result.fee)) : '公式画面で確認';
      const rowClass = [
        comparable && rank === 1 ? 'is-best' : '',
        !comparable ? 'is-muted' : '',
      ].filter(Boolean).join(' ');
      return `
        <tr class="${rowClass}" style="--exchange-color: ${escapeHtml(item.color)}">
          <td data-label="順位"><span class="jpy-rank">${escapeHtml(rowRank)}</span></td>
          <td data-label="取引所">
            <span class="jpy-exchange">
              <span class="jpy-exchange-mark" aria-hidden="true">${escapeHtml(item.abbr)}</span>
              <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(resultStatusLabel(item.result))}</small></span>
            </span>
          </td>
          <td data-label="手数料">
            ${renderFeeBadge(item.result)}
            <small class="jpy-table-note">${escapeHtml(item.result.note || item.note || '')}</small>
          </td>
          <td data-label="受取目安">${escapeHtml(received)}</td>
          <td data-label="条件">
            <strong>${escapeHtml(item.result.condition || '')}</strong>
            <small class="jpy-table-note">${escapeHtml(item.note || '')}</small>
          </td>
          <td data-label="公式確認先">
            <a class="jpy-source-button" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(item.sourceLabel)} ↗</a>
          </td>
        </tr>
      `;
    }).join('');
  }

  function initJpyWithdrawalTool() {
    const root = $('[data-jpy-withdrawal-tool]');
    if (!root) return;

    const amountInput = $('[data-jpy-withdrawal-amount]', root);
    const bankButtons = $$('[data-jpy-withdrawal-bank]', root);
    const body = $('[data-jpy-withdrawal-body]', root);
    const summary = $('[data-jpy-withdrawal-summary]', root);
    let bankMode = bankButtons.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.jpyWithdrawalBank || 'smbc';

    const setBankMode = (nextMode) => {
      bankMode = nextMode === 'other' ? 'other' : 'smbc';
      bankButtons.forEach((button) => {
        const active = button.dataset.jpyWithdrawalBank === bankMode;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };

    const update = () => {
      const amount = parseJpyAmount(amountInput && amountInput.value);
      const items = JPY_WITHDRAWAL_FEE_ROWS
        .map(row => ({
          ...row,
          result: row.calculate(amount, bankMode),
        }))
        .sort((a, b) => {
          const rankDiff = comparisonRankValue(a.result) - comparisonRankValue(b.result);
          if (rankDiff !== 0) return rankDiff;
          return a.name.localeCompare(b.name, 'ja');
        });

      if (body) body.innerHTML = renderJpyWithdrawalRows(items, amount);

      const best = items.find(item => comparisonRankValue(item.result) < Number.POSITIVE_INFINITY);
      const runnerUp = items.find(item => item !== best && comparisonRankValue(item.result) < Number.POSITIVE_INFINITY);
      if (summary && best) {
        const diff = runnerUp ? Math.max(0, runnerUp.result.fee - best.result.fee) : 0;
        const bankLabel = bankMode === 'smbc' ? '三井住友銀行宛' : '三井住友銀行以外';
        summary.innerHTML = `
          <span>${escapeHtml(formatJpyNumber(amount || 0))}・${escapeHtml(bankLabel)}の場合</span>
          <strong>${escapeHtml(best.name)} が ${escapeHtml(best.result.feeLabel)}で最安</strong>
          <small>${runnerUp ? `次点との差は ${escapeHtml(formatJpyNumber(diff))} です。` : '公式確認が必要な取引所もあります。'}</small>
        `;
      }
    };

    setBankMode(bankMode);
    bankButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setBankMode(button.dataset.jpyWithdrawalBank);
        update();
      });
    });
    if (amountInput) {
      amountInput.addEventListener('input', update);
      amountInput.addEventListener('blur', () => {
        const amount = parseJpyAmount(amountInput.value);
        amountInput.value = new Intl.NumberFormat('ja-JP').format(amount);
        update();
      });
    }
    update();
  }

  function initMiniSimulator() {
    const root = $('[data-fee-mini-sim]');
    if (!root) return;
    const amountInput = $('[data-fee-sim-amount]', root);
    const modeButtons = $$('[data-fee-sim-mode]', root);
    const label = $('[data-fee-sim-label]', root);
    const total = $('[data-fee-sim-total]', root);
    const note = $('[data-fee-sim-note]', root);
    const link = $('.fee-mini-sim__link', root);
    let mode = 'broker';

    const assumptions = {
      broker: {
        label: '販売所の概算',
        rate: 0.015,
        note: 'スプレッド目安 1.5% として試算',
      },
      exchange: {
        label: '取引所の概算',
        rate: 0.0017,
        note: 'taker 手数料 0.12% + スリッページ目安 0.05% として試算',
      },
    };

    const update = () => {
      const amount = Math.max(0, Number(amountInput && amountInput.value) || 0);
      const preset = assumptions[mode] || assumptions.broker;
      const cost = amount * preset.rate;
      if (label) label.textContent = preset.label;
      if (total) total.textContent = `約 ${formatJpy(cost).replace(/[￥¥]/g, '')}円`;
      if (note) note.textContent = preset.note;
      if (link) {
        const params = new URLSearchParams({
          market: 'BTC-JPY',
          side: 'buy',
          amountType: 'jpy',
          amount: String(Math.max(1000, Math.round(amount || 100000))),
        });
        link.href = `/simulator?${params.toString()}`;
      }
    };

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        mode = button.dataset.feeSimMode || 'broker';
        modeButtons.forEach(item => item.classList.toggle('is-active', item === button));
        update();
      });
    });

    if (amountInput) amountInput.addEventListener('input', update);
    update();
  }

  function syncArticleTerms(enabled) {
    $$(ARTICLE_TERM_SELECTOR).forEach((term) => {
      term.tabIndex = enabled ? 0 : -1;
      term.setAttribute('role', enabled ? 'button' : 'text');
      term.setAttribute('aria-disabled', enabled ? 'false' : 'true');
    });
  }

  function initArticleTerms() {
    const enabled = Boolean(window.BeginnerMode && window.BeginnerMode.isEnabled && window.BeginnerMode.isEnabled());
    syncArticleTerms(enabled);
    window.addEventListener('okj:beginner-mode-change', (event) => {
      syncArticleTerms(Boolean(event.detail && event.detail.enabled));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initToc();
    initReadingProgress();
    initMiniSimulator();
    initJpyWithdrawalTool();
    initArticleTerms();
  });
})();
