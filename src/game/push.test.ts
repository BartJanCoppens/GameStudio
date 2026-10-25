import { describe, expect, it } from 'vitest';
import { enablePush, type PushEnv } from './push';

const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } };
function env(over: Partial<PushEnv> = {}): PushEnv & { saved: unknown[] } {
  const saved: unknown[] = [];
  return {
    supported: true, ios: false, installed: false,
    requestPermission: async () => 'granted', subscribe: async () => sub, save: async s => { saved.push(s); },
    saved, ...over,
  };
}

describe('enablePush', () => {
  it('says so when the browser can’t do push', async () => expect(await enablePush(env({ supported: false }), 'key')).toBe('unsupported'));
  it('asks iPhone users to add the app to the home screen first', async () => expect(await enablePush(env({ ios: true, installed: false, supported: false }), 'key')).toBe('needs-install'));
  it('respects a refusal', async () => {
    const e = env({ requestPermission: async () => 'denied' });
    expect(await enablePush(e, 'key')).toBe('denied');
    expect(e.saved).toEqual([]);
  });
  it('saves the device when allowed', async () => {
    const e = env({ ios: true, installed: true });
    expect(await enablePush(e, 'key')).toBe('on');
    expect(e.saved).toEqual([sub]);
  });
  it('needs the public key', async () => expect(await enablePush(env(), '')).toBe('unsupported'));
});
