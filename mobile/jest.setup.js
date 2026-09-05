/* eslint-env jest */

const { NativeModules } = require('react-native');
NativeModules.Networking.clearCookies = jest.fn(callback => callback(false));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  const WebView = React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn() }));
    return React.createElement(View, { ...props, testID: 'map-webview' });
  });
  return { WebView, default: WebView };
});

// Tests must opt into explicit responses; never send requests to a real backend.
global.fetch = jest.fn(() =>
  Promise.reject(new Error('Unmocked network request')),
);
