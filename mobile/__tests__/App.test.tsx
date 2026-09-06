/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('mounts the real navigation tree and map screen without native modules', async () => {
  jest.useFakeTimers();
  let app: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    app = ReactTestRenderer.create(<App />);
  });
  expect(app!.root.findByProps({testID: 'map-webview'})).toBeDefined();
  await ReactTestRenderer.act(async () => app!.unmount());
  jest.clearAllTimers();
  jest.useRealTimers();
});
