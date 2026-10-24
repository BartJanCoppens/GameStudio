import { describe, expect, it } from 'vitest';
import { limitedQueue } from './limiter';

describe('limitedQueue', () => {
  it('runs one at a time and refuses beyond the limit', async () => {
    let running = 0, peak = 0;
    const q = limitedQueue(3);
    const work = () => q(async () => { running++; peak = Math.max(peak, running); await new Promise(r => setTimeout(r, 5)); running--; return 'ok'; });
    const results = await Promise.allSettled([work(), work(), work(), work(), work()]);
    expect(peak).toBe(1);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(3);
    expect(results.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason.message)).toEqual(['Limit reached', 'Limit reached']);
  });
});
