import { lazy, Suspense } from 'react';

import { IS_LOCAL_FIRST_ENABLED } from '@/local-first/constants/IS_LOCAL_FIRST_ENABLED';

// Everything local-first stays behind this gate and this lazy import: with
// the flag off (the default, and every deployed build) none of the
// PGlite/Electric code is downloaded, no WASM is instantiated, and no
// IndexedDB database is created.
const LocalFirstDebugPanel = lazy(() =>
  import('@/local-first/components/LocalFirstDebugPanel').then((module) => ({
    default: module.LocalFirstDebugPanel,
  })),
);

export const LocalFirstDebugPanelGate = () => {
  if (!IS_LOCAL_FIRST_ENABLED) return null;

  return (
    <Suspense fallback={null}>
      <LocalFirstDebugPanel />
    </Suspense>
  );
};
