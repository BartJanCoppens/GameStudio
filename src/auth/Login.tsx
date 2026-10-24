import { useState, type FormEvent } from 'react';
import { Banner, BrandMark, Button, Field, FilterChip, Input } from '../ds';
import { supabaseConfigured } from '../lib/supabase';
import { useAuth } from './useAuth';

const DEMO_ACCOUNTS = ['player@deloitte.com', 'creator@deloitte.com', 'gameadmin@deloitte.com', 'admin@deloitte.com'];

const Check = () => (
  <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--tc-green)', flex: 'none', display: 'grid', placeItems: 'center', marginTop: 1 }}>
    <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" style={{ fill: 'none', stroke: 'var(--tc-green-ink)', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
    </svg>
  </span>
);

function Hero() {
  return (
    <div style={{ background: 'var(--tc-shell)', color: '#fff', padding: '44px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 40 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BrandMark />
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.1 }}>Game Studio</div>
          <div style={{ fontSize: 11, color: 'var(--tc-shell-muted)', letterSpacing: '.04em', textTransform: 'uppercase' }}>Deloitte</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 440 }}>
        <div style={{ fontSize: 30, fontWeight: 600, lineHeight: 1.2, textWrap: 'pretty' }}>Learn by playing. Every answer traces to the source.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, color: 'var(--tc-shell-text)' }}>
          {['Games built on your firm’s own Content Domains', 'Feedback that quotes the passage behind each answer', 'Allocated by cohort, tracked per player'].map(s => (
            <div key={s} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><Check /><span>{s}</span></div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--tc-shell-muted)' }}>Nederlands · Français · English</div>
    </div>
  );
}

function SetupNeeded() {
  return (
    <Banner tone="warning" title="Supabase is not connected.">
      Copy <code>.env.example</code> to <code>.env.local</code>, fill in the project URL and publishable key, and restart <code>npm run dev</code>.
    </Banner>
  );
}

export function Login() {
  const { state, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const notice = state.status === 'signed-out' ? state.notice : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))' }}>
      <Hero />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 32px 120px', background: '#fff' }}>
        <form onSubmit={submit} noValidate style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Sign in</h1>
            <div style={{ color: 'var(--tc-ink-3)', marginTop: 4 }}>Game Studio · Deloitte</div>
          </div>
          {!supabaseConfigured ? <SetupNeeded /> : null}
          {notice ? <Banner tone="warning">{notice}</Banner> : null}
          <Field label="Email">
            <Input size="3xl" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} invalid={Boolean(error)} autoFocus />
          </Field>
          <Field label="Password">
            <Input size="3xl" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} invalid={Boolean(error)} />
          </Field>
          {error ? <div role="alert" style={{ color: 'var(--tc-red-text)', fontSize: 13 }}>{error}</div> : null}
          <Button type="submit" size="3xl" fullWidth disabled={busy || !supabaseConfigured}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--tc-ink-5)' }}>Demo accounts · one per role</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DEMO_ACCOUNTS.map(a => <FilterChip key={a} selected={email === a} onClick={() => { setEmail(a); setError(null); }}>{a.split('@')[0]}</FilterChip>)}
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--tc-ink-5)', borderTop: '1px solid var(--tc-line-soft)', paddingTop: 14, textWrap: 'pretty' }}>
            Accounts are created by a platform admin. Forgot your password? Ask them to reset it.
          </div>
        </form>
      </div>
    </div>
  );
}
