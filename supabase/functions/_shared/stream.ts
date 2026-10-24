// Server-sent events for Edge Functions whose work is worth watching (the game builder's code steps).
import { CORS, HttpError } from './server.ts';

export type SseEvent = 'delta' | 'done' | 'error';
export type Send = (event: SseEvent, data: unknown) => void;

/** Runs `work`, streaming what it sends; an exception becomes an `error` event. */
export function sseResponse(work: (send: Send) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const send: Send = (event, data) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        await work(send);
      } catch (e) {
        send('error', { error: e instanceof HttpError ? e.message : 'Unexpected error' });
        if (!(e instanceof HttpError)) console.error(e);
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { ...CORS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
}
