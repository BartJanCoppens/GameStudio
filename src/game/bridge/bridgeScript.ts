// The GameStudio script injected into every game, before the game's own code. It is the game's only way
// to reach the platform: each call posts a message to the app and waits for the matching answer.

export const BRIDGE_SCRIPT = `(() => {
  let next = 1;
  const waiting = new Map();
  const matchListeners = [];
  window.addEventListener('message', e => {
    const m = e.data;
    if (e.source !== window.parent || !m || m.source !== 'gamestudio-host') return;
    if (m.event === 'match') { for (const cb of matchListeners) { try { cb(m.value); } catch (_) {} } return; }
    if (!waiting.has(m.id)) return;
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
  // A child frame would bring fresh copies of what is removed below: frames a game inserts are taken out at once.
  try {
    const FRAMES = ['IFRAME', 'FRAME', 'OBJECT', 'EMBED'];
    new MutationObserver(records => {
      for (const r of records) for (const node of r.addedNodes) {
        if (FRAMES.includes(node.nodeName)) node.remove();
        else if (node.querySelectorAll) for (const f of node.querySelectorAll('iframe, frame, object, embed')) f.remove();
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
  // WebRTC can reach the internet and not every browser's content security policy covers it: remove it before the game runs.
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
    getMatch: () => call('getMatch'),
    makeMove: (move, state, opts) => call('makeMove', { move, state, mine: opts && opts.mine, over: opts && opts.over }),
    onMatchChange: cb => { if (typeof cb === 'function') matchListeners.push(cb); },
  });
})();`;
