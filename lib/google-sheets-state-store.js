const crypto = require('crypto');

const DEFAULT_SHEET_NAME = 'app_state_snapshots';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const HEADER_ROW = Object.freeze(['state_key', 'entry_type', 'entry_key', 'chunk_index', 'payload_chunk', 'updated_at']);
const PAYLOAD_CHUNK_SIZE = 45_000;

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function normalizePrivateKey(value) {
  return String(value || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n');
}

function normalizeServiceAccountCredentials(credentials) {
  if (!credentials || typeof credentials !== 'object') {
    throw new Error('Google Sheets service account credentials are missing');
  }

  const clientEmail = String(credentials.client_email || credentials.clientEmail || '').trim();
  const privateKey = normalizePrivateKey(credentials.private_key || credentials.privateKey);

  if (!clientEmail) {
    throw new Error('Google Sheets service account client_email is missing');
  }
  if (!privateKey) {
    throw new Error('Google Sheets service account private_key is missing');
  }

  return {
    client_email: clientEmail,
    private_key: privateKey,
  };
}

function loadGoogleSheetsServiceAccountFromEnv(env = process.env) {
  const json = String(env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON || '').trim();
  if (json) {
    return normalizeServiceAccountCredentials(JSON.parse(json));
  }

  const jsonBase64 = String(env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON_BASE64 || '').trim();
  if (jsonBase64) {
    const decoded = Buffer.from(jsonBase64, 'base64').toString('utf8');
    return normalizeServiceAccountCredentials(JSON.parse(decoded));
  }

  const clientEmail = String(
    env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL
      || env.GOOGLE_SERVICE_ACCOUNT_EMAIL
      || env.GOOGLE_CLIENT_EMAIL
      || ''
  ).trim();
  const privateKey = normalizePrivateKey(
    env.GOOGLE_SHEETS_PRIVATE_KEY
      || env.GOOGLE_PRIVATE_KEY
      || ''
  );

  if (!clientEmail && !privateKey) return null;

  return normalizeServiceAccountCredentials({
    client_email: clientEmail,
    private_key: privateKey,
  });
}

function quoteSheetName(sheetName) {
  return `'${String(sheetName).replace(/'/g, "''")}'`;
}

function a1Range(sheetName, range) {
  return `${quoteSheetName(sheetName)}!${range}`;
}

function splitTextIntoChunks(value, chunkSize = PAYLOAD_CHUNK_SIZE) {
  const text = String(value || '');
  if (!text) return [''];
  const chunks = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }
  return chunks;
}

function snapshotEntryKey(snapshot, index) {
  return String(
    (snapshot && (snapshot.volumeDateJst || snapshot.spreadDateJst || snapshot.jstDate || snapshot.capturedAt))
      || `snapshot-${index}`
  );
}

function encodeStateRows(stateKey, payload, updatedAt) {
  const rows = [];
  const normalized = {
    version: 1,
    latest: payload && payload.latest ? payload.latest : null,
    dailySnapshots: Array.isArray(payload && payload.dailySnapshots) ? payload.dailySnapshots : [],
  };

  const appendEntry = (entryType, entryKey, entryPayload) => {
    const chunks = splitTextIntoChunks(JSON.stringify(entryPayload));
    chunks.forEach((chunk, index) => {
      rows.push([
        stateKey,
        entryType,
        entryKey,
        String(index),
        chunk,
        updatedAt,
      ]);
    });
  };

  if (normalized.latest) {
    appendEntry('latest', 'latest', normalized.latest);
  }
  normalized.dailySnapshots.forEach((snapshot, index) => {
    appendEntry('daily', snapshotEntryKey(snapshot, index), snapshot);
  });

  return rows;
}

function contiguousRowBlocks(rowNumbers) {
  const sorted = Array.from(new Set(rowNumbers))
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const blocks = [];

  for (const rowNumber of sorted) {
    const last = blocks[blocks.length - 1];
    if (last && last.endRowNumber + 1 === rowNumber) {
      last.endRowNumber = rowNumber;
    } else {
      blocks.push({
        startRowNumber: rowNumber,
        endRowNumber: rowNumber,
      });
    }
  }

  return blocks;
}

function formatApiError(response, bodyText) {
  const body = String(bodyText || '').replace(/\s+/g, ' ').trim();
  const suffix = body ? `: ${body.slice(0, 500)}` : '';
  return `Google Sheets API request failed (${response.status} ${response.statusText || 'Error'})${suffix}`;
}

