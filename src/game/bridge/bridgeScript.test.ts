import { describe, expect, it } from 'vitest';
import { BRIDGE_SCRIPT } from './bridgeScript';

describe('the injected bridge', () => {
  it('removes WebRTC before game code runs (the content security policy doesn’t cover it)', () => {
    const fake: Record<string, unknown> = { RTCPeerConnection: class {}, webkitRTCPeerConnection: class {}, RTCDataChannel: class {}, addEventListener: () => {}, parent: { postMessage: () => {} } };
    new Function('window', BRIDGE_SCRIPT)(fake);
    expect(fake.RTCPeerConnection).toBeUndefined();
    expect(fake.webkitRTCPeerConnection).toBeUndefined();
    expect(fake.RTCDataChannel).toBeUndefined();
    expect(fake.GameStudio).toBeDefined();
  });
});

describe('nested frames at runtime', () => {
  it('removes frames a game inserts', () => {
    let callback: ((records: { addedNodes: unknown[] }[]) => void) | null = null;
    const removed: string[] = [];
    const fake: Record<string, unknown> = {
      addEventListener: () => {}, parent: { postMessage: () => {} }, document: { documentElement: {} },
      MutationObserver: class { constructor(cb: typeof callback) { callback = cb; } observe() {} },
    };
    new Function('window', 'document', 'MutationObserver', BRIDGE_SCRIPT)(fake, fake.document, fake.MutationObserver);
    const frame = { nodeName: 'IFRAME', remove: () => removed.push('iframe'), querySelectorAll: () => [] };
    const div = { nodeName: 'DIV', remove: () => removed.push('div'), querySelectorAll: () => [{ nodeName: 'EMBED', remove: () => removed.push('embed') }] };
    callback!([{ addedNodes: [frame, div] }]);
    expect(removed).toEqual(['iframe', 'embed']);
  });
});

describe('turn-taking calls', () => {
  it('exposes getMatch, makeMove and onMatchChange, and delivers match events', () => {
    const posted: unknown[] = [];
    let listener: ((e: { source: unknown; data: unknown }) => void) | null = null;
    const parent = { postMessage: (m: unknown) => posted.push(m) };
    const fake: Record<string, unknown> = { addEventListener: (_: string, cb: typeof listener) => { listener = cb; }, parent };
    new Function('window', BRIDGE_SCRIPT)(fake);
    const gs = fake.GameStudio as { getMatch: () => Promise<unknown>; makeMove: (m: unknown, s: unknown, o?: unknown) => Promise<unknown>; onMatchChange: (cb: (v: unknown) => void) => void };
    void gs.getMatch();
    void gs.makeMove({ shot: 'C3' }, { n: 1 }, { mine: { ships: 'B5' }, over: { winner: 'a' } });
    expect(posted).toEqual([
      { source: 'gamestudio', id: 1, type: 'getMatch' },
      { source: 'gamestudio', id: 2, type: 'makeMove', move: { shot: 'C3' }, state: { n: 1 }, mine: { ships: 'B5' }, over: { winner: 'a' } },
    ]);
    const seen: unknown[] = [];
    gs.onMatchChange(v => seen.push(v));
    listener!({ source: parent, data: { source: 'gamestudio-host', event: 'match', value: { turn: 'a' } } });
    listener!({ source: {}, data: { source: 'gamestudio-host', event: 'match', value: { turn: 'x' } } });
    expect(seen).toEqual([{ turn: 'a' }]);
  });
});

