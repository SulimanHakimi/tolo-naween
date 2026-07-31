'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders children at the end of <body> instead of inside the app shell.
 *
 * The printable documents need this: the print stylesheet hides `.app` so only the
 * bill or report reaches the paper, and a modal nested inside `.app` would be hidden
 * along with it. As a direct child of <body> it survives.
 *
 * Returns null on the server and until mount, since document does not exist there.
 */
export default function Portal({ children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  return ready ? createPortal(children, document.body) : null;
}
