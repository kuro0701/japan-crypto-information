const fs = require('fs');
const path = require('path');
const { marked, Renderer } = require('marked');

const CONTENT_DIR = path.join(__dirname, '..', 'content');

let articleCache = new Map();

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function stripWrappingQuotes(value) {
  const trimmed = String(value || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .replace(/\.md$/i, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function titleFromSlug(slug) {
  return String(slug || '')
    .split(/[-_]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function splitFrontmatter(markdown) {
  const text = String(markdown || '');
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  if (!match) {
    return {
      frontmatter: {},
      body: text,
    };
  }

  const frontmatter = match[1].split(/\r?\n/).reduce((acc, line) => {
    const item = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!item) return acc;
    acc[item[1]] = stripWrappingQuotes(item[2]);
    return acc;
  }, {});

  return {
    frontmatter,
    body: text.slice(match[0].length),
  };
}

function isoDate(value, fallback) {
  const date = new Date(value || fallback || Date.now());
  if (Number.isNaN(date.getTime())) {
    return new Date(fallback || Date.now()).toISOString();
  }
  return date.toISOString();
}

function firstHeading(markdown) {
  const match = String(markdown || '').match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

function renderMarkdown(markdown) {
  const renderer = new Renderer();

  renderer.link = function link(token) {
    const href = token.href || '';
    const title = token.title || '';
    const isSponsored = title.trim().toLowerCase() === 'sponsored';
    const relAttr = isSponsored ? ' rel="sponsored noopener"' : '';
    const titleAttr = title && !isSponsored ? ` title="${escapeHtml(title)}"` : '';
    const text = this.parser.parseInline(token.tokens || []);
    return `<a href="${escapeHtml(href)}"${titleAttr}${relAttr}>${text}</a>`;
  };

  return marked.parse(markdown, {
    renderer,
    gfm: true,
  });
}

function buildArticle(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const stat = fs.statSync(filePath);
  const { frontmatter, body } = splitFrontmatter(raw);
  const fallbackSlug = path.basename(filePath, '.md');
  const slug = normalizeSlug(frontmatter.slug || fallbackSlug);
  if (!slug) return null;

  const date = isoDate(frontmatter.date, stat.mtime);
  const updated = isoDate(frontmatter.updated || frontmatter.lastmod || frontmatter.date, stat.mtime);
  const title = frontmatter.title || firstHeading(body) || titleFromSlug(slug);

  return {
    slug,
    path: `/articles/${encodeURIComponent(slug)}`,
    title,
    description: frontmatter.description || frontmatter.excerpt || '',
    date,
    updated,
    author: frontmatter.author || 'Japan クリプト インフォメーション',
    html: renderMarkdown(body),
    sourcePath: filePath,
  };
}

function loadArticles() {
  const nextCache = new Map();
  if (!fs.existsSync(CONTENT_DIR)) {
    articleCache = nextCache;
    return;
  }

  for (const entry of fs.readdirSync(CONTENT_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const article = buildArticle(path.join(CONTENT_DIR, entry.name));
    if (article) nextCache.set(article.slug, article);
  }

  articleCache = nextCache;
}

function getArticle(slug) {
  return articleCache.get(normalizeSlug(slug)) || null;
}

function listArticles() {
  return Array.from(articleCache.values())
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

loadArticles();

module.exports = {
  getArticle,
  listArticles,
  loadArticles,
};
