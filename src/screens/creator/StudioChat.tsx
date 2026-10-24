import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button, ChatBubble, FilterChip, LinkButton, Select } from '../../ds';
import { useApp, type StudioChatEntry } from '../../app/useApp';
import { callFunction, errorMessage, supabase } from '../../lib/supabase';
import { GAME, type GameContent } from '../../game/content';
import { useGameContent } from '../../game/useGameContent';
import { applyOperations } from '../../game/ops';
import type { ChatAnswer } from '../../game/generate';

interface SavedChat {
  id: string;
  title: string;
  updated_at: string;
}

interface SavedMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  status: StudioChatEntry['status'] | null;
  changes: string[];
  skipped: string[];
}

const MAX_MESSAGE = 2000;
const SUGGESTIONS = [
  'Add an invoice where the date of supply is missing',
  'Make invoice 6 harder without adding an error',
  'Which errors will players find easiest?',
  'Replace invoice 2 with a reverse-charge invoice that is correct',
];

async function fetchChats(gameKey: string): Promise<SavedChat[]> {
  const { data } = await supabase.from('studio_chats').select('id, title, updated_at').eq('game_key', gameKey).order('updated_at', { ascending: false }).limit(30).returns<SavedChat[]>();
  return data ?? [];
}

async function fetchMessages(chatId: string): Promise<StudioChatEntry[]> {
  const { data } = await supabase.from('studio_chat_messages').select('id, role, text, status, changes, skipped').eq('chat_id', chatId).order('id').returns<SavedMessage[]>();
  return (data ?? []).map(m => ({ id: m.id, role: m.role, text: m.text, status: m.status ?? undefined, changes: m.changes, skipped: m.skipped }));
}

const panel = { background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6 } as const;

