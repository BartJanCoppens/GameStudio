import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import tiny from '../../e2e/fixtures/tiny-game.json';
import type { GameContent } from './content';
import { exportZipBytes } from './exportZip';

describe('exportZipBytes', () => {
  const content = tiny as unknown as GameContent;
  const files = unzipSync(exportZipBytes({ key: 'tiny-quiz', title: 'Tiny quiz' }, content));

  it('contains the game, its parts and a readme', () => {
    expect(Object.keys(files).sort()).toEqual(['README.md', 'concept.json', 'data.json', 'game.js', 'index.html', 'sources.json', 'style.css']);
  });
  it('keeps the game content and the linked sources', () => {
    expect(JSON.parse(strFromU8(files['data.json']))).toEqual(content.data);
    expect(JSON.parse(strFromU8(files['sources.json'])).map((s: { id: string }) => s.id)).toEqual(content.concept!.sources);
  });
  it('runs on its own with a local stand-in for the platform', () => {
    const html = strFromU8(files['index.html']);
    expect(html).toContain('window.GameStudio');
    expect(html).toContain('(AI replies need the platform)');
    expect(html).not.toContain('gamestudio-host');
    expect(html).toContain(content.files!['game.js']!.slice(0, 40));
  });
  it('says the protections no longer apply', () => {
    expect(strFromU8(files['README.md'])).toContain('no longer protected');
  });
  it('leaves out the AI role’s hidden knowledge', () => {
    expect(Object.keys(files)).not.toContain('ai.json');
  });
});

describe('exportZipBytes with awkward content', () => {
  it('keeps the page intact when the content contains </script> or $&', () => {
    const tricky = { ...(tiny as unknown as GameContent), data: { note: '</script><b>broken</b>', price: 'costs $& and $1' } };
    const html = strFromU8(unzipSync(exportZipBytes({ key: 'tricky', title: 'Tricky' }, tricky))['index.html']);
    expect(html).not.toContain('</script><b>broken');
    expect(html).toContain('costs $& and $1');
    expect(html).not.toContain('gamestudio-host');
  });
});
