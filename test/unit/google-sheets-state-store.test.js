const crypto = require('crypto');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GoogleSheetsStateStore,
  loadGoogleSheetsServiceAccountFromEnv,
} = require('../../lib/google-sheets-state-store');

function createServiceAccount() {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  return {
    client_email: 'okj-sheets-test@example.iam.gserviceaccount.com',
    private_key: privateKey.export({
      type: 'pkcs8',
      format: 'pem',
    }),
  };
}

function createResponse(status, body, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body || {})),
  };
}

function createSheetsFetchMock(options = {}) {
  const calls = [];
  const state = {
    hasSheet: options.hasSheet === true,
    header: options.hasHeader === true ? ['state_key', 'entry_type', 'entry_key', 'chunk_index', 'payload_chunk', 'updated_at'] : [],
    rows: (options.rows || []).map(row => [...row]),
  };

  const fetchImpl = async (url, requestOptions = {}) => {
    const urlText = String(url);
    calls.push({
      url: urlText,
      method: requestOptions.method || 'GET',
      body: requestOptions.body ? String(requestOptions.body) : '',
    });

    if (urlText === 'https://oauth2.googleapis.com/token') {
      assert.match(String(requestOptions.body), /grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer/);
      return createResponse(200, {
        access_token: 'test-access-token',
        expires_in: 3600,
      });
    }

    if (urlText.includes('?fields=sheets.properties')) {
      return createResponse(200, {
        sheets: state.hasSheet
          ? [{ properties: { sheetId: 123, title: 'app_state_snapshots' } }]
          : [],
      });
    }

    if (urlText.endsWith(':batchUpdate')) {
      const body = requestOptions.body ? JSON.parse(requestOptions.body) : {};
      const requests = Array.isArray(body.requests) ? body.requests : [];
      const addSheetRequest = requests.find(request => request.addSheet);
      if (addSheetRequest) {
        state.hasSheet = true;
        return createResponse(200, {
          replies: [
            {
              addSheet: {
                properties: { sheetId: 123, title: 'app_state_snapshots' },
              },
            },
          ],
        });
      }

      for (const request of requests) {
        const range = request.deleteDimension && request.deleteDimension.range;
        if (!range || range.dimension !== 'ROWS') continue;
        const startRowIndex = Math.max(0, Number(range.startIndex) - 1);
        const deleteCount = Number(range.endIndex) - Number(range.startIndex);
        state.rows.splice(startRowIndex, deleteCount);
      }
      return createResponse(200, {
        replies: requests.map(() => ({})),
      });
    }

    if (urlText.includes('/values/')) {
      const rangePart = decodeURIComponent(urlText.split('/values/')[1].split('?')[0].replace(/:append$/, ''));
      const body = requestOptions.body ? JSON.parse(requestOptions.body) : {};

      if ((requestOptions.method || 'GET') === 'GET') {
        if (rangePart.endsWith('!A1:F1')) {
          return createResponse(200, state.header.length > 0 ? { values: [state.header] } : {});
        }
        if (rangePart.endsWith('!A2:F')) {
          return createResponse(200, state.rows.length > 0 ? { values: state.rows } : {});
        }
      }

      if ((requestOptions.method || 'GET') === 'PUT') {
        if (rangePart.endsWith('!A1:F1')) {
          state.header = [...body.values[0]];
          return createResponse(200, { updatedRows: 1 });
        }
      }

      if ((requestOptions.method || 'GET') === 'POST' && urlText.includes(':append')) {
        for (const row of body.values || []) {
          state.rows.push([...row]);
        }
        return createResponse(200, { updates: { updatedRows: (body.values || []).length } });
      }
    }

    return createResponse(404, { error: { message: `Unexpected URL: ${urlText}` } }, 'Not Found');
  };

  return {
    calls,
    fetchImpl,
    state,
  };
}

