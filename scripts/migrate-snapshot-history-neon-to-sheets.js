#!/usr/bin/env node

const { NeonStateStore } = require('../lib/neon-state-store');
const {
  GoogleSheetsStateStore,
  loadGoogleSheetsServiceAccountFromEnv,
} = require('../lib/google-sheets-state-store');

const STATE_KEYS = Object.freeze(['volume-share', 'sales-spread']);

async function main() {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  const spreadsheetId = String(process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();
  const sheetName = String(process.env.GOOGLE_SHEETS_SHEET_NAME || '').trim();
  const serviceAccount = loadGoogleSheetsServiceAccountFromEnv(process.env);

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to read existing Neon snapshot history');
  }
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is required to write snapshot history to Google Sheets');
  }
  if (!serviceAccount) {
    throw new Error('Google Sheets service account credentials are required');
  }

  const neon = new NeonStateStore({ connectionString: databaseUrl });
  const sheets = new GoogleSheetsStateStore({
    spreadsheetId,
    sheetName: sheetName || undefined,
    serviceAccount,
  });

  try {
    for (const key of STATE_KEYS) {
      const payload = await neon.load(key);
      if (!payload) {
        console.warn(`[migrate] ${key}: no state found in Neon; skipped`);
        continue;
      }

      const saved = await sheets.save(key, payload);
      if (!saved) {
        throw new Error(`Could not save ${key} to Google Sheets`);
      }
      const snapshotCount = Array.isArray(payload.dailySnapshots) ? payload.dailySnapshots.length : 0;
      console.log(`[migrate] ${key}: copied latest=${Boolean(payload.latest)} dailySnapshots=${snapshotCount}`);
    }
  } finally {
    await Promise.all([
      neon.close().catch(() => {}),
      sheets.close().catch(() => {}),
    ]);
  }
}

main().catch((err) => {
  console.error('[migrate] Failed:', err.message);
  process.exitCode = 1;
});
