import { describe, expect, it } from 'vitest';
import { joinContinuation, MAX_PARTS, MAX_SO_FAR_CHARS } from '../../supabase/functions/_shared/continuation.ts';

describe('joinContinuation', () => {
  it('appends the next part', () => expect(joinContinuation('function a() {\n  retu', 'rn 1;\n}\n')).toBe('function a() {\n  return 1;\n}\n'));
  it('drops text the model repeated at the seam', () =>
    expect(joinContinuation('const board = makeBoard();\nfunction render() {\n  draw(', 'function render() {\n  draw(board);\n}')).toBe('const board = makeBoard();\nfunction render() {\n  draw(board);\n}'));
  it('drops a markdown fence the model opened again', () => expect(joinContinuation('let x = 1;\n', '```javascript\nlet y = 2;\n```')).toBe('let x = 1;\nlet y = 2;\n'));
  it('starts from nothing', () => expect(joinContinuation('', 'let x = 1;')).toBe('let x = 1;'));
  it('ignores short accidental overlaps', () => expect(joinContinuation('a = b;\n', 'b;\nc = d;')).toBe('a = b;\nb;\nc = d;'));
  it('has limits that keep a file under the scan’s 300 KB', () => {
    expect(MAX_PARTS).toBe(5);
    expect(MAX_SO_FAR_CHARS).toBeLessThanOrEqual(280_000);
  });
});
