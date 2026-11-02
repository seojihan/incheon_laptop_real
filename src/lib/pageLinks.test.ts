import { describe, expect, it } from 'vitest';
import { buildPageQuery, readPageParams } from './pageLinks';

describe('page links', () => {
  it('round-trips a request detail address', () => {
    const params = { view: 'admin-approval', page: 'detail', request: 'abc-123' } as const;
    expect(readPageParams(buildPageQuery(params))).toEqual(params);
  });

  it('ignores unknown keys and an empty address', () => {
    expect(readPageParams('?view=records&evil=1')).toEqual({ view: 'records' });
    expect(readPageParams('')).toEqual({});
  });
});
