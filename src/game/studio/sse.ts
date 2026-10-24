import { supabase } from '../../lib/supabase';

// Reading an Edge Function's server-sent events: code as it is written ("delta"), then the result ("done")
// or the reason it failed ("error"). supabase.functions.invoke doesn't stream, so this uses fetch.

/** Calls onDelta for each delta and resolves with the done payload; rejects on an error event or a cut-off stream. */
export async function readSse(stream: ReadableStream<Uint8Array>, onDelta: (text: string) => void): Promise<unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = block.match(/^event: (.*)$/m)?.[1];
      const data = block.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n');
      const payload = data ? JSON.parse(data) : null;
      if (event === 'delta') onDelta(String(payload));
      else if (event === 'done') return payload;
      else if (event === 'error') throw new Error((payload as { error?: string } | null)?.error ?? 'The build step failed');
    }
    if (done) throw new Error('The build step stopped before it finished. Try again.');
  }
}

/** POSTs to an Edge Function as the signed-in user and reads its event stream. */
export async function streamFunction(name: string, body: object, onDelta: (text: string) => void): Promise<unknown> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${data.session?.access_token ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(err?.error ?? `The build step failed (HTTP ${res.status})`);
  }
  return readSse(res.body, onDelta);
}
