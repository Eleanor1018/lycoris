import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {NativeModules} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AuthProvider, useAuth} from '../src/auth/AuthProvider';
import {requestJson} from '../src/lib/http';
import {SESSION_EXPIRED_MESSAGE} from '../src/lib/session';

const user = {publicId: 'member-1', username: 'member', email: 'member@example.test'};
const response = (status: number, data: unknown): Response => ({
  ok: status >= 200 && status < 300,
  status,
  headers: new Headers({'content-type': 'application/json'}),
  json: async () => data,
  text: async () => JSON.stringify(data),
} as Response);
const fetchMock = jest.mocked(fetch);
const clearCookies = NativeModules.Networking.clearCookies as jest.Mock;
let auth: ReturnType<typeof useAuth>;
let provider: ReactTestRenderer.ReactTestRenderer | null;

function SessionProbe() {
  auth = useAuth();
  return null;
}

beforeEach(async () => {
  fetchMock.mockReset();
  clearCookies.mockClear().mockImplementation(callback => callback(true));
  await AsyncStorage.clear();
  fetchMock.mockResolvedValueOnce(response(200, {data: user}));
  await ReactTestRenderer.act(async () => {
    provider = ReactTestRenderer.create(<AuthProvider><SessionProbe /></AuthProvider>);
  });
  expect(auth.isLoggedIn).toBe(true);
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => provider?.unmount());
  provider = null;
});

test('a protected 401 clears the user, cached profile and native cookies and explains re-login', async () => {
  fetchMock.mockResolvedValueOnce(response(401, {message: 'unauthorized'}));
  await ReactTestRenderer.act(async () => {
    await expect(requestJson('/api/markers', {method: 'POST', body: '{}'})).rejects.toMatchObject({status: 401});
  });
  expect(auth.isLoggedIn).toBe(false);
  expect(auth.user).toBeNull();
  expect(auth.sessionNotice).toBe(SESSION_EXPIRED_MESSAGE);
  expect(await AsyncStorage.getItem('lycoris.auth.user.v1')).toBeNull();
  expect(clearCookies).toHaveBeenCalledTimes(1);
});

test('bad login credentials do not invalidate an existing session', async () => {
  fetchMock.mockResolvedValueOnce(response(401, {message: 'wrong password'}));
  await ReactTestRenderer.act(async () => {
    await expect(auth.login('member', 'wrong-password')).rejects.toMatchObject({status: 401, message: 'wrong password'});
  });
  expect(auth.user).toMatchObject(user);
  expect(clearCookies).not.toHaveBeenCalled();
  expect(auth.sessionNotice).toBe('');
});

test.each([
  ['/api/markers/71/image', 'POST', 403],
  ['/api/markers/public', 'GET', 401],
  ['/api/users/member-1/avatar', 'GET', 401],
])('%s %s status %i does not sign out the user', async (path, method, status) => {
  fetchMock.mockResolvedValueOnce(response(status as number, {message: 'unavailable'}));
  await ReactTestRenderer.act(async () => {
    await expect(requestJson(path as string, {method: method as string})).rejects.toMatchObject({status});
  });
  expect(auth.user).toMatchObject(user);
  expect(clearCookies).not.toHaveBeenCalled();
});

test('a late 401 from the previous session cannot sign out a new login', async () => {
  let resolveOld!: (value: Response) => void;
  fetchMock.mockReturnValueOnce(new Promise(resolve => { resolveOld = resolve; }));
  const oldRequest = requestJson('/api/markers/me/favorites');
  const newUser = {...user, publicId: 'member-2', username: 'other'};
  fetchMock.mockResolvedValueOnce(response(200, {data: newUser}));
  await ReactTestRenderer.act(async () => auth.login('other', 'new-password'));
  await ReactTestRenderer.act(async () => {
    resolveOld(response(401, {message: 'old session expired'}));
    await expect(oldRequest).rejects.toMatchObject({status: 401});
  });
  expect(auth.user).toMatchObject(newUser);
  expect(clearCookies).not.toHaveBeenCalled();
});

test('a new login waits for pending native cookie cleanup to finish', async () => {
  let finishClear!: () => void;
  clearCookies.mockImplementation(callback => { finishClear = () => callback(true); });
  fetchMock.mockResolvedValueOnce(response(401, {}));
  await ReactTestRenderer.act(async () => {
    await expect(requestJson('/api/me')).rejects.toMatchObject({status: 401});
  });
  const callsBeforeLogin = fetchMock.mock.calls.length;
  fetchMock.mockResolvedValueOnce(response(200, {data: user}));
  await ReactTestRenderer.act(async () => {
    const login = auth.login('member', 'password');
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeLogin);
    finishClear();
    await login;
  });
  expect(auth.isLoggedIn).toBe(true);
  expect(auth.sessionNotice).toBe('');
});

test('an old request failing during login cannot schedule cookie cleanup for that login', async () => {
  let finishOld!: (value: Response) => void;
  let finishLogin!: (value: Response) => void;
  fetchMock.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }));
  const oldRequest = requestJson('/api/markers/me/favorites');
  fetchMock.mockReturnValueOnce(new Promise(resolve => { finishLogin = resolve; }));
  await ReactTestRenderer.act(async () => {
    const login = auth.login('member', 'password');
    await Promise.resolve();
    finishOld(response(401, {}));
    await expect(oldRequest).rejects.toMatchObject({status: 401});
    expect(clearCookies).not.toHaveBeenCalled();
    finishLogin(response(200, {data: user}));
    await login;
  });
  expect(auth.isLoggedIn).toBe(true);
});
