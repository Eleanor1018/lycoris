type RuntimeGlobals = typeof globalThis & {
  __DEV__: boolean;
  LY_API_BASE_URL?: string;
  LY_THUNDERFOREST_API_KEY?: string;
  LY_TIANDITU_API_KEY?: string;
};
const globals = globalThis as RuntimeGlobals;
const originalGlobals = {
  LY_API_BASE_URL: globals.LY_API_BASE_URL,
  LY_THUNDERFOREST_API_KEY: globals.LY_THUNDERFOREST_API_KEY,
  LY_TIANDITU_API_KEY: globals.LY_TIANDITU_API_KEY,
};

const readConfig = (
  platform: string,
  modules: Record<string, unknown> = {},
) => {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    Platform: { OS: platform },
    NativeModules: modules,
  }));
  return require('../src/config/runtime') as typeof import('../src/config/runtime');
};

beforeEach(() => {
  delete globals.LY_API_BASE_URL;
  delete globals.LY_THUNDERFOREST_API_KEY;
  delete globals.LY_TIANDITU_API_KEY;
});
afterEach(() => {
  Object.assign(globals, originalGlobals);
  jest.restoreAllMocks();
  jest.dontMock('react-native');
  jest.resetModules();
});

test.each([
  [undefined, 'http://localhost:8080'],
  ['http://localhost:8081/index.bundle?platform=ios', 'http://localhost:8080'],
  ['http://192.168.1.25:8081/index.bundle', 'http://192.168.1.25:8080'],
  ['http://noras-mac.local:8081/index.bundle', 'http://noras-mac.local:8080'],
  ['http://[::1]:8081/index.bundle', 'http://[::1]:8080'],
  ['file:///main.jsbundle', 'http://localhost:8080'],
  ['http://name:password@host/index.bundle', 'http://localhost:8080'],
])(
  'iOS debug derives a reachable backend from Metro %p',
  (scriptURL, expected) => {
    expect(readConfig('ios', { SourceCode: { scriptURL } }).API_BASE_URL).toBe(
      expected,
    );
  },
);

test('native getConstants source URL is supported and lookup failure falls back safely', () => {
  expect(
    readConfig('ios', {
      SourceCode: {
        getConstants: () => ({
          scriptURL: 'http://192.168.1.2:8081/index.bundle',
        }),
      },
    }).API_BASE_URL,
  ).toBe('http://192.168.1.2:8080');
  expect(
    readConfig('ios', {
      SourceCode: {
        getConstants: () => {
          throw new Error('bundle unavailable');
        },
      },
    }).API_BASE_URL,
  ).toBe('http://localhost:8080');
});

test('Android retains its emulator host and release ignores Metro', () => {
  expect(readConfig('android').API_BASE_URL).toBe('http://10.0.2.2:8080');
  jest.replaceProperty(globals, '__DEV__', false);
  expect(
    readConfig('ios', {
      SourceCode: { scriptURL: 'http://192.168.1.2:8081/index.bundle' },
    }).API_BASE_URL,
  ).toBe('https://api.lycoris.online');
});

test('explicit global and native configuration preserve precedence, URL joining and map keys', () => {
  const modules = {
    RuntimeConfig: {
      LY_API_BASE_URL: ' https://preview.example.test/// ',
      LY_THUNDERFOREST_API_KEY: 'test-map-key',
      LY_TIANDITU_API_KEY: 'test-map-key-2',
    },
  };
  let config = readConfig('ios', modules);
  expect(config.API_BASE_URL).toBe('https://preview.example.test');
  expect(config.buildApiUrl('api/me')).toBe(
    'https://preview.example.test/api/me',
  );
  expect(config.toBackendAssetUrl('/uploads/test.jpg')).toBe(
    'https://preview.example.test/uploads/test.jpg',
  );
  expect(config.THUNDERFOREST_API_KEY).toBe('test-map-key');
  expect(config.TIANDITU_API_KEY).toBe('test-map-key-2');
  globals.LY_API_BASE_URL = ' http://192.168.1.3:8080/ ';
  config = readConfig('ios', modules);
  expect(config.API_BASE_URL).toBe('http://192.168.1.3:8080');
  globals.LY_API_BASE_URL = ' ';
  expect(readConfig('ios', modules).API_BASE_URL).toBe(
    'https://preview.example.test',
  );
});