/** Collapsed: a slim rail that opens the chat again, like the claude.ai sidebar. */
function Rail({ pending, onOpen }: { pending: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open AI chat"
      title="Open AI chat"
      style={{ ...panel, width: 44, minHeight: 560, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer', font: 'inherit', color: '#5a6058', position: 'sticky', top: 78 }}
    >
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>»</span>
      <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase' }}>Draft with AI</span>
      {pending ? <span title="Unsaved AI changes" style={{ width: 8, height: 8, borderRadius: '50%', background: '#e0a100' }} /> : null}
    </button>
  );
}

export function StudioChat({ base, onProposal }: { base: GameContent; onProposal: (touched: number[]) => void }) {
  const { s, set } = useApp();
  const { game } = useGameContent();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [chats, setChats] = useState<SavedChat[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [s.studioChat.length, busy]);
  useEffect(() => {
    let cancelled = false;
    fetchChats(game.key).then(c => { if (!cancelled) setChats(c); });
    return () => { cancelled = true; };
  }, [game.key]);

  const open = async (chatId: string | null) => {
    set({ studioChatId: chatId, studioChat: chatId ? await fetchMessages(chatId) : [] });
  };
  const removeChat = async () => {
    if (!s.studioChatId) return;
    await supabase.from('studio_chats').delete().eq('id', s.studioChatId);
    set({ studioChatId: null, studioChat: [] });
    setChats(await fetchChats(game.key));
  };

  if (!s.studioChatOpen) return <Rail pending={Boolean(s.studioPending)} onOpen={() => set({ studioChatOpen: true })} />;

  const send = async (message: string) => {
    const msg = message.trim();
    if (!msg || busy) return;
    set(prev => ({ studioChat: [...prev.studioChat, { role: 'user', text: msg }] }));
    setText('');
    setBusy(true);
    try {
      // The server keeps the conversation; the model sees the draft as it stands, including unsaved changes.
      const answer = await callFunction<ChatAnswer>('studio-chat', { game_key: game.key, chat_id: s.studioChatId, message: msg, draft: base });
      const applied = answer.status === 'changes' ? applyOperations(base, answer.operations) : null;
      // Record on the saved message what was applied and skipped, so the history says so too.
      if (applied && answer.message_id) await supabase.from('studio_chat_messages').update({ changes: applied.changes, skipped: applied.skipped }).eq('id', answer.message_id);
      const entry: StudioChatEntry = { id: answer.message_id ?? undefined, role: 'assistant', text: answer.reply, status: answer.status, changes: applied?.changes, skipped: applied?.skipped };
      set(prev => ({
        studioChatId: answer.chat_id,
        studioChat: [...prev.studioChat, entry],
        ...(applied && applied.changes.length
          ? { studioPending: { content: applied.content, touched: applied.touched, count: (prev.studioPending?.count ?? 0) + applied.changes.length } }
          : {}),
      }));
      if (applied?.touched.length) onProposal(applied.touched);
    } catch (e) {
      set(prev => ({ studioChat: [...prev.studioChat, { role: 'assistant', text: errorMessage(e), status: 'error' }] }));
      // A first message that failed still started a saved chat: pick it up so the next message continues it.
      if (!s.studioChatId) {
        const latest = await fetchChats(game.key);
        setChats(latest);
        if (latest[0] && latest[0].title === msg.slice(0, 80)) set({ studioChatId: latest[0].id });
      }
    } finally {
      setBusy(false);
      setChats(await fetchChats(game.key));
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(text); }
  };

  return (
    <section aria-label="Draft with AI" style={{ ...panel, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)', minHeight: 520, position: 'sticky', top: 78 }}>
      <div style={{ padding: '10px 10px 10px 14px', borderBottom: '1px solid #eef0ea', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontWeight: 600, flex: 1 }}>Draft with AI</div>
        {s.studioChat.length ? <Button variant="secondary" size="sm" onClick={() => void open(null)} disabled={busy}>New chat</Button> : null}
        <button
          type="button"
          onClick={() => set({ studioChatOpen: false })}
          aria-label="Collapse AI chat"
          title="Collapse AI chat"
          style={{ width: 30, height: 30, border: '1px solid #d5dacf', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#5a6058', font: 'inherit', fontSize: 15, lineHeight: 1 }}
        >
          «
        </button>
      </div>

      {chats.length ? (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #eef0ea', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Select
            size="md"
            aria-label="Earlier chats"
            value={s.studioChatId ?? ''}
            onChange={e => void open(e.target.value || null)}
            disabled={busy}
            options={[{ value: '', label: s.studioChatId ? '+ New chat' : 'New chat · earlier chats ▾' }, ...chats.map(c => ({ value: c.id, label: `${c.title || 'Untitled'} · ${new Date(c.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` }))]}
            style={{ flex: 1, minWidth: 0 }}
          />
          {s.studioChatId ? <LinkButton size={12} tone="muted" onClick={() => void removeChat()} disabled={busy}>Delete</LinkButton> : null}
        </div>
      ) : null}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!s.studioChat.length ? (
          <>
            <ChatBubble role="assistant" sources={[GAME.source]}>
              Tell me how to change {game.title}: add or rework invoices, plant or remove errors, make it harder or easier. I only work on this game, and every error must rest on a rule from the source document. Changes show in the preview first; nothing is saved until you keep them.
            </ChatBubble>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SUGGESTIONS.map(q => <FilterChip key={q} onClick={() => void send(q)} style={{ whiteSpace: 'normal', height: 'auto', padding: '6px 12px', textAlign: 'left' }}>{q}</FilterChip>)}
            </div>
          </>
        ) : null}
        {s.studioChat.map((e, i) => (
          <ChatBubble key={i} role={e.role} style={e.status === 'error' ? { background: '#fbe9e7', color: '#9a2b22' } : e.status === 'out_of_scope' ? { background: '#fdf7e6', color: '#7a5000' } : undefined}>
            {e.text}
            {e.changes?.length ? (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12.5 }}>
                {e.changes.map(c => <li key={c}>{c}</li>)}
              </ul>
            ) : null}
            {e.skipped?.length ? (
              <div style={{ marginTop: 8, fontSize: 12, color: '#7a5000' }}>
                Skipped, because it doesn’t fit the game:
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{e.skipped.map(c => <li key={c}>{c}</li>)}</ul>
              </div>
            ) : null}
          </ChatBubble>
        ))}
        {busy ? <ChatBubble role="assistant"><span style={{ color: '#5a6058' }}>Claude is drafting…</span></ChatBubble> : null}
        <div ref={end} />
      </div>

      <div style={{ padding: '10px 12px 12px', borderTop: '1px solid #eef0ea', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          aria-label="Message Claude about this game"
          value={text}
          onChange={e => setText(e.target.value.slice(0, MAX_MESSAGE))}
          onKeyDown={onKey}
          placeholder="Describe an invoice, an error or a change…"
          disabled={busy}
          rows={3}
          style={{ width: '100%', resize: 'none', border: '1px solid #d5dacf', borderRadius: 6, padding: '8px 10px', font: 'inherit', fontSize: 13 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, fontSize: 11.5, color: '#8b918a' }}>Only edits this game · grounded in {GAME.source}</span>
          <Button variant="dark" size="sm" onClick={() => void send(text)} disabled={busy || !text.trim()}>Send</Button>
        </div>
      </div>
    </section>
  );
}
