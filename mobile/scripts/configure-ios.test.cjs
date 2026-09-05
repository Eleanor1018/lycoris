/* eslint-env node, es2022 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  resolveConfiguration,
  generateInfoPlist,
} = require('./configure-ios.cjs');
const template = fs.readFileSync(
  path.join(__dirname, '../ios/mobile/Info.plist'),
  'utf8',
);

test('Debug leaves API host detection to Metro and Release has its own HTTPS default', () => {
  assert.equal(resolveConfiguration('Debug').LY_API_BASE_URL, '');
  assert.equal(
    resolveConfiguration('Release').LY_API_BASE_URL,
    'https://api.lycoris.online',
  );
  const config = {
    Debug: {
      LY_API_BASE_URL: 'http://192.168.1.25:8080',
      LY_TIANDITU_API_KEY: 'debug-only',
    },
  };
  assert.equal(resolveConfiguration('Release', config).LY_TIANDITU_API_KEY, '');
  assert.equal(
    resolveConfiguration('Release', config).LY_API_BASE_URL,
    'https://api.lycoris.online',
  );
});

test('explicit environment config overrides the selected local configuration', () => {
  const values = resolveConfiguration(
    'Debug',
    { Debug: { LY_API_BASE_URL: 'http://localhost:8080' } },
    { LY_API_BASE_URL: ' http://192.168.1.10:8080 ' },
  );
  assert.equal(values.LY_API_BASE_URL, 'http://192.168.1.10:8080');
});

test('local HTTP cannot silently enter a Release build', () => {
  assert.throws(
    () =>
      resolveConfiguration(
        'Release',
        {},
        { LY_API_BASE_URL: 'http://192.168.1.10:8080' },
      ),
    /must use HTTPS/,
  );
  assert.throws(
    () =>
      resolveConfiguration('Release', {
        Release: { LY_API_BASE_URL: 'http://localhost:8080' },
      }),
    /must use HTTPS/,
  );
});

test('generated Debug and Release plists have separate transport policies', () => {
  const debug = generateInfoPlist(
    template,
    'Debug',
    resolveConfiguration('Debug'),
  );
  const release = generateInfoPlist(
    template,
    'Release',
    resolveConfiguration('Release'),
  );
  assert.match(debug, /<key>NSAllowsArbitraryLoads<\/key>\s*<true\/>/);
  assert.match(debug, /<key>NSLocalNetworkUsageDescription<\/key>/);
  assert.doesNotMatch(debug, /<key>NSAllowsLocalNetworking<\/key>/);
  assert.match(release, /<key>NSAllowsArbitraryLoads<\/key>\s*<false\/>/);
  assert.doesNotMatch(release, /<key>NSLocalNetworkUsageDescription<\/key>/);
});

test('configuration text is escaped for XML and unsupported Xcode substitutions fail', () => {
  const values = resolveConfiguration('Debug', {
    Debug: {
      LY_THUNDERFOREST_API_KEY: 'a&b<"c\'>$&',
      LY_API_BASE_URL: 'https://example.test/api',
    },
  });
  const generated = generateInfoPlist(template, 'Debug', values);
  assert.match(generated, /a&amp;b&lt;&quot;c&apos;&gt;\$&amp;/);
  assert.throws(
    () =>
      resolveConfiguration('Debug', {
        Debug: { LY_TIANDITU_API_KEY: '$(OTHER_KEY)' },
      }),
    /literal values/,
  );
});

test('invalid schema and ambiguous API URLs fail without printing values', () => {
  for (const document of [
    { Debug: { OTHER_KEY: 'secret-value' } },
    { Release: [] },
    { Profile: {} },
    [],
  ]) {
    assert.throws(() => resolveConfiguration('Debug', document));
  }
  for (const value of [
    'file:///tmp/private',
    'https://user:secret@example.test',
    'https://example.test?token=secret',
  ]) {
    assert.throws(
      () => resolveConfiguration('Debug', {}, { LY_API_BASE_URL: value }),
      error => !error.message.includes('secret'),
    );
  }
});

test('CLI reports malformed local JSON without exposing its contents', () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'lycoris-ios-config-'),
  );
  const config = path.join(directory, 'invalid.json');
  try {
    fs.writeFileSync(
      config,
      '{"Debug":{"LY_TIANDITU_API_KEY":"secret-do-not-log"',
    );
    const result = spawnSync(
      process.execPath,
      [
        path.join(__dirname, 'configure-ios.cjs'),
        '--check',
        '--config',
        config,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /not valid JSON/);
    assert.doesNotMatch(result.stderr + result.stdout, /secret-do-not-log/);
  } finally {
    fs.rmSync(config, { force: true });
    fs.rmdirSync(directory);
  }
});
