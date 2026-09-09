import { describe, expect, it, vi } from 'vitest';
import { SESSION_KEY, sessionStore, tokenExpiry } from './session';
import { makeSession } from '../../test/fixtures';

describe('Session storage', () => {
  it('persists only token and public user and restores them', () => {
    const session = makeSession();
    sessionStore.set({ ...session, password: 'never stored', user: { ...session.user, passwordHash: 'private' } } as typeof session);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!)).toEqual(session);
    sessionStore.reload(); expect(sessionStore.getSnapshot().session).toEqual(session);
    sessionStore.clear(); expect(sessionStore.getSnapshot().session).toBeNull(); expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it.each(['invalid-json', 'null', '{}', JSON.stringify({ accessToken: 'bad', user: { id: 'id', email: 'test' } }), JSON.stringify(makeSession(1))])('rejects corrupt or expired persisted session %#', (value) => {
    localStorage.setItem(SESSION_KEY, value); sessionStore.reload();
    expect(sessionStore.getSnapshot().session).toBeNull(); expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
  it('rejects invalid login responses', () => {
    expect(() => sessionStore.set(makeSession(1))).toThrow();
    expect(() => tokenExpiry(`a.${btoa('{"exp":"invalid"}')}.c`)).toThrow();
  });
  it('keeps a newer session after a delayed unauthorized response', () => {
    const newer = makeSession(undefined, 'new'); sessionStore.set(newer);
    sessionStore.clear(true, 'old'); expect(sessionStore.getSnapshot().session).toEqual(newer);
    sessionStore.clear(true, newer.accessToken); expect(sessionStore.getSnapshot()).toEqual({ session: null, expired: true });
  });
  it('works in memory when the browser denies storage access', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    sessionStore.reload(); expect(sessionStore.getSnapshot().session).toBeNull();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    sessionStore.set(makeSession()); expect(sessionStore.getSnapshot().session).not.toBeNull();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    sessionStore.clear(); expect(sessionStore.getSnapshot().session).toBeNull();
  });
});
