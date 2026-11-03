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
  // One tab per address stops repeat clicks from piling up tabs. An empty address
  // finds that tab without reloading it, so its checks and typed text survive.
  const opened = window.open('', `icjs${query.replace(/[^a-zA-Z0-9]/g, '-')}`);
  if (!opened) {
    window.location.assign(url);
    return;
  }
  let alreadyThere = false;
  try {
    alreadyThere = opened.location.pathname + opened.location.search === url;
  } catch {
    // That tab is on another site, such as the Google sign-in page.
  }
  if (!alreadyThere) opened.location.href = url;
  opened.focus();
};

// A tab that went back to home is no longer "the tab" for the page it first opened.
export const releaseTabName = () => {
  window.name = '';
};

// Browsers only let a page close a tab that a script opened. A tab reached any
// other way stays open, so it moves to the fallback page instead.
export const closePage = (fallback: PageParams) => {
  window.close();
  window.setTimeout(() => {
    window.location.assign(`${window.location.pathname}${buildPageQuery(fallback)}`);
  }, 200);
};
