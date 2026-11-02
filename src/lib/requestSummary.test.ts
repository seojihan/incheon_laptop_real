import { describe, expect, it } from 'vitest';
import { LaptopRequest } from '../types';
import { buildStudentActivity, formatRentalWhen } from './requestSummary';
import { getSessionSignedInAt, isSessionInvalidated } from './sessionReset';

const base: LaptopRequest = {
  id: 'r1', userId: 'u1', userName: '홍길동', studentId: '20307', grade: '2', classNum: '03',
  type: 'home', status: 'pending', startDate: '2026-11-03', endDate: '2026-11-10', createdAt: '2026-11-01T00:00:00Z',
};
const jwtWith = (payload: unknown) => `x.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.y`;

describe('formatRentalWhen', () => {
  it('shows the period of a home rental', () => {
    expect(formatRentalWhen(base)).toBe('2026-11-03 ~ 2026-11-10');
  });

  it('summarizes several class periods on one line', () => {
    const when = formatRentalWhen({
      ...base, type: 'class', endDate: undefined, weekLabel: '11월 1주 · 11/02~11/06',
      slots: [{ dayIdx: 0, periodIdx: 0 }, { dayIdx: 1, periodIdx: 1 }, { dayIdx: 2, periodIdx: 2 }],
    });
    expect(when).toContain('외 2개 교시');
  });
});

describe('buildStudentActivity', () => {
  it('lists events newest first with the rejection reason', () => {
    const events = buildStudentActivity([{ ...base, status: 'rejected', reviewedAt: '2026-11-02T00:00:00Z', reviewNote: '기간 초과' }]);
    expect(events.map((event) => event.title)).toEqual(['가정 대여 반려', '가정 대여 신청']);
    expect(events[0].detail).toBe('기간 초과');
  });

  it('keeps the approval and adds the return for a returned rental', () => {
    const events = buildStudentActivity([{ ...base, status: 'returned', notebookNumber: 7, reviewedAt: '2026-11-02T00:00:00Z', updatedAt: '2026-11-05T00:00:00Z' }]);
    expect(events.map((event) => event.title)).toEqual(['노트북 반납', '가정 대여 승인', '가정 대여 신청']);
  });
});

describe('forced sign-out check', () => {
  const signedIn = Date.parse('2026-11-02T01:00:00Z');

  it('signs out a session that started before the reset', () => {
    expect(isSessionInvalidated('2026-11-02T02:00:00Z', signedIn)).toBe(true);
  });

  it('keeps the new session after the student signs in again', () => {
    expect(isSessionInvalidated('2026-11-02T00:30:00Z', signedIn)).toBe(false);
  });

  it('keeps the session when the reset or sign-in time is unknown', () => {
    expect(isSessionInvalidated(null, signedIn)).toBe(false);
    expect(isSessionInvalidated('2026-11-02T02:00:00Z', null)).toBe(false);
    expect(isSessionInvalidated('not-a-date', signedIn)).toBe(false);
  });

  it('prefers the session sign-in time in the token over the profile time', () => {
    const token = jwtWith({ amr: [{ method: 'oauth', timestamp: signedIn / 1000 }] });
    expect(getSessionSignedInAt(token, '2020-01-01T00:00:00Z')).toBe(signedIn);
  });

  it('falls back to the last sign-in time and tolerates a malformed token', () => {
    expect(getSessionSignedInAt('garbage', '2026-11-02T01:00:00Z')).toBe(signedIn);
    expect(getSessionSignedInAt(undefined, null)).toBeNull();
  });
});