class GoogleServiceAccountAuth {
  constructor({ credentials, fetchImpl = globalThis.fetch, tokenUrl = GOOGLE_TOKEN_URL, now = () => new Date() } = {}) {
    this.credentials = normalizeServiceAccountCredentials(credentials);
    this.fetchImpl = fetchImpl;
    this.tokenUrl = tokenUrl;
    this.now = now;
    this.cachedToken = null;

    if (typeof this.fetchImpl !== 'function') {
      throw new Error('fetch is required for Google Sheets authentication');
    }
  }

  createAssertion() {
    const nowSeconds = Math.floor(this.now().getTime() / 1000);
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };
    const claims = {
      iss: this.credentials.client_email,
      scope: GOOGLE_SHEETS_SCOPE,
      aud: this.tokenUrl,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    };
    const signingInput = `${base64UrlJson(header)}.${base64UrlJson(claims)}`;
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(signingInput)
      .end()
      .sign(this.credentials.private_key)
      .toString('base64url');

    return `${signingInput}.${signature}`;
  }

  async getAccessToken() {
    const nowMs = this.now().getTime();
    if (this.cachedToken && this.cachedToken.expiresAtMs - 60_000 > nowMs) {
      return this.cachedToken.accessToken;
    }

    const response = await this.fetchImpl(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: this.createAssertion(),
      }),
    });
    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(formatApiError(response, bodyText));
    }

    const parsed = bodyText ? JSON.parse(bodyText) : {};
    const accessToken = String(parsed.access_token || '').trim();
    if (!accessToken) {
      throw new Error('Google OAuth token response did not include access_token');
    }

    const expiresInSeconds = Number(parsed.expires_in || 3600);
    this.cachedToken = {
      accessToken,
      expiresAtMs: nowMs + Math.max(60, expiresInSeconds) * 1000,
    };
    return accessToken;
  }
}

class GoogleSheetsStateStore {
  constructor({
    spreadsheetId,
    sheetName = DEFAULT_SHEET_NAME,
    serviceAccount,
    fetchImpl = globalThis.fetch,
    now = () => new Date(),
  } = {}) {
    this.spreadsheetId = String(spreadsheetId || '').trim();
    this.sheetName = String(sheetName || DEFAULT_SHEET_NAME).trim() || DEFAULT_SHEET_NAME;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.auth = serviceAccount
      ? new GoogleServiceAccountAuth({ credentials: serviceAccount, fetchImpl, now })
      : null;
    this.initPromise = null;
    this.disabled = false;
    this.sheetId = null;
    this.writeChain = Promise.resolve();
  }

  isEnabled() {
    return Boolean(this.spreadsheetId && this.auth && !this.disabled);
  }

  getLabel() {
    return 'Google Sheets';
  }

  async initialize() {
    if (!this.isEnabled()) return false;
    if (!this.initPromise) {
      this.initPromise = this.ensureSheet();
    }

    try {
      await this.initPromise;
      return true;
    } catch (err) {
      this.disable(err);
      return false;
    }
  }

