import { describe, expect, it, vi } from 'vitest';
import { ApiError, http, json } from './http';
import { sessionStore } from '../../features/auth/session';
import { makeSession, response, deferred } from '../../test/fixtures';

describe('HTTP client', () => {
  it('adds the current Bearer token and preserves caller headers', async () => {
    const session = makeSession(); sessionStore.set(session);
    const fetch = vi.fn().mockResolvedValue(response({ data: [] })); vi.stubGlobal('fetch', fetch);
    expect(await json('/books', { headers: { Accept: 'application/json' } })).toEqual({ data: [] });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/books'); expect(init.headers.get('Authorization')).toBe(`Bearer ${session.accessToken}`);
    expect(init.headers.get('Accept')).toBe('application/json'); expect(init.headers.has('Content-Type')).toBe(false);
  });
  it('omits Bearer for public login and sends JSON', async () => {
    sessionStore.set(makeSession()); const fetch = vi.fn().mockResolvedValue(response({})); vi.stubGlobal('fetch', fetch);
    await http('/auth/login', { public: true, method: 'POST', body: '{}' });
    expect(fetch.mock.calls[0][1].headers.has('Authorization')).toBe(false);
    expect(fetch.mock.calls[0][1].headers.get('Content-Type')).toBe('application/json');
  });
  it('does not request protected data without a session', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(http('/books')).rejects.toMatchObject({ status: 401 }); expect(fetch).not.toHaveBeenCalled();
  });
  it('expires tokens before sending a request', async () => {
    const session = makeSession(Math.floor(Date.now() / 1000) + 1); sessionStore.set(session);
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 2000);
    await expect(http('/books')).rejects.toMatchObject({ status: 401 }); expect(sessionStore.getSnapshot().session).toBeNull();
  });
  it('clears protected 401 but never displays server error details', async () => {
    sessionStore.set(makeSession()); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ message: 'secret database stack' }, 401)));
    await expect(http('/books')).rejects.toThrow('No se pudo completar la solicitud.'); expect(sessionStore.getSnapshot().expired).toBe(true);
  });
  it('does not clear a new session after an old request fails', async () => {
    const pending = deferred<Response>(); sessionStore.set(makeSession(undefined, 'old'));
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending.promise)); const request = http('/books');
    const newer = makeSession(undefined, 'new'); sessionStore.set(newer); pending.resolve(response({}, 401));
    await expect(request).rejects.toBeInstanceOf(ApiError); expect(sessionStore.getSnapshot().session).toEqual(newer);
  });
  it.each([403, 500])('preserves session and sanitizes error %s', async (status) => {
    sessionStore.set(makeSession()); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ message: 'private' }, status)));
    await expect(http('/books')).rejects.toMatchObject({ status }); expect(sessionStore.getSnapshot().session).not.toBeNull();
  });
  it('handles offline and aborted requests separately', async () => {
    sessionStore.set(makeSession()); const failure = new Error('private'); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));
    await expect(http('/books')).rejects.toMatchObject({ status: 0 });
    const controller = new AbortController(); controller.abort();
    await expect(http('/books', { signal: controller.signal })).rejects.toBe(failure);
  });
});
