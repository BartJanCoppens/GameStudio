import { useEffect, useState } from 'react';
import { Banner, Button, Dialog, Field, Input, LinkButton, SegmentedControl, Table, Textarea } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { canEditGame, createGame, saveDraftOf } from '../../game/games';
import { DESCRIPTION_MAX, GAME_SIZES, errorsFor, generateGame, type GameSize, type Generated } from '../../game/generate';
import { useGameContent } from '../../game/useGameContent';
import { clock, useFinishedRuns } from '../../game/runs';
import { errorMessage } from '../../lib/supabase';
import { PageHead, Screen } from '../../shell/ui';
import { card, flush } from '../../shell/styles';
import { gameColumns, gameRows } from './gameColumns';

const EXAMPLE = 'Expense invoices from hotels, airlines, taxis and restaurants that consultants bring back from business trips in Belgium.';

function NewGameDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (created: Created) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState<GameSize>(8);
  const [busy, setBusy] = useState<null | 'creating' | 'building'>(null);
  const [started, setStarted] = useState(0);
  const [now, setNow] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (busy !== 'building') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const create = async (withAi: boolean) => {
    const t = title.trim(), d = description.trim();
    if (!t) { setError('Give the game a title.'); return; }
    if (withAi && d.length < 10) { setError('Describe the game in a sentence or two, or start from the sample game.'); return; }
    setError(null);
    setBusy('creating');
    let key: string;
    try {
      // The game starts as a copy of the sample, so it is never empty even if the AI step fails.
      key = await createGame(t, withAi ? d.slice(0, 300) : '');
    } catch (e) {
      setError(errorMessage(e));
      setBusy(null);
      return;
    }
    if (!withAi) { onCreated({ key, title: t }); return; }
    setStarted(Date.now());
    setNow(Date.now());
    setBusy('building');
    try {
      const g = await generateGame(key, t, d, size);
      await saveDraftOf(key, g.content);
      onCreated({ key, title: t, generated: g });
    } catch (e) {
      onCreated({ key, title: t, failed: errorMessage(e) });
    }
  };

  const elapsed = Math.max(0, Math.floor((now - started) / 1000));

  return (
    <Dialog
      title="New game"
      subtitle="An invoice audit game grounded in the Belgian VAT source document. Describe it and the AI builds the invoices and the planted errors; refine it in the Studio, then publish."
      onClose={busy ? undefined : onClose}
      width={600}
      footer={busy ? undefined : (
        <>
          <Button variant="primary" size="xl" onClick={() => void create(true)}>Build with AI</Button>
          <Button variant="secondary" size="xl" onClick={() => void create(false)}>Start from the sample game</Button>
          <Button variant="secondary" size="xl" onClick={onClose}>Cancel</Button>
        </>
      )}
    >
      {busy ? (
        <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '6px 0 4px' }}>
          <div style={{ fontWeight: 600 }}>{busy === 'creating' ? 'Creating the game…' : `Building “${title.trim()}” with AI · ${clock(elapsed)}`}</div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--tc-surface-muted)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(95, (elapsed / 70) * 100)}%`, background: 'var(--tc-green)', transition: 'width 1s linear' }} />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--tc-ink-3)' }}>
            Writing {size} invoices and planting {errorsFor(size)} errors, each tied to a passage of the source document. This usually takes about a minute.
            Every invoice and error is checked before it is saved.
          </div>
        </div>
      ) : (
        <>
          {error ? <Banner tone="warning">{error}</Banner> : null}
          <Field label="Title"><Input value={title} onChange={e => setTitle(e.target.value)} autoFocus maxLength={80} placeholder="e.g. Hotel and travel invoices" /></Field>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Field label="Describe the game" hint="What the invoices are about and who plays it">
              <Textarea value={description} onChange={e => setDescription(e.target.value.slice(0, DESCRIPTION_MAX))} rows={4} placeholder={EXAMPLE} />
            </Field>
            <LinkButton size={12} onClick={() => setDescription(EXAMPLE)} style={{ alignSelf: 'flex-start' }}>Use an example</LinkButton>
          </div>
          <Field label="Length" group>
            <SegmentedControl
              options={GAME_SIZES.map(n => ({ value: String(n), label: `${n} invoices · ${errorsFor(n)} errors` }))}
              value={String(size)}
              onChange={v => setSize(Number(v) as GameSize)}
              size="md"
            />
          </Field>
        </>
      )}
    </Dialog>
  );
}

interface Created {
  key: string;
  title: string;
  generated?: Generated;
  /** The AI step failed; the game kept the sample invoices. */
  failed?: string;
}

export function MyGames() {
  const { openGame, set, toast } = useApp();
  const { profile, permissions } = useSignedIn();
  const { games, reloadGames } = useGameContent();
  const { runs } = useFinishedRuns();
  const [creating, setCreating] = useState(false);
  const mine = games.filter(g => canEditGame(g, profile.id, permissions));
  const published = mine.filter(g => g.liveVersion !== null).length;

  return (
    <Screen label="Creator · My games">
      <PageHead
        title="My games"
        lead={`${mine.length} ${mine.length === 1 ? 'game' : 'games'} · ${published} published · grounded in the Belgian VAT Content Domain`}
        actions={permissions.has('games.create') ? <Button variant="primary" size="lg" onClick={() => setCreating(true)}>New game</Button> : undefined}
      />
      <div style={card}>
        <Table columns={gameColumns(key => openGame(key, 'studio'))} rows={gameRows(mine, runs)} rowKey="id" style={flush} />
      </div>
      {creating ? (
        <NewGameDialog
          onClose={() => setCreating(false)}
          onCreated={async ({ key, title, generated, failed }) => {
            await reloadGames();
            setCreating(false);
            openGame(key, 'studio');
            // The conversation that built the game opens in the Studio chat.
            if (generated) {
              set({
                studioChatOpen: true,
                studioChatId: generated.chatId,
                studioChat: [{ role: 'user', text: generated.request }, { role: 'assistant', text: generated.reply, status: 'changes', changes: generated.changes }],
              });
            }
            // A failed AI step stays on screen in the chat, not just in a toast.
            if (failed) set({ studioChatOpen: true, studioChat: [{ role: 'assistant', text: `Building “${title}” with AI didn’t work (${failed}). The game starts from the sample invoices instead; you can change them here or publish it as it is.`, status: 'error' }] });
            toast(failed ? `Created “${title}” from the sample game` : `Created “${title}” · players see it once you publish`);
          }}
        />
      ) : null}
    </Screen>
  );
}