  async request(apiPath, options = {}) {
    const accessToken = await this.auth.getAccessToken();
    const response = await this.fetchImpl(
      `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(this.spreadsheetId)}${apiPath}`,
      {
        ...options,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      }
    );
    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(formatApiError(response, bodyText));
    }
    return bodyText ? JSON.parse(bodyText) : {};
  }

  async ensureSheet() {
    const metadata = await this.request('?fields=sheets.properties(sheetId,title)', {
      method: 'GET',
    });
    const sheets = Array.isArray(metadata.sheets) ? metadata.sheets : [];
    const existingSheet = sheets.find(sheet => (
      sheet
      && sheet.properties
      && sheet.properties.title === this.sheetName
    ));

    if (existingSheet) {
      this.sheetId = existingSheet.properties.sheetId;
    } else {
      const created = await this.request(':batchUpdate', {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: this.sheetName,
                },
              },
            },
          ],
        }),
      });
      this.sheetId = created
        && created.replies
        && created.replies[0]
        && created.replies[0].addSheet
        && created.replies[0].addSheet.properties
        && created.replies[0].addSheet.properties.sheetId;
    }

    await this.ensureHeaderRow();
  }

  async ensureHeaderRow() {
    const range = a1Range(this.sheetName, 'A1:F1');
    const current = await this.request(`/values/${encodeURIComponent(range)}`, {
      method: 'GET',
    });
    const values = Array.isArray(current.values) && Array.isArray(current.values[0])
      ? current.values[0]
      : [];
    const hasHeader = HEADER_ROW.every((heading, index) => values[index] === heading);
    if (hasHeader) return;

    await this.request(`/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
      method: 'PUT',
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: [HEADER_ROW],
      }),
    });
  }

  async readRows() {
    const range = a1Range(this.sheetName, 'A2:F');
    const result = await this.request(`/values/${encodeURIComponent(range)}`, {
      method: 'GET',
    });
    return (Array.isArray(result.values) ? result.values : []).map((values, index) => ({
      rowNumber: index + 2,
      values,
    }));
  }

  decodeRows(stateKey, rows) {
    const normalizedKey = String(stateKey || '').trim();
    const matchedRows = rows.filter(({ values }) => String(values[0] || '').trim() === normalizedKey);
    const legacyRow = matchedRows.find(({ values }) => String(values[1] || '').trim().startsWith('{'));
    if (legacyRow) {
      return JSON.parse(legacyRow.values[1]);
    }

    const entries = new Map();
    for (const { values } of matchedRows) {
      const entryType = String(values[1] || '').trim();
      const entryKey = String(values[2] || '').trim();
      const chunkIndex = Number.parseInt(values[3], 10);
      const chunk = values[4] == null ? '' : String(values[4]);
      if (!entryType || !entryKey || !Number.isFinite(chunkIndex)) continue;

      const key = `${entryType}\u0000${entryKey}`;
      if (!entries.has(key)) {
        entries.set(key, {
          entryType,
          entryKey,
          chunks: [],
        });
      }
      entries.get(key).chunks.push({
        index: chunkIndex,
        chunk,
      });
    }

    if (entries.size === 0) return null;

    const dailyEntries = [];
    let latest = null;
    for (const entry of entries.values()) {
      const payloadText = entry.chunks
        .sort((a, b) => a.index - b.index)
        .map(item => item.chunk)
        .join('');
      const parsed = JSON.parse(payloadText);
      if (entry.entryType === 'latest') {
        latest = parsed;
      } else if (entry.entryType === 'daily') {
        dailyEntries.push({
          key: entry.entryKey,
          payload: parsed,
        });
      }
    }

    return {
      version: 1,
      latest,
      dailySnapshots: dailyEntries
        .sort((a, b) => String(a.key).localeCompare(String(b.key)))
        .map(entry => entry.payload),
    };
  }

  async deleteRows(rowNumbers) {
    const blocks = contiguousRowBlocks(rowNumbers);
    if (blocks.length === 0) return;

    await this.request(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        requests: blocks
          .sort((a, b) => b.startRowNumber - a.startRowNumber)
          .map(block => ({
            deleteDimension: {
              range: {
                sheetId: this.sheetId,
                dimension: 'ROWS',
                startIndex: block.startRowNumber - 1,
                endIndex: block.endRowNumber,
              },
            },
          })),
      }),
    });
  }

  async load(stateKey) {
    if (!this.isEnabled()) return null;
    const ready = await this.initialize();
    if (!ready || !this.isEnabled()) return null;

    try {
      const normalizedKey = String(stateKey || '').trim();
      const rows = await this.readRows();
      return this.decodeRows(normalizedKey, rows);
    } catch (err) {
      this.disable(err);
      return null;
    }
  }

  async save(stateKey, payload) {
    const operation = this.writeChain
      .catch(() => {})
      .then(() => this.saveNow(stateKey, payload));
    this.writeChain = operation.catch(() => {});
    return operation;
  }

  async saveNow(stateKey, payload) {
    if (!this.isEnabled()) return false;
    const ready = await this.initialize();
    if (!ready || !this.isEnabled()) return false;

    try {
      const normalizedKey = String(stateKey || '').trim();
      const rows = await this.readRows();
      const existingRowNumbers = rows
        .filter(({ values }) => String(values[0] || '').trim() === normalizedKey)
        .map(row => row.rowNumber);
      await this.deleteRows(existingRowNumbers);

      const values = encodeStateRows(normalizedKey, payload, this.now().toISOString());
      if (values.length > 0) {
        const range = a1Range(this.sheetName, 'A:F');
        await this.request(`/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
          method: 'POST',
          body: JSON.stringify({
            range,
            majorDimension: 'ROWS',
            values,
          }),
        });
      }

      return true;
    } catch (err) {
      this.disable(err);
      return false;
    }
  }

  disable(err) {
    this.disabled = true;
    this.initPromise = null;
    if (err && err.message) {
      console.warn('[GoogleSheetsStateStore] Disabling snapshot persistence:', err.message);
    }
  }

  async close() {}
}

module.exports = {
  DEFAULT_SHEET_NAME,
  GoogleSheetsStateStore,
  GoogleServiceAccountAuth,
  loadGoogleSheetsServiceAccountFromEnv,
  normalizeServiceAccountCredentials,
};
