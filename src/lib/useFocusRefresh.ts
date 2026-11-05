import { useEffect, useRef } from 'react';

// Pages live in their own tabs, so work done in another tab has to show up when
// this one is looked at again. Callers refresh without a loading state, so search
// text, filters and open forms on the page stay as they were. With intervalMs it
// also repeats while the tab is showing, for lists that change while being watched.
export function useFocusRefresh(refresh: () => void, intervalMs?: number) {
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible') latest.current();
    };
    window.addEventListener('focus', handleFocus);
    const timer = intervalMs ? window.setInterval(handleFocus, intervalMs) : undefined;
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}
