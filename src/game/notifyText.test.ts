import { describe, expect, it } from 'vitest';
import { notificationText } from '../../supabase/functions/_shared/notifyText.ts';

describe('notificationText', () => {
  it('says whose turn it is and nothing about the game’s content', () => {
    expect(notificationText('turn', 'Sam V.', 'Tiny duel')).toBe('Sam V. made a move in Tiny duel · your turn');
    expect(notificationText('invite', 'Sam V.', 'Tiny duel')).toBe('Sam V. invites you to play Tiny duel');
    expect(notificationText('accepted', 'Sam V.', 'Tiny duel')).toBe('Sam V. accepted your invitation · Tiny duel has started');
    expect(notificationText('declined', 'Sam V.', 'Tiny duel')).toBe('Sam V. declined your invitation to Tiny duel');
  });
  it('keeps long names and titles short', () => {
    expect(notificationText('turn', 'x'.repeat(300), 'y'.repeat(300)).length).toBeLessThanOrEqual(200);
  });
});
