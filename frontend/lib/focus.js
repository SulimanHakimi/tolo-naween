'use client';

import { useEffect } from 'react';

const KEY = 'tn_focus';

/**
 * Picks up the term handed over by the topbar search and drops it into the page's
 * own filter box. Read once and cleared immediately, so a term meant for one page
 * can never resurface in another page's search box later in the session.
 *
 * Every page the topbar can navigate to must call this, otherwise the handoff is
 * silently dropped and the stale key lingers.
 */
export function useFocusTerm(apply) {
  useEffect(() => {
    const term = sessionStorage.getItem(KEY);
    if (!term) return;
    sessionStorage.removeItem(KEY);
    apply(term);
    // Runs once on mount; `apply` is always a fresh setState from the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
