import { strToU8, zipSync } from 'fflate';
import { BRIDGE_API } from '../../supabase/functions/_shared/gameModel.ts';
import { buildSrcdoc } from './bridge/srcdoc';
import { PASSAGES, type GameContent } from './content';

// Export: a game's code base as a zip, to take it beyond the platform. It runs on its own with a local
// stand-in for the platform (scores in memory, a placeholder for AI replies). The AI role's hidden
// knowledge stays on the platform.

const localBridge = (data: unknown, sources: unknown) => `(() => {
  // Local stand-in for the Game Studio platform. Replace these with calls to your own backend.
  const scores = [];
  const goal = { total: 0 };
  window.GameStudio = {
    ready: async () => true,
    getData: async () => ${JSON.stringify(data)},
    getPlayer: async () => ({ name: 'Player' }),
    getLeaderboard: async () => scores.slice().sort((a, b) => b.score - a.score).slice(0, 10).map((s, i) => ({ rank: i + 1, name: s.name, score: s.score })),
    getGoal: async () => ({ ...(window.__goal || { description: '', target: 0, unit: '' }), total: goal.total }),
    getSources: async () => ${JSON.stringify(sources)},
    submitScore: async (score, details) => { scores.push({ name: 'Player', score, details }); return { saved: false }; },
    contribute: async amount => { goal.total += amount; return { counted: false }; },
    askAI: async () => ({ say: '(AI replies need the platform)', quotes: [], action: null, mood: null }),
    finish: async () => true,
  };
})();`;

function readme(title: string, content: GameContent): string {
  const c = content.concept!;
  return `# ${title}

${c.pitch}

Exported from Game Studio. Open \`index.html\` in a browser to play it with a local stand-in for the platform.

## Files

- \`index.html\`: the game, ready to open (screens, styles, the local stand-in and the game logic in one page).
- \`game.js\`, \`style.css\`: the game logic and extra styles, as separate files to work on.
- \`data.json\`: the game's content (levels, questions, cases…), read with \`GameStudio.getData()\`.
- \`concept.json\`: the approved design: rules, scoring, play mode, AI role, look.
- \`sources.json\`: the source passages the game rests on.

## The platform API

On Game Studio the game talks to the platform only through \`window.GameStudio\`. The exported page replaces it with a local stand-in; wire these calls to your own backend to keep scores, goals and AI replies:

${BRIDGE_API}
${c.aiRole ? `\nThis game gives the AI a role (${c.aiRole.kind === 'opponent' ? 'opponent' : 'game master'}: ${c.aiRole.description}). Its hidden knowledge stays on Game Studio and is not part of this export; \`askAI\` returns a placeholder until you connect a model.\n` : ''}
## Once it leaves the platform

On Game Studio the game runs in a sealed-off frame (no network, no storage, no navigation) and was checked against the platform's house rules before it could be published. This copy is no longer protected by either: whoever runs or changes it is responsible for keeping it safe and within your organisation's rules.
`;
}

export function exportZipBytes(game: { key: string; title: string }, content: GameContent): Uint8Array {
  const c = content.concept;
  if (!c || !content.files?.['index.html']) throw new Error('Build the game before exporting it');
  const sources = PASSAGES.filter(p => c.sources.includes(p.id)).map(p => ({ id: p.id, heading: p.heading, loc: p.loc, text: p.text }));
  const page = buildSrcdoc(content.files, { fontsCss: '' })
    .replace(/<script>\(\(\) => \{\n  let next = 1;[\s\S]*?\}\)\(\);<\/script>/, `<script>window.__goal = ${JSON.stringify(c.goal)};\n${localBridge(content.data ?? null, sources)}</script>`);
  const json = (v: unknown) => strToU8(JSON.stringify(v, null, 2));
  return zipSync({
    'index.html': strToU8(page),
    'game.js': strToU8(content.files['game.js'] ?? ''),
    'style.css': strToU8(content.files['style.css'] ?? ''),
    'data.json': json(content.data ?? null),
    'concept.json': json(c),
    'sources.json': json(sources),
    'README.md': strToU8(readme(c.title || game.title, content)),
  });
}

/** Downloads <game-key>.zip. */
export function exportGame(game: { key: string; title: string }, content: GameContent): void {
  const bytes = exportZipBytes(game, content);
  const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${game.key}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
