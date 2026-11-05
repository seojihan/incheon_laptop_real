import { describe, expect, it } from 'vitest';
import { isSignedOutByTeacher } from './sessionReset';

describe('isSignedOutByTeacher', () => {
  it('is true when the sign-out is newer than the last login', () => {
    expect(isSignedOutByTeacher('2026-11-05T12:00:00Z', '2026-11-05T11:00:00Z')).toBe(true);
    expect(isSignedOutByTeacher('2026-11-05T12:00:00Z', null)).toBe(true);
  });

  it('is false once the student has signed in again', () => {
    expect(isSignedOutByTeacher('2026-11-05T12:00:00Z', '2026-11-05T12:05:00Z')).toBe(false);
  });

  it('is false when no sign-out was ever requested', () => {
    expect(isSignedOutByTeacher(null, '2026-11-05T12:00:00Z')).toBe(false);
  });
});
