import { useEffect, useState } from 'react';
import { Banner, Button, Field, Input, Textarea } from '../../ds';
import { useApp } from '../../app/useApp';
import { useSignedIn } from '../../auth/useAuth';
import { callFunction, errorMessage, supabase } from '../../lib/supabase';
import { PageHead, Screen } from '../../shell/ui';
import { card } from '../../shell/styles';

/** The rules and context every AI step follows and every game is checked against before it is published. */
export function HouseRules() {
  const { toast } = useApp();
  const { permissions } = useSignedIn();
  const [rules, setRules] = useState<string[] | null>(null);
  const [context, setContext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from('ai_settings').select('value').eq('key', 'house_rules').maybeSingle().then(({ data }) => {
      if (cancelled) return;
      const v = data?.value as { rules?: string[]; context?: string } | undefined;
      setRules(v?.rules ?? []);
      setContext(v?.context ?? '');
    });
    return () => { cancelled = true; };
  }, []);

  if (!permissions.has('ai.manage')) return <Screen label="Admin · House rules"><Banner tone="info">You need “Manage AI services and keys” to see this page.</Banner></Screen>;

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const saved = await callFunction<{ rules: string[]; context: string }>('ai-services', { action: 'set_house_rules', rules, context });
      setRules(saved.rules);
      setContext(saved.context);
      toast('House rules saved');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen label="Admin · House rules" narrow={860}>
      <PageHead title="House rules" lead="Every AI step and every game’s check before publishing follows these rules." />
      {error ? <Banner tone="warning">{error}</Banner> : null}
      <div style={{ ...card, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 600 }}>Rules</div>
        {rules === null ? <div style={{ color: 'var(--tc-ink-5)' }}>Loading…</div> : rules.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input aria-label={`Rule ${i + 1}`} value={r} maxLength={200} onChange={e => setRules(rs => rs!.map((x, j) => (j === i ? e.target.value : x)))} />
            <Button variant="secondary" size="md" aria-label={`Remove rule ${i + 1}`} onClick={() => setRules(rs => rs!.filter((_, j) => j !== i))} disabled={busy}>Remove</Button>
          </div>
        ))}
        <div><Button variant="secondary" size="md" onClick={() => setRules(rs => [...(rs ?? []), ''])} disabled={busy || (rules?.length ?? 0) >= 20}>Add a rule</Button></div>
        <Field label="Context" hint="Who plays, what the firm stands for: the AI keeps it in mind for every game">
          <Textarea value={context} onChange={e => setContext(e.target.value.slice(0, 1000))} rows={3} />
        </Field>
        <div><Button variant="primary" size="lg" onClick={() => void save()} disabled={busy || rules === null}>{busy ? 'Saving…' : 'Save house rules'}</Button></div>
      </div>
    </Screen>
  );
}
