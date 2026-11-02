import { ViewType } from '../types';

// Each page opens in its own browser tab, addressed by the query string.
export interface PageParams {
  view?: ViewType;
  page?: 'detail' | 'type' | 'status';
  type?: 'home' | 'class';
  status?: 'approved' | 'rejected';
  request?: string;
  tab?: 'students';
  student?: string;
}

const KEYS: (keyof PageParams)[] = ['view', 'page', 'type', 'status', 'request', 'tab', 'student'];

export const buildPageQuery = (params: PageParams) => {
  const query = new URLSearchParams();
  KEYS.forEach((key) => { if (params[key]) query.set(key, params[key] as string); });
  return `?${query.toString()}`;
};

// Callers still validate these values: anyone can type a query string.
export const readPageParams = (search: string): PageParams => {
  const query = new URLSearchParams(search);
  const params: Record<string, string> = {};
  KEYS.forEach((key) => {
    const value = query.get(key);
    if (value) params[key] = value;
  });
  return params as PageParams;
};

export const openNewPage = (params: PageParams) => {
  const query = buildPageQuery(params);
  const url = `${window.location.pathname}${query}`;
  // Reusing one tab per address stops repeat clicks from piling up tabs.
  const opened = window.open(url, `icjs${query.replace(/[^a-zA-Z0-9]/g, '-')}`);
  if (opened) opened.focus();
  else window.location.assign(url);
};

// Browsers only let a page close a tab that a script opened. A tab reached any
// other way stays open, so it moves to the fallback page instead.
export const closePage = (fallback: PageParams) => {
  window.close();
  window.setTimeout(() => {
    window.location.assign(`${window.location.pathname}${buildPageQuery(fallback)}`);
  }, 200);
};
