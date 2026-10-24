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
