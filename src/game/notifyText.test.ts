import { describe, expect, it } from 'vitest';
import { isPushEndpoint, notificationText } from '../../supabase/functions/_shared/notifyText.ts';

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

describe('no links in notifications', () => {
  it('strips link-like text from names and titles', () => {
    const text = notificationText('invite', 'Sam https://evil.example/login', 'Duel www.evil.example');
    expect(text).not.toMatch(/https?:|www\.|evil\.example\//);
    expect(text).toContain('Sam');
    expect(text).toContain('Duel');
  });
  it('breaks up bare domain names, and keeps initials', () => {
    const text = notificationText('turn', 'Sam V. evil.example', 'Visit login.evil.example/reset now');
    expect(text).not.toMatch(/[\w-]\.[\w-]/);
    expect(text).toContain('Sam V.');
  });
});

describe('isPushEndpoint', () => {
  it('accepts the browsers’ push services only', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=abc')).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(isPushEndpoint('https://evil.example/fcm.googleapis.com')).toBe(false);
    expect(isPushEndpoint('https://fcm.googleapis.com.evil.example/x')).toBe(false);
    expect(isPushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(isPushEndpoint('https://169.254.169.254/latest')).toBe(false);
  });
});

