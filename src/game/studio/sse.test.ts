import { describe, expect, it } from 'vitest';
import { readSse } from './sse';

const streamOf = (...chunks: string[]) => new ReadableStream<Uint8Array>({
  start(c) { for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch)); c.close(); },
});

describe('readSse', () => {
  it('parses deltas across chunk boundaries and returns the done payload', async () => {
    const seen: string[] = [];
    const result = await readSse(streamOf('event: delta\ndata: "<ht', 'ml>"\n\nevent: delta\ndata: "<body>"\n', '\nevent: done\ndata: {"files":{"index.html":"x"}}\n\n'), t => seen.push(t));
    expect(seen).toEqual(['<html>', '<body>']);
    expect(result).toEqual({ files: { 'index.html': 'x' } });
  });
  it('throws the server’s message on an error event', async () => {
    await expect(readSse(streamOf('event: delta\ndata: "a"\n\nevent: error\ndata: {"error":"The file got too long"}\n\n'), () => {})).rejects.toThrow('The file got too long');
  });
  it('throws when the stream ends without done', async () => {
    await expect(readSse(streamOf('event: delta\ndata: "a"\n\n'), () => {})).rejects.toThrow('stopped');
  });
});
