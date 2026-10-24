// The GameStudio script injected into every game, before the game's own code. It is the game's only way
// to reach the platform: each call posts a message to the app and waits for the matching answer.

export const BRIDGE_SCRIPT = `(() => {
  let next = 1;
  const waiting = new Map();
  window.addEventListener('message', e => {
    const m = e.data;
    if (e.source !== window.parent || !m || m.source !== 'gamestudio-host' || !waiting.has(m.id)) return;
    const { resolve, reject } = waiting.get(m.id);
    waiting.delete(m.id);
    m.ok ? resolve(m.value) : reject(new Error(m.error));
  });
  const call = (type, payload) => new Promise((resolve, reject) => {
    const id = next++;
    waiting.set(id, { resolve, reject });
    window.parent.postMessage(Object.assign({ source: 'gamestudio', id, type }, payload || {}), '*');
  });
  // A game never opens windows: there is nowhere for it to go.
  try { window.open = () => null; } catch (_) {}
  // WebRTC can reach the internet and the content security policy doesn't cover it: remove it before the game runs.
  for (const name of ['RTCPeerConnection', 'webkitRTCPeerConnection', 'RTCDataChannel', 'RTCSessionDescription', 'RTCIceCandidate']) {
    try { delete window[name]; } catch (_) {}
    try { window[name] = undefined; } catch (_) {}
  }
  window.GameStudio = Object.freeze({
    ready: () => call('ready'),
    getData: () => call('getData'),
    getPlayer: () => call('getPlayer'),
    getLeaderboard: () => call('getLeaderboard'),
    getGoal: () => call('getGoal'),
    getSources: () => call('getSources'),
    submitScore: (score, details) => call('submitScore', { score, details }),
    contribute: (amount, note) => call('contribute', { amount, note }),
    askAI: ({ messages, state } = {}) => call('askAI', { messages, state }),
    finish: () => call('finish'),
  });
})();`;
