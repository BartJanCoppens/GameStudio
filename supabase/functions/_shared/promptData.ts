// Creator, player and game text goes into prompts inside tags such as <game>…</game>, as data. Serialized
// with every "<" escaped, it can't close its tag and pose as instructions outside it.

export const asData = (value: unknown): string => JSON.stringify(value ?? null).replace(/</g, '\\u003c');

/** Plain text (a request, an HTML file) inside <tag>…</tag>: readable as is, but its own tag name is defused. */
export const inTag = (tag: string, text: string): string =>
  `<${tag}>\n${text.replace(new RegExp(`<(/?)${tag}`, 'gi'), '<$1​' + tag)}\n</${tag}>`;
