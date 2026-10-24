import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Banner, Button, ChatBubble } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { DEFAULT_TOKENS } from '../../../supabase/functions/_shared/design.ts';
import type { GameContent } from '../../game/content';
import { MockupFrame } from '../../game/GameFrame';
import { useArchitect } from '../../game/studio/useArchitect';
import { useGameContent } from '../../game/useGameContent';
import { BackLink, Screen } from '../../shell/ui';
import { card } from '../../shell/styles';
import { LookDialog } from './LookDialog';
import { ConceptCard } from './studio/ConceptCard';
import { PhaseBar } from './studio/PhaseBar';
import { QuestionCard } from './studio/QuestionCard';

const MESSAGE_MAX = 2000;

/** "Thinking… 0:07": the AI is working, and for how long. */
export function Elapsed({ since, label }: { since: number; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return <div role="status" style={{ fontSize: 12.5, color: 'var(--tc-ink-3)' }}>{label} {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</div>;
}

function Conversation({ content, architect }: { content: GameContent; architect: ReturnType<typeof useArchitect> }) {
  const [text, setText] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const { busy, since, error } = architect;
  const last = content.brief[content.brief.length - 1];
  const asking = content.phase === 'questions' && last?.role === 'ai' && !last.declined && !!last.choices?.length;
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [content.brief.length, busy]);

  const send = (t: string) => { const msg = t.trim(); if (!msg || busy) return; setText(''); void architect.send(msg); };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } };
  const open = content.phase === 'questions' || content.phase === 'design';

  return (
    <section aria-label="Conversation" style={{ ...card, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 170px)', minHeight: 520, position: 'sticky', top: 78 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--tc-line-hair)', fontWeight: 600 }}>Design with AI</div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {content.brief.map((t, i) => {
          if (t === last && asking) return <QuestionCard key={i} turn={t} disabled={!!busy} onAnswer={send} />;
          if (t.declined) return <div key={i} role="status" aria-label="Declined"><Banner tone="warning">{t.text}</Banner></div>;
          return <ChatBubble key={i} role={t.role === 'creator' ? 'user' : 'assistant'}>{t.text}</ChatBubble>;
        })}
        {busy ? <Elapsed since={since} label={busy === 'designing' ? 'Designing your game…' : 'Thinking…'} /> : null}
        {error ? (
          <Banner tone="warning" actions={<Button variant="secondary" size="sm" onClick={architect.retry}>Try again</Button>}>{error}</Banner>
        ) : null}
        <div ref={end} />
      </div>
      {open ? (
        <div style={{ borderTop: '1px solid var(--tc-line-hair)', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            aria-label="Message the AI about this game"
            value={text}
            onChange={e => setText(e.target.value.slice(0, MESSAGE_MAX))}
            onKeyDown={onKey}
            placeholder={content.phase === 'design' ? 'Ask for a change: “make it a team effort”, “darker colours”…' : 'Type an answer or anything you want…'}
            disabled={!!busy}
            rows={3}
            style={{ resize: 'none', border: '1px solid var(--tc-line)', borderRadius: 6, padding: '8px 10px', font: 'inherit', fontSize: 13 }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {content.phase === 'questions' && content.brief.some(t => t.role === 'ai' && !t.declined) ? (
              <Button variant="secondary" size="sm" onClick={() => void architect.proposeNow()} disabled={!!busy}>Propose now</Button>
            ) : null}
            <Button variant="primary" size="sm" onClick={() => send(text)} disabled={!!busy || !text.trim()}>Send</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Stage({ content, architect, onLook }: { content: GameContent; architect: ReturnType<typeof useArchitect>; onLook: () => void }) {
  if (content.phase === 'questions') {
    const idea = content.brief.find(t => t.role === 'creator')?.text;
    return (
      <div style={{ ...card, padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--tc-ink-4)' }}>Your idea</div>
        <div style={{ fontSize: 18, lineHeight: 1.4 }}>{idea ?? '—'}</div>
        <div style={{ color: 'var(--tc-ink-3)' }}>Answer the AI’s questions on the left. It then proposes a game here: the concept and a picture of the main screen.</div>
      </div>
    );
  }
  if (!content.concept) return null;
  if (content.phase === 'design') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: 14, alignItems: 'start' }}>
          <ConceptCard concept={content.concept} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--tc-ink-4)' }}>Main screen · mock-up</div>
            {content.mockup ? <MockupFrame html={content.mockup} height={460} /> : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="lg" onClick={onLook} disabled={!!architect.busy}>Change look</Button>
          <Button variant="primary" size="lg" onClick={() => void architect.approveDesign()} disabled={!!architect.busy}>Approve design · build it</Button>
        </div>
      </div>
    );
  }
  return <Banner tone="info">The design is approved. Building comes next.</Banner>;
}

export function Studio() {
  const { go } = useApp();
  const { profile } = useSignedIn();
  const { game, draft, loading } = useGameContent();
  const architect = useArchitect();
  const [choosingLook, setChoosingLook] = useState(false);

  if (!game) {
    return (
      <Screen label="Creator · Studio">
        <Banner tone="info">{loading ? 'Loading…' : 'Start a game from My games.'}</Banner>
        <div><Button variant="primary" size="lg" onClick={() => go('games')}>My games</Button></div>
      </Screen>
    );
  }
  if (!draft) {
    return (
      <Screen label="Creator · Studio">
        <Banner tone="info">Only the creator of {game.title} can edit it. Open one of your games from My games.</Banner>
      </Screen>
    );
  }
  const content = draft.content;

  return (
    <Screen label="Creator · Studio" gap={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <BackLink onClick={() => go('games')}>← My games</BackLink>
        <span style={{ color: 'var(--tc-line)' }}>·</span>
        <h1 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2, margin: 0 }}>{content.concept?.title ?? game.title}</h1>
        <div style={{ marginLeft: 'auto' }}><PhaseBar phase={content.phase} /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,360px) minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
        <Conversation content={content} architect={architect} />
        <Stage content={content} architect={architect} onLook={() => setChoosingLook(true)} />
      </div>
      {choosingLook && content.concept ? (
        <LookDialog
          gameKey={game.key}
          gameTitle={content.concept.title}
          current={{ id: null, name: content.concept.look.name, tokens: content.concept.look.tokens }}
          userId={profile.id}
          onClose={() => setChoosingLook(false)}
          onApply={async design => {
            await architect.setLook(design ? { name: design.name, tokens: design.tokens } : { name: 'TaxConnect', tokens: DEFAULT_TOKENS });
            setChoosingLook(false);
          }}
        />
      ) : null}
    </Screen>
  );
}
