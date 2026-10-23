import type { ReactNode } from 'react';
import { Button, ChatBubble, FilterChip, LinkButton, SegmentedControl, Stepper, Tag, type Option } from '../../ds';
import { COHORT_SIZES, DOMAINS, DOMAIN_SHORT_META, type DomainKey } from '../../data/shared';
import { EXAMPLES, FEEL_SHAPE, IDEAS, type AudienceCohort, type Brief, type Mechanic } from '../../data/creator';
import { useApp } from '../../app/useApp';
import { BackLink, Screen } from '../../shell/ui';
import { card, dot, eyebrow } from '../../shell/styles';

const PLATFORM_LABEL = { browser: 'browser', phone: 'phone app', both: 'browser and phone' };

const textareaStyle = { marginLeft: 28, width: 'calc(100% - 28px)', resize: 'vertical', border: '1px solid #d5dacf', borderRadius: 6, padding: '8px 10px', font: 'inherit', fontSize: 13 } as const;

function BriefQuestion({ n, title, sub, children }: { n: number; title: string; sub?: string; children: ReactNode }) {
  return (
    <div style={{ padding: '16px 18px', borderTop: n === 1 || n === 9 ? 0 : '1px solid #eef0ea', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 12, color: '#8b918a', width: 18, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
        <div>
          <div style={{ fontWeight: 600 }}>{title}</div>
          {sub ? <div style={{ fontSize: 12, color: '#5a6058' }}>{sub}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function Seg<V extends string>({ options, value, onChange }: { options: Option<V>[]; value: V; onChange: (v: V) => void }) {
  return <div style={{ marginLeft: 28 }}><SegmentedControl options={options} value={value} onChange={onChange} size="md" /></div>;
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: '#8b918a' }}>{label}</div>
      {children}
    </div>
  );
}

export function NewGame() {
  const { s, set, go, toast } = useApp();
  const b = s.brief;
  const setB = <K extends keyof Brief>(k: K, v: Brief[K]) => set(prev => ({ brief: { ...prev.brief, [k]: v } }));
  const toggleMechanic = (k: Mechanic) => set(prev => ({ brief: { ...prev.brief, mechanics: { ...prev.brief.mechanics, [k]: !prev.brief.mechanics[k] } } }));
  const toggleAudience = (k: AudienceCohort) => set(prev => ({ brief: { ...prev.brief, audience: { ...prev.brief.audience, [k]: !prev.brief.audience[k] } } }));

  const mechOn = (Object.keys(b.mechanics) as Mechanic[]).filter(k => b.mechanics[k]);
  const audOn = (Object.keys(b.audience) as AudienceCohort[]).filter(k => b.audience[k]);
  const domain = DOMAINS[b.domain];
  const desc = b.goal.trim();
  const guessTitle = desc ? EXAMPLES.find(([, t]) => t === desc)?.[0] || desc.split(/[.;,]/)[0].slice(0, 48) : '';
  const summary = {
    title: guessTitle ? `${guessTitle} · ${domain.name} edition` : 'Untitled · from your description',
    shape: `${desc ? 'Your rules, as described' : FEEL_SHAPE[b.feel]} · ${b.length} · ${PLATFORM_LABEL[b.platform]}`,
    mechanics: mechOn.length ? mechOn : ['None yet'],
    audience: audOn.length ? `${audOn.join(', ')} · ${audOn.reduce((a, k) => a + COHORT_SIZES[k], 0)} players` : 'Nobody yet · allocate on publish',
    note: b.ai === 'assist'
      ? 'I will open an empty Studio and wait for your instructions.'
      : b.ai === 'skeleton'
        ? 'I will lay out levels and empty slots with suggested source passages.'
        : `I will turn your description into rules, pieces and turns, write every question from ${domain.name} and link each to its passage.${b.outcome.trim() ? ' Measured against: ' + b.outcome.trim() : ''}`,
  };

  const decideForMe = () => {
    const pick = IDEAS[Math.floor(Math.random() * IDEAS.length)];
    const mechanics = Object.fromEntries((Object.keys(b.mechanics) as Mechanic[]).map(k => [k, pick.mech.includes(k)])) as Brief['mechanics'];
    const audience = { ...b.audience };
    if (!Object.values(audience).some(Boolean)) audience['Analysts'] = true;
    set({ brief: { ...b, goal: b.goal || pick.goal, feel: b.goal ? b.feel : pick.feel, mechanics, audience, platform: pick.platform, length: pick.length } });
    toast(`My pick: ${pick.goal.toLowerCase()} · ${pick.length} · ${pick.platform === 'both' ? 'browser and phone' : pick.platform} · change anything above`);
  };

  const generate = () => {
    if (!desc) { decideForMe(); return; }
    set({
      screen: 'studio',
      studioGame: { title: summary.title, domain: domain.name, status: 'not-started', stage: 'Draft · v1', structureNote: 'Draft v1 · 4 levels · 24 items from your rules' },
      aiMode: b.ai === 'assist' ? 'assist' : 'draft',
      chat: [
        { role: 'user', text: desc },
        {
          role: 'assistant',
          text: `Drafted “${summary.title}” from ${domain.name}. I kept your rules and added the platform features you switched on (${mechOn.join(', ').toLowerCase() || 'none'}); ${b.length} per session. 22 of 24 items link to a passage; 2 are flagged ungrounded for you to decide.`,
          sources: ['BE VAT Code 2026', 'Circular 2024/C/12'],
        },
      ],
    });
    toast('First draft ready · saved as Draft v1 · 23 Oct');
  };

  return (
    <Screen label="Creator · New blank game" narrow={920}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <BackLink onClick={() => go('games')}>← My games</BackLink>
        <span style={{ color: '#d5dacf' }}>·</span>
        <span style={eyebrow}>New game · Blank</span>
        <div style={{ marginLeft: 'auto' }}><Stepper steps={['Brief', 'Draft', 'Studio']} current={0} /></div>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 560px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <ChatBubble role="assistant" sources={['Belgian VAT']}>
            Tell me the game you want; any shape, any rules, borrowed from anything. Then a few calls about the platform around it. Skip what you like: anything you leave open, I will decide creatively from the Content Domain and tell you what I chose.
          </ChatBubble>
          <div style={card}>
            <BriefQuestion n={1} title="Describe the game you have in mind" sub="Anything · a known game to borrow from, a mechanic, a story, a feeling · I will map it onto the Content Domain">
              <textarea
                aria-label="Describe the game you have in mind"
                value={b.goal}
                onChange={e => setB('goal', e.target.value)}
                placeholder="e.g. A version of chess with tax questions to be answered correctly before a hint is given"
                style={{ ...textareaStyle, minHeight: 96 }}
              />
              <div style={{ marginLeft: 28, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#8b918a' }}>Or start from</span>
                {EXAMPLES.map(([label, text]) => <FilterChip key={label} onClick={() => setB('goal', text)}>{label}</FilterChip>)}
              </div>
            </BriefQuestion>
            <BriefQuestion n={2} title="Which Content Domain grounds the game?" sub="Every question, case or dialogue line must trace to a passage here">
              <div style={{ marginLeft: 28, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {(Object.keys(DOMAINS) as DomainKey[]).map(k => {
                  const on = b.domain === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setB('domain', k)}
                      style={{ textAlign: 'left', background: on ? '#f6f9ef' : '#fff', border: `1px solid ${on ? '#86BC25' : '#d5dacf'}`, borderRadius: 6, padding: '8px 12px', font: 'inherit', color: 'inherit', cursor: 'pointer', minWidth: 160 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={dot(DOMAINS[k].dot)} /><span style={{ fontWeight: 600 }}>{DOMAINS[k].name}</span></div>
                      <div style={{ fontSize: 11.5, color: '#5a6058', marginTop: 2 }}>{DOMAIN_SHORT_META[k]}</div>
                    </button>
                  );
                })}
              </div>
            </BriefQuestion>
            <BriefQuestion n={3} title="What should players know or be able to do afterwards?" sub="Optional · one line · the learning goal the game is measured against">
              <textarea
                aria-label="Learning goal"
                value={b.outcome}
                onChange={e => setB('outcome', e.target.value)}
                placeholder="e.g. Decide quickly whether a renovation invoice gets 6% or 21%"
                style={{ ...textareaStyle, minHeight: 44 }}
              />
            </BriefQuestion>
            <BriefQuestion n={4} title="Platform features to wire in" sub="Optional · the platform supplies these around your game; your own rules come from the description">
              <div style={{ marginLeft: 28, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(Object.keys(b.mechanics) as Mechanic[]).map(k => <FilterChip key={k} selected={b.mechanics[k]} onClick={() => toggleMechanic(k)}>{k}</FilterChip>)}
              </div>
            </BriefQuestion>
            <BriefQuestion n={5} title="Who is it for?" sub="Cohorts you can allocate to on publish · pick several">
              <div style={{ marginLeft: 28, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(Object.keys(b.audience) as AudienceCohort[]).map(k => <FilterChip key={k} selected={b.audience[k]} onClick={() => toggleAudience(k)}>{k} · {COHORT_SIZES[k]}</FilterChip>)}
              </div>
            </BriefQuestion>
            <BriefQuestion n={6} title="Where is it played?" sub="Phone apps appear in the player’s library as an install · progress syncs either way">
              <Seg value={b.platform} onChange={v => setB('platform', v)} options={[{ value: 'browser', label: 'Browser' }, { value: 'phone', label: 'Phone app' }, { value: 'both', label: 'Both' }]} />
            </BriefQuestion>
            <BriefQuestion n={7} title="How long is one session?">
              <Seg value={b.length} onChange={v => setB('length', v)} options={[{ value: '2 min', label: '2 min daily' }, { value: '10 min', label: '10 min' }, { value: '20 min', label: '20 min' }, { value: '45 min', label: '45 min' }]} />
            </BriefQuestion>
            <BriefQuestion n={8} title="How much should I do?" sub="You can change this per level later">
              <Seg value={b.ai} onChange={v => setB('ai', v)} options={[{ value: 'draft', label: 'Draft the whole game' }, { value: 'skeleton', label: 'Structure only' }, { value: 'assist', label: 'Nothing yet, assist me' }]} />
            </BriefQuestion>
          </div>
          {s.briefRound === 2 ? (
            <>
              <ChatBubble role="assistant">Two more, now that I know the shape.</ChatBubble>
              <div style={card}>
                <BriefQuestion n={9} title="Difficulty over the session?" sub="Based on 10 min for Analysts and new joiners">
                  <Seg value={b.difficulty} onChange={v => setB('difficulty', v)} options={[{ value: 'ramp', label: 'Easy to hard' }, { value: 'flat', label: 'Even' }, { value: 'adaptive', label: 'Adapts to answers' }]} />
                </BriefQuestion>
                <BriefQuestion n={10} title="What happens on a wrong answer?" sub="With feedback citing the source switched on">
                  <Seg value={b.failure} onChange={v => setB('failure', v)} options={[{ value: 'retry', label: 'Show source, retry once' }, { value: 'move', label: 'Show source, move on' }, { value: 'lose', label: 'Lose points' }]} />
                </BriefQuestion>
              </div>
            </>
          ) : null}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" size="lg" onClick={generate}>Generate first draft →</Button>
            <Button variant="secondary" size="lg" onClick={() => set({ briefRound: 2 })}>Ask me follow-up questions</Button>
            <LinkButton size={12.5} onClick={decideForMe} style={{ marginLeft: 6 }}>Decide for me</LinkButton>
          </div>
        </div>
        <aside style={{ flex: '0 1 300px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={card}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #eef0ea', fontWeight: 600 }}>What I will draft</div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12.5 }}>
              <SummaryRow label="Working title"><div style={{ fontWeight: 500 }}>{summary.title}</div></SummaryRow>
              <SummaryRow label="Grounded in">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}><Tag tone="bundle">{domain.name}</Tag><span style={{ color: '#5a6058' }}>{DOMAIN_SHORT_META[b.domain]}</span></div>
              </SummaryRow>
              <SummaryRow label="Shape"><div>{summary.shape}</div></SummaryRow>
              <SummaryRow label="Mechanics">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3 }}>{summary.mechanics.map(m => <Tag key={m} tone="neutral">{m}</Tag>)}</div>
              </SummaryRow>
              <SummaryRow label="For"><div>{summary.audience}</div></SummaryRow>
              <div style={{ borderTop: '1px solid #eef0ea', paddingTop: 10, color: '#5a6058' }}>{summary.note}</div>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e1e5dc', borderRadius: 6, padding: '12px 14px', fontSize: 12.5, color: '#5a6058' }}>
            <div style={{ fontWeight: 600, color: '#1a1d18', marginBottom: 4 }}>After the draft</div>
            You land in the Studio: edit by hand, keep chatting, or redraw the flow. Every generated item links to a passage in the domain or is flagged ungrounded. The game starts in Draft.
          </div>
        </aside>
      </div>
    </Screen>
  );
}
