// Long files are written in parts: when one answer reaches its length limit, the next call continues where it
// stopped. Shared by game-builder (which joins the last part) and the Studio (which asks for the next one).

/** At most this many answers for one file (about 60,000 tokens): long games, still under the 300 KB file scan. */
export const MAX_PARTS = 5;
/** The most a "written so far" may hold when asking for the next part. */
export const MAX_SO_FAR_CHARS = 280_000;

/** The instruction that turns a request into "continue this file". */
export const continueText = (soFar: string) =>
  `<written_so_far>\n${soFar}\n</written_so_far>\n\nThe file above was cut off at the length limit of one answer. Continue it from exactly where it stops: output only the rest, starting with the very next characters. Don't repeat anything that is already there, and add no explanations or markdown fences.`;

/** Joins the next part on, dropping a fence the model opened again and text it repeated at the seam. */
export function joinContinuation(soFar: string, next: string): string {
  const rest = next.replace(/^\s*```[a-z]*\n/i, '').replace(/```\s*$/, '');
  if (!soFar) return rest;
  // The longest start of the new part that the file already ends with (at least 20 characters, so a short
  // coincidence like "b;\n" isn't taken for a repeat).
  for (let k = Math.min(400, soFar.length, rest.length); k >= 20; k--) {
    if (soFar.endsWith(rest.slice(0, k))) return soFar + rest.slice(k);
  }
  return soFar + rest;
}
