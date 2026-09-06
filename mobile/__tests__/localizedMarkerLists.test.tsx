import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { MeScreen } from '../src/screens/MeScreen';
import { setLanguagePreference } from '../src/i18n/language';

jest.mock('../src/auth/AuthProvider', () => ({
  useAuth: () => ({
    user: { publicId: 'member-1', username: 'member' },
    isLoggedIn: true,
    loading: false,
  }),
}));
const response = (data: unknown): Response =>
  ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
  } as Response);

test('personal point lists clear the old locale and discard a late response after a switch', async () => {
  const pending: {
    url: string;
    signal: AbortSignal;
    resolve: (value: Response) => void;
  }[] = [];
  jest
    .mocked(fetch)
    .mockReset()
    .mockImplementation(
      (url, init) =>
        new Promise(resolve => {
          pending.push({ url: String(url), signal: init!.signal!, resolve });
        }),
    );
  let screen: ReactTestRenderer.ReactTestRenderer | undefined;
  await setLanguagePreference('zh');
  try {
    await ReactTestRenderer.act(async () => {
      screen = ReactTestRenderer.create(<MeScreen panel="created" />);
    });
    expect(pending).toHaveLength(2);
    await ReactTestRenderer.act(async () => {
      await setLanguagePreference('en');
    });
    expect(pending[0].signal.aborted).toBe(true);
    expect(pending[1].signal.aborted).toBe(true);
    expect(pending[2].url).toMatch(/\/me\/created\?lang=en$/);
    expect(pending[3].url).toMatch(/\/favorites\/details\?lang=en$/);
    const row = { id: 1, lat: 22, lng: 114, category: 'accessible_toilet' };
    await ReactTestRenderer.act(async () => {
      pending[2].resolve(response([{ ...row, title: 'English contribution' }]));
      pending[3].resolve(response([]));
      pending[0].resolve(
        response([{ ...row, title: 'Stale Chinese contribution' }]),
      );
      pending[1].resolve(response([]));
    });
    const rendered = JSON.stringify(screen!.toJSON());
    expect(rendered).toContain('English contribution');
    expect(rendered).toContain('Accessible toilet');
    expect(rendered).toContain('My contributions');
    expect(rendered).not.toContain('Stale Chinese contribution');
  } finally {
    await ReactTestRenderer.act(async () => screen?.unmount());
    await setLanguagePreference('zh');
  }
});
