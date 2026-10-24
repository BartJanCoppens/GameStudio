import { useState } from 'react';
import { Banner, Button, Dialog, SegmentedControl, StatusChip, Tag } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { errorMessage } from '../../lib/supabase';
import { GAME, PASSAGES, RULES, errorsOn, passageOfError, ruleById } from '../../game/content';
import { fieldName } from '../../game/fields';
import { InvoicePaper, type FieldMark } from '../../game/InvoicePaper';
import { useGameContent } from '../../game/useGameContent';
import { BackLink, Screen } from '../../shell/ui';
import { card } from '../../shell/styles';
import { StudioChat } from './StudioChat';

const panelHead = { padding: '12px 14px', borderBottom: '1px solid #eef0ea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 } as const;

export function Studio() {
  const { s, set, go, toast } = useApp();
  const { permissions } = useSignedIn();
  const { draft, live, saveDraft, publish, loading } = useGameContent();
  const [busy, setBusy] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);

  if (!draft) {
    return (
      <Screen label="Creator · Studio">
        <Banner tone="info">You need “Create a game in the Studio” to open the Studio.</Banner>
      </Screen>
    );
  }

  const pending = s.studioPending;
  // The preview shows unsaved AI changes when there are any, else the saved draft.
  const content = pending?.content ?? draft.content;
  const inv = content.invoices.find(i => i.no === s.studioInvoice) ?? content.invoices[0];
  const errors = errorsOn(content, inv.no);
  const marks: Record<string, FieldMark> = s.studioView === 'key' ? Object.fromEntries(errors.map(e => [e.fields[0], 'answer' as const])) : {};
  const usedRules = new Set(content.errors.map(e => e.rule));
  const draftDiffers = JSON.stringify(draft.content) !== JSON.stringify(live.content);
  const canPublish = permissions.has('workflow.publish');

  const run = async (work: () => Promise<string>) => {
    setBusy(true);
    try { toast(await work()); } catch (e) { toast(errorMessage(e)); } finally { setBusy(false); }
  };
  const keep = () => run(async () => {
    await saveDraft(pending!.content);
    set({ studioPending: null });
    return `Kept ${pending!.count} ${pending!.count === 1 ? 'change' : 'changes'} · draft saved`;
  });
  const discard = () => { set({ studioPending: null }); toast('Discarded the AI changes'); };
  const doPublish = () => run(async () => {
    setConfirmPublish(false);
    await publish();
    return 'Published · new runs use this version; runs in progress keep theirs';
  });

  return (
    <Screen label="Creator · Studio" gap={14}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <BackLink onClick={() => go('games')}>← My games</BackLink>
        <span style={{ color: '#d5dacf' }}>·</span>
        <h1 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.2, margin: 0 }}>{GAME.title}</h1>
        <Tag tone="bundle">{GAME.domain}</Tag>
        <StatusChip status={pending ? 'clarification' : draftDiffers ? 'in-progress' : 'accepted'} label={pending ? 'Unsaved AI changes' : draftDiffers ? `Draft${draft.version ? ` v${draft.version}` : ''} · not published` : 'Draft matches live'} size="xs" />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setConfirmPublish(true)}
            disabled={busy || loading || !!pending || !draftDiffers || !canPublish}
            title={!canPublish ? 'Needs “Approve and publish a version”' : pending ? 'Keep or discard the AI changes first' : !draftDiffers ? 'Nothing new to publish' : undefined}
          >
            Publish to players
          </Button>
          <Button variant="dark" size="md" onClick={() => go('workflow')}>Send to test →</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `${s.studioChatOpen ? 'minmax(300px,360px)' : '44px'} minmax(0,1fr) 290px`, gap: 14, alignItems: 'start' }}>
        <StudioChat base={content} onProposal={touched => set({ studioInvoice: touched[0], studioView: 'key' })} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          {pending ? (
            <Banner
              tone="info"
              title={`${pending.count} AI ${pending.count === 1 ? 'change' : 'changes'} in the preview.`}
              actions={<><Button variant="primary" size="sm" onClick={() => void keep()} disabled={busy}>Keep</Button><Button variant="secondary" size="sm" onClick={discard} disabled={busy}>Discard</Button></>}
            >
              Not saved yet. Keep them to update the draft.
            </Banner>
          ) : null}
          <nav aria-label="Invoices" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {content.invoices.map(i => {
              const sel = i.no === inv.no, n = errorsOn(content, i.no).length, touched = pending?.touched.includes(i.no);
              return (
                <button
                  key={i.no}
                  type="button"
                  aria-current={sel ? 'true' : undefined}
                  aria-label={`Invoice ${i.no}${n ? `, ${n} error${n === 1 ? '' : 's'}` : ', clean'}${touched ? ', changed by AI' : ''}`}
                  onClick={() => set({ studioInvoice: i.no })}
                  style={{ position: 'relative', minWidth: 34, height: 30, padding: '0 8px', borderRadius: 6, border: `1px solid ${sel ? '#1a1d18' : touched ? '#e0a100' : '#d5dacf'}`, background: sel ? '#1a1d18' : touched ? '#fdf7e6' : '#fff', color: sel ? '#fff' : '#1a1d18', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                >
                  {i.no}
                  {n ? <span aria-hidden="true" style={{ position: 'absolute', top: 3, right: 3, width: 5, height: 5, borderRadius: '50%', background: sel ? '#86BC25' : '#e0a100' }} /> : null}
                </button>
              );
            })}
            <span style={{ marginLeft: 'auto' }}>
              <SegmentedControl options={[{ value: 'key', label: 'Answer key' }, { value: 'player', label: 'As the player sees it' }]} value={s.studioView} onChange={studioView => set({ studioView })} size="sm" />
            </span>
          </nav>
          <InvoicePaper invoice={inv} marks={marks} />
          <div style={{ fontSize: 12, color: '#8b918a' }}>Invoice {inv.no} of {content.invoices.length} · {content.errors.length} errors · {content.invoices.length - new Set(content.errors.map(e => e.invoice)).size} clean invoices</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={card}>
            <div style={panelHead}>Grounding · invoice {inv.no}</div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {errors.length ? errors.map(e => {
                const p = passageOfError(e);
                return (
                  <div key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: '#5a6058' }}>Flag on: {e.fields.map(fieldName).join(' or ')} · rule: {ruleById(e.rule).label}</div>
                    <div style={{ fontSize: 12.5, color: '#5a6058' }}>{e.explanation}</div>
                    <Tag tone="source" style={{ alignSelf: 'flex-start' }}>{GAME.source}</Tag>
                    <div style={{ fontSize: 12, color: '#8b918a' }}>{p.loc}</div>
                    <div style={{ fontSize: 12.5, lineHeight: 1.5, borderLeft: '2px solid #86BC25', paddingLeft: 10 }}>“{p.text}”</div>
                  </div>
                );
              }) : <div style={{ fontSize: 12.5, color: '#5a6058' }}>Clean invoice: “no errors” is the right answer. Any flag here costs the player 5 points.</div>}
            </div>
          </div>
          <div style={card}>
            <div style={panelHead}>Content Domain<span style={{ fontSize: 12, color: '#8b918a', fontWeight: 400 }}>{GAME.domain}</span></div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
              <div style={{ fontWeight: 500 }}>{GAME.source}</div>
              <div style={{ color: '#5a6058' }}>{PASSAGES.length} sections · {new Set(content.errors.map(e => ruleById(e.rule).passage)).size} used by errors</div>
              <div style={{ color: '#5a6058' }}>{RULES.length} rules in the picker · {RULES.length - usedRules.size} unused, so players can’t guess by elimination</div>
              <div style={{ color: '#5a6058' }}>Live: {live.version ? `version ${live.version}` : 'built-in version'}</div>
            </div>
          </div>
        </div>
      </div>

      {confirmPublish ? (
        <Dialog
          title="Publish the draft to players?"
          subtitle={`${content.invoices.length} invoices, ${content.errors.length} errors. New runs use it straight away; runs in progress keep the version they started.`}
          onClose={() => setConfirmPublish(false)}
          footer={<><Button variant="primary" size="xl" onClick={() => void doPublish()} disabled={busy}>Publish</Button><Button variant="secondary" size="xl" onClick={() => setConfirmPublish(false)}>Cancel</Button></>}
        />
      ) : null}
    </Screen>
  );
}
