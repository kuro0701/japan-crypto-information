const fs = require('fs');
const path = require('path');

function writeJsonFileAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  fs.renameSync(tmpPath, filePath);
}

function readJsonFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveDataDir({ projectRoot, env = process.env } = {}) {
  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  const configuredDataDir = String(env.DATA_DIR || '').trim();

  if (nodeEnv === 'production') {
    if (!configuredDataDir) {
      throw new Error('DATA_DIR must be configured in production');
    }
    if (!path.isAbsolute(configuredDataDir)) {
      throw new Error('DATA_DIR must be an absolute path in production');
    }
  }

  if (configuredDataDir) return path.resolve(configuredDataDir);
  return path.join(projectRoot, 'data');
}

function ensureDataDirHealth({ dataDirPath, projectRoot, expectedFiles = [], env = process.env } = {}) {
  if (!dataDirPath) throw new Error('DATA_DIR is not configured');

  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  const resolvedDataDir = path.resolve(dataDirPath);
  const resolvedProjectRoot = projectRoot ? path.resolve(projectRoot) : '';

  if (nodeEnv === 'production' && resolvedProjectRoot) {
    if (
      resolvedDataDir === resolvedProjectRoot
      || resolvedDataDir.startsWith(`${resolvedProjectRoot}${path.sep}`)
    ) {
      throw new Error('DATA_DIR must point outside the application directory in production');
    }
  }

  fs.mkdirSync(resolvedDataDir, { recursive: true });
  const stats = fs.statSync(resolvedDataDir);
  if (!stats.isDirectory()) {
    throw new Error(`DATA_DIR is not a directory: ${resolvedDataDir}`);
  }

  fs.accessSync(resolvedDataDir, fs.constants.R_OK | fs.constants.W_OK);

  const probeBase = path.join(resolvedDataDir, `.data-dir-health-${process.pid}-${Date.now()}`);
  const probeRenamed = `${probeBase}.ok`;
  fs.writeFileSync(probeBase, JSON.stringify({ ok: true, checkedAt: new Date().toISOString() }));
  fs.renameSync(probeBase, probeRenamed);
  fs.unlinkSync(probeRenamed);

  for (const filePath of expectedFiles) {
    if (!filePath || !fs.existsSync(filePath)) continue;
    fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
    JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  return {
    dataDirPath: resolvedDataDir,
    checkedAt: new Date().toISOString(),
  };
}

module.exports = {
  ensureDataDirHealth,
  readJsonFileIfExists,
  resolveDataDir,
  writeJsonFileAtomic,
};
