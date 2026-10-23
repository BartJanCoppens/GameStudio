import { Button, ChatBubble, FlowNode, LinkButton, SegmentedControl, StatusChip, Tag } from '../../ds';
import { DEFAULT_STUDIO_GAME, DOMAIN_DOCS, DRAFT_QUESTIONS, FLOW_NODES, LEVELS } from '../../data/creator';
import { useApp } from '../../app/useApp';
import { BackLink, Screen } from '../../shell/ui';
import { dot, eyebrow } from '../../shell/styles';

const panel = { background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, overflow: 'hidden' } as const;
const panelHead = { padding: '12px 14px', borderBottom: '1px solid #eef0ea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 } as const;

function AiChat() {
  const { s, set } = useApp();
  const send = () => {
    const t = s.draftText.trim();
    if (!t) return;
    set({
      draftText: '',
      chat: [...s.chat, { role: 'user', text: t }, { role: 'assistant', text: 'Drafted and added to Level 3 as 3.3 · linked to Royal Decree 20, Table A. Review it in Structure.', sources: ['BE VAT Code 2026'] }],
    });
  };
  return (
    <div style={{ flex: '1 1 280px', maxWidth: '100%', background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, display: 'flex', flexDirection: 'column', minHeight: 560 }}>
      <div style={panelHead}>
        <div>Draft with AI</div>
        <SegmentedControl options={[{ value: 'draft', label: 'AI drafts' }, { value: 'assist', label: 'Assist' }]} value={s.aiMode} onChange={aiMode => set({ aiMode })} size="xs" />
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {s.chat.map((m, i) => <ChatBubble key={i} role={m.role} sources={m.sources}>{m.text}</ChatBubble>)}
      </div>
      <div style={{ padding: '12px 14px', borderTop: '1px solid #eef0ea', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          aria-label="Describe a level, a mechanic or a twist"
          value={s.draftText}
          onChange={e => set({ draftText: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
          placeholder="Describe a level, a mechanic or a twist…"
          style={{ width: '100%', minHeight: 64, resize: 'vertical', border: '1px solid #d5dacf', borderRadius: 6, padding: '8px 10px', font: 'inherit', fontSize: 13 }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: '#8b918a' }}>Answers only from Belgian VAT · 4 documents</span>
          <Button variant="dark" size="sm" onClick={send}>Generate</Button>
        </div>
      </div>
    </div>
  );
}

function Structure() {
  const { s, set, toastProto } = useApp();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {LEVELS.map(lv => (
        <div key={lv.n} style={panel}>
          <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #eef0ea', background: '#fafbf8' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#5a6058', width: 60 }}>Level {lv.n}</span>
            <span style={{ fontWeight: 600 }}>{lv.name}</span>
            <span style={{ fontSize: 12, color: '#8b918a' }}>{lv.meta}</span>
            <LinkButton size={12} onClick={toastProto} style={{ marginLeft: 'auto' }}>+ Add question</LinkButton>
          </div>
          {lv.items.map((id, i) => {
            const q = DRAFT_QUESTIONS[id], sel = s.selQ === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={sel}
                onClick={() => set({ selQ: id })}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 16px', border: 'none', borderTop: i ? '1px solid #eef0ea' : 'none',
                  background: sel ? '#f6f9ef' : '#fff', boxShadow: sel ? 'inset 3px 0 0 #86BC25' : 'none', font: 'inherit', fontSize: 13, color: 'inherit', cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 12, color: '#8b918a', width: 28, flex: 'none', fontVariantNumeric: 'tabular-nums', textAlign: 'left' }}>{id}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{q.text}</span>
                <Tag tone={q.grounded ? 'source' : 'amber'}>{q.grounded ? q.sourceLoc : 'Ungrounded'}</Tag>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Flow() {
  const { toast } = useApp();
  return (
    <div style={{ background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, padding: 16, overflow: 'auto' }}>
      <div style={{ fontSize: 12, color: '#5a6058', marginBottom: 10 }}>Flow · Level 1 → Level 4 · branch on score · select a node to see its source</div>
      <div style={{ position: 'relative', width: 900, height: 260 }}>
        <svg width="900" height="260" style={{ position: 'absolute', inset: 0 }} viewBox="0 0 900 260" aria-hidden="true">
          <path d="M172 40 C 200 40, 200 40, 220 40" stroke="#b3b8ae" strokeWidth="1.3" fill="none" />
          <path d="M418 40 C 440 40, 440 40, 440 40 L 440 40 C 450 40, 450 40, 460 40" stroke="#b3b8ae" strokeWidth="1.3" fill="none" />
          <path d="M658 40 C 680 40, 680 40, 700 40" stroke="#4c7a10" strokeWidth="2" fill="none" />
          <path d="M658 40 C 690 40, 670 132, 700 132" stroke="#b3b8ae" strokeWidth="1.3" fill="none" />
          <path d="M418 40 C 450 40, 430 224, 460 224" stroke="#b3b8ae" strokeWidth="1.3" fill="none" />
          <text x="672" y="30" fontSize="10" fill="#4c7a10" fontFamily="IBM Plex Sans">≥ 70%</text>
          <text x="668" y="100" fontSize="10" fill="#6b716a" fontFamily="IBM Plex Sans">&lt; 70%</text>
          <text x="426" y="140" fontSize="10" fill="#6b716a" fontFamily="IBM Plex Sans">timed out</text>
        </svg>
        {FLOW_NODES.map(n => (
          <FlowNode
            key={n.title}
            title={n.title}
            sub={n.sub}
            kind={n.kind}
            state={n.state}
            recent={n.recent}
            width={n.kind === 'profile' ? 172 : 198}
            onClick={() => toast(`${n.title} · ${n.sub}`)}
            style={{ position: 'absolute', left: n.left, top: n.top }}
          />
        ))}
      </div>
    </div>
  );
}

function Preview({ text, options }: { text: string; options: string[] }) {
  return (
    <div style={{ background: '#f3f5f0', border: '1px solid #e1e5dc', borderRadius: 6, padding: 28, display: 'flex', justifyContent: 'center' }}>
      <div style={{ background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, padding: 24, maxWidth: 560, width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={eyebrow}>Question 1 of 3 · 10 points · as the player sees it</div>
        <div style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>{text}</div>
        {options.map(po => <div key={po} style={{ border: '1px solid #d5dacf', borderRadius: 6, padding: '10px 12px' }}>{po}</div>)}
        <div style={{ fontSize: 12, color: '#8b918a' }}>Preview uses v4 draft · timer off</div>
      </div>
    </div>
  );
}

function DomainPanel() {
  const { s, toastProto } = useApp();
  const q = DRAFT_QUESTIONS[s.selQ];
  return (
    <div style={{ flex: '1 1 260px', maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={panel}>
        <div style={panelHead}>
          <div>Content Domain</div>
          <LinkButton size={12} onClick={toastProto}>Change</LinkButton>
        </div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={dot('#86BC25', 8)} />
            <span style={{ fontWeight: 600 }}>Belgian VAT</span>
            <span style={{ fontSize: 12, color: '#8b918a' }}>· indexed 12 Oct</span>
          </div>
          {DOMAIN_DOCS.map(d => (
            <label key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid #eef0ea', cursor: 'pointer' }}>
              {/* Prototype: toggling a document only explains itself; the selection stays as indexed. */}
              <input type="checkbox" checked={d.on} onChange={toastProto} style={{ accentColor: '#86BC25', margin: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                <div style={{ fontSize: 11, color: '#8b918a' }}>{d.kind} · {d.used} questions</div>
              </div>
              <div title={`${d.cov} of questions grounded here`} style={{ width: 44, height: 4, background: '#eef0ec', borderRadius: 2, overflow: 'hidden', flex: 'none' }}>
                <div style={{ height: '100%', background: '#86BC25', width: d.cov }} />
              </div>
            </label>
          ))}
        </div>
      </div>
      <div style={panel}>
        <div style={panelHead}>Grounding · {q.id}</div>
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: '#5a6058' }}>{q.text}</div>
          {q.grounded ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <Tag tone="source">{q.sourceDoc}</Tag>
              <div style={{ fontSize: 12, color: '#8b918a' }}>{q.sourceLoc}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, borderLeft: '2px solid #86BC25', paddingLeft: 10 }}>“{q.passage}”</div>
              <LinkButton size={12} onClick={toastProto}>Open in document →</LinkButton>
            </div>
          ) : (
            <>
              <div style={{ background: '#fdf7e6', border: '1px solid #f0dca3', borderRadius: 6, padding: '10px 12px', fontSize: 12.5, color: '#7a5000' }}>
                No passage in Belgian VAT supports this answer. Link a passage or remove the question before test.
              </div>
              <Button variant="accent" size="sm" onClick={toastProto} style={{ alignSelf: 'flex-start' }}>Find a passage</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function Studio() {
  const { s, set, go, toast } = useApp();
  const game = s.studioGame ?? DEFAULT_STUDIO_GAME;
  const q = DRAFT_QUESTIONS[s.selQ];
  return (
    <Screen label="Creator · Studio" gap={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <BackLink onClick={() => go('games')}>← My games</BackLink>
        <span style={{ color: '#d5dacf' }}>·</span>
        <h1 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2, margin: 0 }}>{game.title}</h1>
        <Tag tone="bundle">{game.domain}</Tag>
        <StatusChip status={game.status} label={game.stage} size="xs" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="md" onClick={() => toast('Saved · v4 draft · 23 Oct 09:58')}>Save</Button>
          <Button variant="dark" size="md" onClick={() => go('workflow')}>Send to test →</Button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' }}>
        <AiChat />
        <div style={{ flex: '2 1 420px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <SegmentedControl
              options={[{ value: 'structure', label: 'Structure' }, { value: 'canvas', label: 'Flow' }, { value: 'preview', label: 'Preview' }]}
              value={s.studioView}
              onChange={studioView => set({ studioView })}
              size="md"
            />
            <div style={{ fontSize: 12, color: '#5a6058' }}>
              {game.structureNote} · 22 grounded · <span style={{ color: '#7a5000', fontWeight: 600 }}>2 ungrounded</span>
            </div>
          </div>
          {s.studioView === 'structure' ? <Structure /> : null}
          {s.studioView === 'canvas' ? <Flow /> : null}
          {s.studioView === 'preview' ? <Preview text={q.text} options={q.options} /> : null}
        </div>
        <DomainPanel />
      </div>
    </Screen>
  );
}
