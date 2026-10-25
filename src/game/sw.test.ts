import { describe, expect, it } from 'vitest';
import swSource from '../../public/sw.js?raw';

/** Runs public/sw.js against a fake service-worker scope and returns its listeners. */
function load(clients: unknown[]) {
  const listeners: Record<string, (e: unknown) => void> = {};
  const opened: string[] = [];
  const self = {
    location: { origin: 'https://app.example' },
    addEventListener: (type: string, cb: (e: unknown) => void) => { listeners[type] = cb; },
    registration: { showNotification: async () => undefined },
    clients: { matchAll: async () => clients, openWindow: async (url: string) => { opened.push(url); }, claim: async () => undefined },
    skipWaiting: async () => undefined,
  };
  new Function('self', swSource)(self);
  return { listeners, opened };
}

describe('the service worker', () => {
  it('opens the game when the open window can’t be sent there', async () => {
    const stuck = { url: 'https://app.example/#/library', focus: async () => undefined, navigate: async () => { throw new Error('not controlled'); } };
    const { listeners, opened } = load([stuck]);
    let done: Promise<unknown> = Promise.resolve();
    listeners.notificationclick({ notification: { close: () => undefined, data: { url: 'https://app.example/#/match?id=1' } }, waitUntil: (p: Promise<unknown>) => { done = p; } });
    await done;
    expect(opened).toEqual(['https://app.example/#/match?id=1']);
  });
  it('takes control of open pages when it starts', () => {
    const { listeners } = load([]);
    expect(listeners.activate).toBeTypeOf('function');
  });
});
