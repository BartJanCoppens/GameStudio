import { parse } from 'acorn';

/** A syntax error in game code (with its line), or null. Parsing only: the code never runs here. */
export function jsSyntaxProblem(js: string): string | null {
  try {
    parse(js, { ecmaVersion: 'latest', sourceType: 'script', allowAwaitOutsideFunction: false });
    return null;
  } catch (e) {
    const err = e as { message?: string; loc?: { line: number } };
    return `The game logic has a syntax error on line ${err.loc?.line ?? '?'}: ${(err.message ?? '').replace(/\s*\(\d+:\d+\)$/, '')}`;
  }
}
