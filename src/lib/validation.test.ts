import { describe, expect, it } from 'vitest';
import {
  composeStudentId,
  normalizeClassNum,
  validateHomeRental,
  validateProfileFields,
  validateSlots,
} from './validation';

describe('profile validation', () => {
  it('normalizes a class and composes a five-digit student id', () => {
    expect(normalizeClassNum('3')).toBe('03');
    expect(composeStudentId('2', '3', '7')).toBe('20307');
  });

  it('rejects out-of-range student information', () => {
    expect(validateProfileFields({ name: '홍길동', role: 'student', grade: '4', classNum: '3', studentNum: '7' })).toContain('학년');
    expect(validateProfileFields({ name: '홍길동', role: 'student', grade: '2', classNum: '21', studentNum: '7' })).toContain('반');
  });
});

describe('rental validation', () => {
  it('rejects an end date earlier than the start date', () => {
    expect(validateHomeRental('2099-05-10', '2099-05-09', '')).toContain('빠를 수 없습니다');
  });

  it('rejects rentals longer than 30 days', () => {
    expect(validateHomeRental('2099-05-01', '2099-06-01', '')).toContain('최대 30일');
  });

  it('accepts valid unique school slots and rejects duplicates', () => {
    expect(validateSlots([{ dayIdx: 0, periodIdx: 0 }, { dayIdx: 4, periodIdx: 8 }])).toBeNull();
    expect(validateSlots([{ dayIdx: 0, periodIdx: 0 }, { dayIdx: 0, periodIdx: 0 }])).toContain('중복');
  });
});
