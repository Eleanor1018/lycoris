/* eslint-env node, es2022 */
const fs = require('node:fs');
const path = require('node:path');

const IOS_ROOT = path.resolve(__dirname, '../ios');
const CONFIG_KEYS = [
  'LY_API_BASE_URL',
  'LY_THUNDERFOREST_API_KEY',
  'LY_TIANDITU_API_KEY',
];
const CONFIGURATIONS = ['Debug', 'Release'];
const ATS_DICTIONARY =
  /<key>NSAppTransportSecurity<\/key>\s*<dict>[\s\S]*?<\/dict>/g;
const ROOT_END = /<\/dict>\s*<\/plist>\s*$/;

function validateDocument(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('iOS runtime configuration must be a JSON object.');
  }
  for (const [configuration, values] of Object.entries(document)) {
    if (!CONFIGURATIONS.includes(configuration)) {
      throw new Error(
        'iOS runtime configuration only supports Debug and Release.',
      );
    }
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error(
        `${configuration} runtime configuration must be an object.`,
      );
    }
    for (const [key, value] of Object.entries(values)) {
      if (!CONFIG_KEYS.includes(key) || typeof value !== 'string') {
        throw new Error(
          `${configuration} runtime configuration contains an unsupported key or value type.`,
        );
      }
    }
  }
}

function resolveConfiguration(configuration, document = {}, environment = {}) {
  if (!CONFIGURATIONS.includes(configuration)) {
    throw new Error('Choose the Debug or Release build configuration.');
  }
  validateDocument(document);
  const values = {
    // Empty Debug API lets JavaScript derive the Mac host from Metro, including
    // physical devices. An explicit local value takes precedence over that.
    LY_API_BASE_URL:
      configuration === 'Release' ? 'https://api.lycoris.online' : '',
    LY_THUNDERFOREST_API_KEY: '',
    LY_TIANDITU_API_KEY: '',
    ...document[configuration],
  };
  for (const key of CONFIG_KEYS) {
    if (typeof environment[key] === 'string') values[key] = environment[key];
    values[key] = values[key].trim();
    if (
      [...values[key]].some(character => {
        const code = character.codePointAt(0);
        return !(
          [9, 10, 13].includes(code) ||
          (code >= 0x20 && code <= 0xd7ff) ||
          (code >= 0xe000 && code <= 0xfffd) ||
          code >= 0x10000
        );
      })
    ) {
      throw new Error(
        'iOS runtime configuration contains a character unsupported by property lists.',
      );
    }
    // Xcode expands build-setting references in Info.plist. Do not allow a
    // literal credential to change meaning during ProcessInfoPlistFile.
    if (/\$[({]/.test(values[key])) {
      throw new Error(
        'iOS runtime configuration must use literal values, without build-setting substitutions.',
      );
    }
  }
  const apiUrl = values.LY_API_BASE_URL;
  if (apiUrl) {
    let parsed;
    try {
      parsed = new URL(apiUrl);
    } catch {
      throw new Error('LY_API_BASE_URL must be an absolute HTTP or HTTPS URL.');
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error(
        'LY_API_BASE_URL must use HTTP or HTTPS without credentials, a query, or a fragment.',
      );
    }
    if (configuration === 'Release' && parsed.protocol !== 'https:') {
      throw new Error(
        'Release LY_API_BASE_URL must use HTTPS; local HTTP is only supported in Debug.',
      );
    }
  }
  return values;
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateInfoPlist(template, configuration, values) {
  // CocoaPods may reserialize Info.plist while enabling the new architecture,
  // so use actual plist keys rather than comments that it would discard.
  if (
    [...template.matchAll(ATS_DICTIONARY)].length !== 1 ||
    !ROOT_END.test(template) ||
    /<key>LycorisRuntimeConfig<\/key>/.test(template)
  ) {
    throw new Error(
      'The source Info.plist must contain one ATS dictionary and no generated runtime configuration.',
    );
  }
  const runtime =
    '<key>LycorisRuntimeConfig</key>\n\t<dict>\n' +
    CONFIG_KEYS.map(
      key =>
        `\t\t<key>${key}</key>\n\t\t<string>${escapeXml(values[key])}</string>`,
    ).join('\n') +
    '\n\t</dict>';
  // NSAllowsLocalNetworking must not be present alongside the Debug arbitrary
  // loads exception: iOS otherwise ignores NSAllowsArbitraryLoads, blocking LAN
  // IP addresses used by Metro and a development API on a physical iPhone.
  const debug = configuration === 'Debug';
  const transport =
    '<key>NSAppTransportSecurity</key>\n\t<dict>\n' +
    `\t\t<key>NSAllowsArbitraryLoads</key>\n\t\t<${
      debug ? 'true' : 'false'
    }/>\n\t</dict>` +
    (debug
      ? '\n\t<key>NSLocalNetworkUsageDescription</key>\n\t<string>Connect to Metro and the development API on your local network.</string>'
      : '');
  return template
    .replace(ATS_DICTIONARY, () => transport)
    .replace(ROOT_END, () => `\t${runtime}\n</dict>\n</plist>\n`);
}

function run(argv, environment = process.env) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') {
      options.check = true;
      continue;
    }
    if (
      !['--configuration', '--config', '--output'].includes(argument) ||
      !argv[index + 1]
    ) {
      throw new Error(
        'Usage: node scripts/configure-ios.cjs --configuration Debug|Release [--config file.json] (--check | --output Info.plist)',
      );
    }
    options[argument.slice(2)] = argv[++index];
  }
  const configuration =
    options.configuration || environment.CONFIGURATION || 'Debug';
  const configPath = options.config
    ? path.resolve(options.config)
    : path.join(IOS_ROOT, 'RuntimeConfig.local.json');
  let document = {};
  if (fs.existsSync(configPath)) {
    try {
      document = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      // JSON syntax errors may contain the invalid value. Never echo them.
      throw new Error('The iOS runtime configuration file is not valid JSON.');
    }
  } else if (options.config) {
    throw new Error(
      'The requested iOS runtime configuration file does not exist.',
    );
  }
  const values = resolveConfiguration(configuration, document, environment);
  const template = fs.readFileSync(
    path.join(IOS_ROOT, 'mobile/Info.plist'),
    'utf8',
  );
  const plist = generateInfoPlist(template, configuration, values);
  if (!options.check) {
    const output = options.output || environment.SCRIPT_OUTPUT_FILE_0;
    if (!output)
      throw new Error(
        'Pass --output for generation, or --check to validate without writing.',
      );
    fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
    fs.writeFileSync(output, plist);
  }
  console.log(
    `iOS ${configuration} configuration ${
      options.check ? 'validated' : 'generated'
    }.`,
  );
}

module.exports = { resolveConfiguration, generateInfoPlist, run };
if (require.main === module) {
  try {
    run(process.argv.slice(2));
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}
