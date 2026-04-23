const fs = require('fs');
const os = require('os');
const path = require('path');

function createTempDir(prefix = 'okj-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function removeTempDir(dirPath) {
  if (!dirPath) return;
  fs.rmSync(dirPath, { recursive: true, force: true });
}

module.exports = {
  createTempDir,
  removeTempDir,
};
