import { useEffect, useState } from 'react';
import { useSignedIn } from '../auth/useAuth';
import { enablePush, type PushResult } from '../game/push';
import { errorMessage, supabase } from '../lib/supabase';

const RESULT: Record<PushResult, string> = {
  on: 'Notifications are on for this device.',
  denied: 'Notifications are blocked for Game Studio in this browser’s settings.',
  unsupported: 'This browser can’t show notifications.',
  'needs-install': 'On iPhone or iPad: tap Share → Add to Home Screen, open Game Studio from there, then turn this on.',
};

/** In Profile details: how a player hears it's their turn in a game with a colleague. */
export function NotificationSettings() {
  const { profile, permissions } = useSignedIn();
  const [prefs, setPrefs] = useState<{ notify_email: boolean; notify_push: boolean } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.from('profiles').select('notify_email, notify_push').eq('id', profile.id).maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setPrefs(data as { notify_email: boolean; notify_push: boolean }); });
    return () => { cancelled = true; };
  }, [profile.id]);

  if (!permissions.has('games.play')) return null;
  const save = async (next: { notify_email: boolean; notify_push: boolean }) => {
    setPrefs(next);
    const { error } = await supabase.rpc('set_my_notifications', { p_email: next.notify_email, p_push: next.notify_push });
    if (error) setMessage(errorMessage(error));
  };
  const turnOn = async () => {
    setBusy(true);
    try { setMessage(RESULT[await enablePush()]); } catch (e) { setMessage(errorMessage(e)); } finally { setBusy(false); }
  };

  const check = { display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' } as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #e6e8e3', paddingTop: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 12.5 }}>Games with colleagues</div>
      <button type="button" disabled={busy} onClick={() => void turnOn()} style={{ alignSelf: 'flex-start', font: 'inherit', fontSize: 12.5, padding: '5px 10px', borderRadius: 6, border: '1px solid #c9cdc5', background: '#fff', cursor: 'pointer' }}>
        {busy ? 'Turning on…' : 'Notify me on this device'}
      </button>
      {message ? <div role="status" style={{ fontSize: 12, color: '#4b5149' }}>{message}</div> : null}
      {prefs ? (
        <>
          <label style={check}><input type="checkbox" checked={prefs.notify_push} onChange={e => void save({ ...prefs, notify_push: e.target.checked })} /> Phone notifications</label>
          <label style={check}><input type="checkbox" checked={prefs.notify_email} onChange={e => void save({ ...prefs, notify_email: e.target.checked })} /> Email me when it’s my turn</label>
        </>
      ) : null}
    </div>
  );
}
