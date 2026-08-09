/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import {nearbyCategories, nearbyCategoryLabel} from '../src/screens/MapScreen';

test('renders the app shell with the default map route', async () => {
  let renderer: ReactTestRenderer.ReactTestRenderer | undefined;

  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });

  expect(renderer?.root.findByProps({testID: 'map-webview'})).toBeTruthy();
  expect(nearbyCategories).toContain('baby_room');
  expect(nearbyCategoryLabel.accessible_toilet).toBe('Accessible Restroom');
  expect(nearbyCategoryLabel.friendly_clinic).toBe('Trans-Friendly Clinic');
  expect(nearbyCategoryLabel.baby_room).toBe('Nursing Room');
  expect(nearbyCategories).not.toContain('conversion_therapy');

  await ReactTestRenderer.act(() => {
    renderer?.unmount();
  });
});
