const crypto = require('crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function createAnalyticsAdminService({
  analyticsAdminToken,
  analyticsAdminTokenHash,
  analyticsSalt,
  cookieName,
  cookiePath,
  sessionTtlMs,
}) {
  const normalizedToken = String(analyticsAdminToken || '').trim();
  const normalizedTokenHash = String(analyticsAdminTokenHash || '').trim().toLowerCase();

  if (!normalizedToken && !normalizedTokenHash) {
    throw new Error('ANALYTICS_ADMIN_TOKEN or ANALYTICS_ADMIN_TOKEN_HASH must be configured');
  }

  if (normalizedTokenHash && !/^[a-f0-9]{64}$/.test(normalizedTokenHash)) {
    throw new Error('ANALYTICS_ADMIN_TOKEN_HASH must be a SHA-256 hex digest');
  }

  const sessionSecret = sha256([
    'analytics-admin-session',
    normalizedTokenHash || sha256(normalizedToken),
    analyticsSalt || '',
  ].join(':'));

  function requestOrigin(req) {
    if (process.env.SITE_ORIGIN) return String(process.env.SITE_ORIGIN).replace(/\/+$/, '');
    const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim();
    const protocol = forwardedProto || req.protocol || 'http';
    return `${protocol}://${req.get('host')}`;
  }

  function parseCookieHeader(headerValue) {
    const cookies = new Map();
    for (const part of String(headerValue || '').split(';')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex <= 0) continue;
      const name = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      cookies.set(name, value);
    }
    return cookies;
  }

  function shouldUseSecureCookies(req) {
    if (req.secure) return true;
    return requestOrigin(req).startsWith('https://');
  }

  function serializeCookie(name, value, options = {}) {
    const segments = [`${name}=${value}`];
    if (Number.isFinite(options.maxAge)) segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
    if (options.path) segments.push(`Path=${options.path}`);
    if (options.httpOnly) segments.push('HttpOnly');
    if (options.secure) segments.push('Secure');
    if (options.sameSite) segments.push(`SameSite=${options.sameSite}`);
    if (options.expires instanceof Date) segments.push(`Expires=${options.expires.toUTCString()}`);
    return segments.join('; ');
  }

  function unavailable(res) {
    res.set('Cache-Control', 'no-store');
    res.status(503).json({
      error: 'ANALYTICS_ADMIN_TOKEN または ANALYTICS_ADMIN_TOKEN_HASH を設定してください',
    });
  }

  function timingSafeEqualString(a, b) {
    const left = Buffer.from(String(a || ''), 'utf8');
    const right = Buffer.from(String(b || ''), 'utf8');
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  }

  function isValidToken(requestToken) {
    if (!requestToken) return false;
    if (normalizedToken && timingSafeEqualString(requestToken, normalizedToken)) {
      return true;
    }
    return normalizedTokenHash
      && timingSafeEqualString(sha256(requestToken), normalizedTokenHash);
  }

  function signSession(encodedPayload) {
    return crypto
      .createHmac('sha256', sessionSecret)
      .update(encodedPayload)
      .digest('base64url');
  }

  function issueSession(req, res) {
    const payload = Buffer.from(JSON.stringify({
      v: 1,
      exp: Date.now() + sessionTtlMs,
    }), 'utf8').toString('base64url');
    const signature = signSession(payload);
    res.setHeader('Set-Cookie', serializeCookie(
      cookieName,
      `${payload}.${signature}`,
      {
        httpOnly: true,
        maxAge: sessionTtlMs / 1000,
        path: cookiePath,
        sameSite: 'Strict',
        secure: shouldUseSecureCookies(req),
      }
    ));
  }

  function clearSession(req, res) {
    res.setHeader('Set-Cookie', serializeCookie(
      cookieName,
      '',
      {
        expires: new Date(0),
        httpOnly: true,
        maxAge: 0,
        path: cookiePath,
        sameSite: 'Strict',
        secure: shouldUseSecureCookies(req),
      }
    ));
  }

  function hasSession(req) {
    const cookieValue = parseCookieHeader(req.headers.cookie).get(cookieName);
    if (!cookieValue) return false;

    const separatorIndex = cookieValue.indexOf('.');
    if (separatorIndex <= 0) return false;

    const payload = cookieValue.slice(0, separatorIndex);
    const signature = cookieValue.slice(separatorIndex + 1);
    const expectedSignature = signSession(payload);
    if (!timingSafeEqualString(signature, expectedSignature)) return false;

    try {
      const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (session.v !== 1) return false;
      if (!Number.isFinite(session.exp) || session.exp <= Date.now()) return false;
      return true;
    } catch (_err) {
      return false;
    }
  }

  function requireAdmin(req, res, next) {
    res.set('Cache-Control', 'no-store');

    if (!hasSession(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  }

  function handleLogin(req, res) {
    res.set('Cache-Control', 'no-store');
    const requestToken = String(req.body?.token || '').trim();
    if (!requestToken) {
      res.status(400).json({ error: 'Token required' });
      return;
    }
    if (!isValidToken(requestToken)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    issueSession(req, res);
    res.status(204).end();
  }

  function handleLogout(req, res) {
    res.set('Cache-Control', 'no-store');
    clearSession(req, res);
    res.status(204).end();
  }

  return {
    handleLogin,
    handleLogout,
    requireAdmin,
    unavailable,
  };
}

module.exports = {
  createAnalyticsAdminService,
};
