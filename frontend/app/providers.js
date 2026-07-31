'use client';

import { AppProvider } from '@/lib/store';

export default function Providers({ children }) {
  return <AppProvider>{children}</AppProvider>;
}
