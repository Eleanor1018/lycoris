/* global jest */

global.fetch = jest.fn(async () => ({
  ok: false,
  status: 401,
  headers: {get: () => 'application/json'},
  json: async () => ({}),
  text: async () => '',
}));

jest.mock(
  '@react-native-async-storage/async-storage',
  () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native-webview', () => {
  const React = require('react');
  const {View} = require('react-native');

  return {
    WebView: React.forwardRef((_, ref) => {
      React.useImperativeHandle(ref, () => ({
        injectJavaScript: jest.fn(),
        reload: jest.fn(),
      }));
      return React.createElement(View, {testID: 'map-webview'});
    }),
  };
});
