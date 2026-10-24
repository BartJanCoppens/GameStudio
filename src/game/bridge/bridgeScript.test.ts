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
