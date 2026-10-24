import { useEffect, useRef, useState } from 'react';
import { Banner, Button, LinkButton, StatusChip, Tag } from '../../ds';
import { useApp, type ActiveRun } from '../../app/useApp';
import { errorMessage } from '../../lib/supabase';
import { GAME, PASSAGES, POINTS_PER_ERROR, POINTS_PER_FALSE_FLAG, RULES, TIME_LIMIT_SECONDS, passageOfError, ruleById, type GameContent } from '../../game/content';
import { useGameContent } from '../../game/useGameContent';
import { fieldName } from '../../game/fields';
import { InvoicePaper, type FieldMark } from '../../game/InvoicePaper';
import { clock, finishRun, saveAnswers, startRun } from '../../game/runs';
import { scoreInvoice, scoreRun, type InvoiceAnswer, type InvoiceResult } from '../../game/scoring';
import { BackLink, Screen } from '../../shell/ui';
import { card, cardHead, eyebrow } from '../../shell/styles';

const SOURCE = GAME.source;

function Brief({ content, onStart, busy, error }: { content: GameContent; onStart: () => void; busy: boolean; error: string | null }) {
  const { go } = useApp();
  return (
    <Screen label="Player · Brief" narrow={860}>
      <BackLink onClick={() => go('library')}>← Back to your games</BackLink>
      <div style={{ ...card, padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={eyebrow}>{GAME.type} · {GAME.domain}</div>
        <h1 style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.2, margin: 0 }}>{GAME.title}</h1>
        <div style={{ color: '#5a6058', fontSize: 14, lineHeight: 1.5, maxWidth: 620 }}>
          You are auditing a client file. {content.invoices.length} invoices hide {content.errors.length} mistakes against the mandatory mentions on a Belgian VAT invoice. Some invoices are correct.
        </div>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Click any part of an invoice you think is wrong, then pick the rule it breaks.</li>
          <li>Submit each invoice. With no flags, you are saying it has no errors.</li>
          <li>Each answer shows the passage it rests on. +{POINTS_PER_ERROR} per error found, {POINTS_PER_FALSE_FLAG} per flag on something that is fine.</li>
          <li>One {GAME.minutes}-minute clock runs for all {content.invoices.length} invoices.</li>
        </ol>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#5a6058' }}>
          <span>Source</span><Tag tone="source">{SOURCE}</Tag><span>{PASSAGES.length} sections</span>
        </div>
        {error ? <Banner tone="warning">{error}</Banner> : null}
        <div><Button variant="primary" size="xl" onClick={onStart} disabled={busy}>{busy ? 'Starting…' : `Start · ${GAME.minutes}:00`}</Button></div>
      </div>
    </Screen>
  );
}

function marksFor(run: ActiveRun, result: InvoiceResult | null): Record<string, FieldMark> {
  const marks: Record<string, FieldMark> = {};
  if (!result) {
    for (const f of run.flags) marks[f.field] = 'flagged';
    if (run.choosing) marks[run.choosing] = 'choosing';
    return marks;
  }
  for (const f of result.falseFlags) marks[f.field] = 'false';
  for (const e of result.errors) {
    if (e.outcome === 'missed') marks[e.error.fields[0]] = 'missed';
    else marks[e.flag!.field] = e.outcome;
  }
  return marks;
}

function RulePicker({ run, onPick, onRemove, onCancel }: { run: ActiveRun; onPick: (rule: string) => void; onRemove: () => void; onCancel: () => void }) {
  const field = run.choosing!;
  const current = run.flags.find(f => f.field === field)?.rule;
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
      <div style={cardHead}>What is wrong with the {fieldName(field).toLowerCase()}?</div>
      <div role="radiogroup" aria-label="Rule it breaks" style={{ display: 'flex', flexDirection: 'column' }}>
        {RULES.map(r => (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={current === r.id}
            onClick={() => onPick(r.id)}
            style={{ textAlign: 'left', padding: '9px 18px', border: 0, borderTop: '1px solid #eef0ea', background: current === r.id ? '#f6f9ef' : '#fff', boxShadow: current === r.id ? 'inset 3px 0 0 #86BC25' : 'none', font: 'inherit', fontSize: 13, cursor: 'pointer', color: 'inherit' }}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '12px 18px', borderTop: '1px solid #eef0ea' }}>
        {current ? <LinkButton size={12.5} tone="muted" onClick={onRemove}>Remove flag</LinkButton> : null}
        <LinkButton size={12.5} onClick={onCancel}>Cancel</LinkButton>
      </div>
    </div>
  );
}