test('GoogleSheetsStateStore creates the tab and appends a new state row', async () => {
  const sheets = createSheetsFetchMock();
  const store = new GoogleSheetsStateStore({
    spreadsheetId: 'spreadsheet-id',
    serviceAccount: createServiceAccount(),
    fetchImpl: sheets.fetchImpl,
    now: () => new Date('2026-06-24T00:00:00.000Z'),
  });

  const payload = {
    version: 1,
    latest: { capturedAt: '2026-06-24T00:00:00.000Z' },
    dailySnapshots: [],
  };

  assert.equal(await store.save('volume-share', payload), true);
  assert.equal(sheets.state.hasSheet, true);
  assert.deepEqual(sheets.state.header, ['state_key', 'entry_type', 'entry_key', 'chunk_index', 'payload_chunk', 'updated_at']);
  assert.equal(sheets.state.rows.length, 1);
  assert.equal(sheets.state.rows[0][0], 'volume-share');
  assert.equal(sheets.state.rows[0][1], 'latest');
  assert.equal(sheets.state.rows[0][2], 'latest');
  assert.deepEqual(JSON.parse(sheets.state.rows[0][4]), payload.latest);
  assert.equal(sheets.state.rows[0][5], '2026-06-24T00:00:00.000Z');
  assert.ok(sheets.calls.some(call => call.url.endsWith(':batchUpdate')));

  const loaded = await store.load('volume-share');
  assert.deepEqual(loaded, payload);
});

test('GoogleSheetsStateStore updates an existing state row', async () => {
  const sheets = createSheetsFetchMock({
    hasSheet: true,
    hasHeader: true,
    rows: [
      ['sales-spread', 'latest', 'latest', '0', JSON.stringify({ capturedAt: '2026-06-23T00:00:00.000Z' }), '2026-06-23T00:00:00.000Z'],
    ],
  });
  const store = new GoogleSheetsStateStore({
    spreadsheetId: 'spreadsheet-id',
    serviceAccount: createServiceAccount(),
    fetchImpl: sheets.fetchImpl,
    now: () => new Date('2026-06-24T01:00:00.000Z'),
  });
  const payload = {
    version: 1,
    latest: { capturedAt: '2026-06-24T01:00:00.000Z' },
    dailySnapshots: [{ spreadDateJst: '2026-06-24', records: [] }],
  };

  assert.equal(await store.save('sales-spread', payload), true);
  assert.equal(sheets.state.rows.length, 2);
  assert.equal(sheets.state.rows[0][0], 'sales-spread');
  assert.equal(sheets.state.rows[0][1], 'latest');
  assert.deepEqual(JSON.parse(sheets.state.rows[0][4]), payload.latest);
  assert.equal(sheets.state.rows[0][5], '2026-06-24T01:00:00.000Z');
  assert.equal(sheets.state.rows[1][1], 'daily');
  assert.deepEqual(JSON.parse(sheets.state.rows[1][4]), payload.dailySnapshots[0]);
  assert.ok(sheets.calls.some(call => call.method === 'POST' && call.url.endsWith(':batchUpdate')));
});

test('GoogleSheetsStateStore chunks large payloads across rows', async () => {
  const sheets = createSheetsFetchMock({
    hasSheet: true,
    hasHeader: true,
  });
  const store = new GoogleSheetsStateStore({
    spreadsheetId: 'spreadsheet-id',
    serviceAccount: createServiceAccount(),
    fetchImpl: sheets.fetchImpl,
    now: () => new Date('2026-06-24T02:00:00.000Z'),
  });
  const payload = {
    version: 1,
    latest: {
      capturedAt: '2026-06-24T02:00:00.000Z',
      records: [{ exchangeId: 'okj', notes: 'x'.repeat(90_000) }],
    },
    dailySnapshots: [],
  };

  assert.equal(await store.save('volume-share', payload), true);
  assert.equal(sheets.state.rows.length, 3);
  assert.ok(sheets.state.rows.every(row => row[4].length <= 45_000));
  assert.deepEqual(await store.load('volume-share'), payload);
});

test('loadGoogleSheetsServiceAccountFromEnv supports base64 JSON credentials', () => {
  const serviceAccount = createServiceAccount();
  const encoded = Buffer.from(JSON.stringify(serviceAccount)).toString('base64');

  const parsed = loadGoogleSheetsServiceAccountFromEnv({
    GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON_BASE64: encoded,
  });

  assert.equal(parsed.client_email, serviceAccount.client_email);
  assert.equal(parsed.private_key, serviceAccount.private_key.trim());
});
