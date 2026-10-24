import { describe, expect, it } from 'vitest';
import { jsSyntaxProblem } from './syntax';

describe('jsSyntaxProblem', () => {
  it('accepts valid game code', () => expect(jsSyntaxProblem('(async () => { await GameStudio.ready(); })();')).toBeNull());
  it('reports a syntax error with its line', () => expect(jsSyntaxProblem('function f( {\n  return 1;\n}')).toMatch(/line 2/));
  it('reports truncated code', () => expect(jsSyntaxProblem('(async () => { const x = [1, 2,')).not.toBeNull());
});