function Feedback({ result, last, onNext, busy }: { result: InvoiceResult; last: boolean; onNext: () => void; busy: boolean }) {
  const quote = (passageId: string) => {
    const p = PASSAGES.find(x => x.id === passageId)!;
    return (
      <div style={{ background: '#fafbf8', border: '1px solid #e1e5dc', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11.5, color: '#5a6058' }}><Tag tone="source">{SOURCE}</Tag><span>{p.loc}</span></div>
        <div style={{ fontSize: 12.5, lineHeight: 1.5, borderLeft: '2px solid #86BC25', paddingLeft: 10 }}>“{p.text}”</div>
      </div>
    );
  };
  const outcomeChip = { found: <StatusChip status="accepted" label={`Found · +${POINTS_PER_ERROR}`} size="xs" />, 'wrong-rule': <StatusChip status="clarification" label="Right place, wrong rule" size="xs" />, missed: <StatusChip status="clarification" label="Missed" size="xs" /> };
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...cardHead, display: 'flex', alignItems: 'center', gap: 10 }}>
        <StatusChip status={result.correct ? 'accepted' : 'clarification'} label={result.correct ? 'Correct' : 'Not quite'} size="sm" />
        <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{result.points >= 0 ? '+' : ''}{result.points} points</span>
      </div>
      <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!result.errors.length && !result.falseFlags.length ? <div>This invoice has no errors, and you left it unflagged.</div> : null}
        {!result.errors.length && result.falseFlags.length ? <div>This invoice has no errors.</div> : null}
        {result.errors.map(({ error, outcome, flag }) => (
          <div key={error.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>{outcomeChip[outcome]}</div>
            <div style={{ fontWeight: 600 }}>{error.title}</div>
            <div style={{ color: '#5a6058' }}>{error.explanation}</div>
            {outcome === 'wrong-rule' && flag ? <div style={{ fontSize: 12, color: '#9a3d0c' }}>You said: {ruleById(flag.rule).label}. The rule is: {ruleById(error.rule).label}.</div> : null}
            {quote(passageOfError(error).id)}
          </div>
        ))}
        {result.falseFlags.map(f => (
          <div key={f.field} style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid #eef0ea', paddingTop: 10 }}>
            <div><StatusChip status="na" label={`Not an error · ${POINTS_PER_FALSE_FLAG}`} size="xs" /></div>
            <div style={{ fontSize: 12.5 }}>{fieldName(f.field)}: nothing wrong with it under “{ruleById(f.rule).label}”.</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '12px 18px', borderTop: '1px solid #eef0ea', display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" size="xl" onClick={onNext} disabled={busy}>{last ? (busy ? 'Saving…' : 'See results →') : 'Next invoice →'}</Button>
      </div>
    </div>
  );
}

export function Play() {
  const { s, set, go, toast } = useApp();
  const { live, loading } = useGameContent();
  const run = s.run;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const finishing = useRef(false);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const row = await startRun(live.version);
      set({ run: { id: row.id, content: live.content, startedAt: Date.now(), answers: [], index: 0, flags: [], choosing: null, submitted: false } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const finish = async (answers: InvoiceAnswer[], timedOut: boolean) => {
    if (!run || finishing.current) return;
    finishing.current = true;
    setBusy(true);
    try {
      const row = await finishRun(run.id, answers, scoreRun(run.content, answers));
      set({ run: null, resultsRunId: row.id, screen: 'results' });
      if (timedOut) toast('Time is up · unanswered invoices count as missed');
    } catch (e) {
      toast(`Could not save your run: ${errorMessage(e)}`);
      finishing.current = false;
    } finally {
      setBusy(false);
    }
  };

  // Clamped: `now` can predate the start until the first tick.
  const remaining = run ? Math.min(TIME_LIMIT_SECONDS, Math.max(0, TIME_LIMIT_SECONDS - Math.floor((now - run.startedAt) / 1000))) : TIME_LIMIT_SECONDS;

  // The tick reads the latest run and finish through refs, so the interval survives answer updates.
  const latest = useRef({ run, finish });
  useEffect(() => { latest.current = { run, finish }; });
  const runId = run?.id;
  useEffect(() => {
    if (!runId) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const { run: r, finish: end } = latest.current;
      // Time up: everything submitted so far counts; the rest scores as missed. `finishing` stops repeats.
      if (r && t - r.startedAt >= TIME_LIMIT_SECONDS * 1000) void end(r.answers, true);
    }, 1000);
    return () => clearInterval(id);
  }, [runId]);

  if (!run) return <Brief content={live.content} onStart={() => void start()} busy={busy || loading} error={error} />;

  const { invoices, errors } = run.content;
  const inv = invoices[run.index];
  const last = run.index === invoices.length - 1;
  const result = run.submitted ? scoreInvoice(run.content, { invoice: inv.no, flags: run.flags }) : null;
  const patchRun = (p: Partial<ActiveRun>) => set(prev => (prev.run ? { run: { ...prev.run, ...p } } : {}));

  const submit = () => {
    const answers = [...run.answers.filter(a => a.invoice !== inv.no), { invoice: inv.no, flags: run.flags }];
    patchRun({ answers, submitted: true, choosing: null });
    saveAnswers(run.id, answers).catch(e => toast(`Answers not saved yet: ${errorMessage(e)}`));
  };
  const next = () => {
    if (last) void finish(run.answers, false);
    else patchRun({ index: run.index + 1, flags: [], submitted: false, choosing: null });
  };

  const lowTime = remaining <= 60;

  return (
    <Screen label="Player · In game" gap={14}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <BackLink onClick={() => go('library')}>← Leave · the clock keeps running</BackLink>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#5a6058' }}>
          <span>{GAME.title} · invoice {run.index + 1} of {invoices.length}</span>
          <span style={{ color: '#d5dacf' }}>·</span>
          <span role="timer" aria-label="Time left" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 13, color: lowTime ? '#9a2b22' : '#1a1d18' }}>{clock(remaining)}</span>
        </div>
      </div>
      <div role="progressbar" aria-label="Invoices done" aria-valuenow={run.answers.length} aria-valuemin={0} aria-valuemax={invoices.length} style={{ height: 4, background: '#eef0ec', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: '#86BC25', width: `${(run.answers.length / invoices.length) * 100}%`, transition: 'width .15s' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 18, alignItems: 'start' }}>
        <InvoicePaper
          invoice={inv}
          marks={marksFor(run, result)}
          onField={run.submitted ? undefined : field => patchRun({ choosing: field })}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 78 }}>
          {result ? (
            <Feedback result={result} last={last} onNext={next} busy={busy} />
          ) : run.choosing ? (
            <RulePicker
              run={run}
              onPick={rule => patchRun({ flags: [...run.flags.filter(f => f.field !== run.choosing), { field: run.choosing!, rule }], choosing: null })}
              onRemove={() => patchRun({ flags: run.flags.filter(f => f.field !== run.choosing), choosing: null })}
              onCancel={() => patchRun({ choosing: null })}
            />
          ) : (
            <div style={{ ...card, display: 'flex', flexDirection: 'column' }}>
              <div style={cardHead}>Your flags · invoice {inv.no}</div>
              <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {run.flags.length ? run.flags.map(f => (
                  <div key={f.field} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e0a100', marginTop: 6, flex: 'none' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{fieldName(f.field)}</div>
                      <div style={{ fontSize: 12, color: '#5a6058' }}>{ruleById(f.rule).label}</div>
                    </div>
                    <LinkButton size={12} tone="muted" onClick={() => patchRun({ choosing: f.field })}>Change</LinkButton>
                  </div>
                )) : <div style={{ color: '#5a6058' }}>Click any part of the invoice you think is wrong. Nothing flagged means “no errors”.</div>}
              </div>
              <div style={{ padding: '12px 18px', borderTop: '1px solid #eef0ea' }}>
                <Button variant="primary" size="xl" fullWidth onClick={submit}>
                  {run.flags.length ? `Submit · ${run.flags.length} ${run.flags.length === 1 ? 'flag' : 'flags'}` : 'Submit · no errors'}
                </Button>
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, color: '#8b918a' }}>Points so far: {run.answers.reduce((a, ans) => a + scoreInvoice(run.content, ans).points, 0)} · {errors.length} errors in {invoices.length} invoices</div>
        </div>
      </div>
    </Screen>
  );
}
