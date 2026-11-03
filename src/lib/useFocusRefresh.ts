import { useEffect, useRef } from 'react';

// Pages live in their own tabs, so work done in another tab has to show up when
// this one is looked at again. Callers refresh without a loading state, so search
// text, filters and open forms on the page stay as they were.
export function useFocusRefresh(refresh: () => void) {
  const latest = useRef(refresh);
  latest.current = refresh;

  useEffect(() => {
    const handleFocus = () => {
      if (document.visibilityState === 'visible') latest.current();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);
}
