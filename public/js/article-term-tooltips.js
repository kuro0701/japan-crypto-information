(() => {
  const DEFINITIONS = {
    daml: {
      title: 'Daml',
      body: '複数組織の契約当事者、権利、義務、承認手順を記述するスマートコントラクト言語です。Cantonでは、誰がどのデータを見て操作できるかも契約モデルに組み込みます。',
    },
    validator: {
      title: 'Validator',
      body: '自らがホストする当事者に関係する取引を受け取り、署名、権限、入力状態、Daml契約の整合性を検証するノードです。',
    },
    'global-synchronizer': {
      title: 'Global Synchronizer',
      body: '関係するValidator間で暗号化メッセージの順序とタイミングを調整し、複数アプリにまたがる取引をまとめて成立または不成立にする共有同期基盤です。',
    },
    bft: {
      title: 'BFT（ビザンチン障害耐性）',
      body: '一部の参加ノードが停止したり不正な応答を返したりしても、所定のしきい値を満たす正常な参加者で合意を継続するための設計です。',
    },
    'burn-mint': {
      title: 'Burn-Mint Equilibrium',
      body: '利用料としてCCを焼却し、アプリケーションやインフラの貢献に応じて別途CCをミントする仕組みです。価格を一定に保つペッグではありません。',
    },
  };

  let tooltip = null;
  let activeTerm = null;
  let pinned = false;

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function termFromEvent(event) {
    const target = event.target && event.target.closest ? event.target : null;
    const term = target ? target.closest('.article-term[data-term-key]') : null;
    return term && DEFINITIONS[term.dataset.termKey] ? term : null;
  }

  function ensureTooltip() {
    if (tooltip) return tooltip;
    tooltip = document.createElement('div');
    tooltip.className = 'term-tooltip article-term-tooltip';
    tooltip.hidden = true;
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function positionTooltip(term) {
    if (!tooltip || !term) return;
    const rect = term.getBoundingClientRect();
    const margin = 12;
    const maxLeft = Math.max(margin, window.innerWidth - tooltip.offsetWidth - margin);
    const left = Math.max(margin, Math.min(rect.left + rect.width / 2 - tooltip.offsetWidth / 2, maxLeft));
    let top = rect.bottom + 10;
    if (top + tooltip.offsetHeight > window.innerHeight - margin) {
      top = Math.max(margin, rect.top - tooltip.offsetHeight - 10);
    }
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function showTooltip(term, shouldPin) {
    const definition = DEFINITIONS[term.dataset.termKey];
    const node = ensureTooltip();
    node.innerHTML = `
      <div class="term-tooltip__title">${escapeHtml(definition.title)}</div>
      <div class="term-tooltip__body">${escapeHtml(definition.body)}</div>
    `;
    node.hidden = false;
    if (activeTerm && activeTerm !== term) activeTerm.classList.remove('is-open');
    activeTerm = term;
    pinned = shouldPin;
    term.classList.add('is-open');
    term.setAttribute('aria-expanded', 'true');
    positionTooltip(term);
  }

  function hideTooltip() {
    if (activeTerm) {
      activeTerm.classList.remove('is-open');
      activeTerm.setAttribute('aria-expanded', 'false');
    }
    activeTerm = null;
    pinned = false;
    if (tooltip) tooltip.hidden = true;
  }

  document.addEventListener('click', (event) => {
    const term = termFromEvent(event);
    if (!term) {
      if (tooltip && !tooltip.hidden && !event.target.closest('.article-term-tooltip')) hideTooltip();
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    if (activeTerm === term && tooltip && !tooltip.hidden && pinned) {
      hideTooltip();
      return;
    }
    showTooltip(term, true);
  }, true);

  document.addEventListener('mouseover', (event) => {
    const term = termFromEvent(event);
    if (!term) return;
    event.stopImmediatePropagation();
    if (!pinned || activeTerm !== term) showTooltip(term, false);
  }, true);

  document.addEventListener('mouseout', (event) => {
    const term = termFromEvent(event);
    if (!term || pinned) return;
    const related = event.relatedTarget;
    if (related && (term.contains(related) || (tooltip && tooltip.contains(related)))) return;
    event.stopImmediatePropagation();
    if (activeTerm === term) hideTooltip();
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      hideTooltip();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const term = termFromEvent(event);
    if (!term) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showTooltip(term, true);
  }, true);

  window.addEventListener('scroll', () => {
    if (activeTerm && tooltip && !tooltip.hidden) positionTooltip(activeTerm);
  }, true);
  window.addEventListener('resize', () => {
    if (activeTerm && tooltip && !tooltip.hidden) positionTooltip(activeTerm);
  });
})();
