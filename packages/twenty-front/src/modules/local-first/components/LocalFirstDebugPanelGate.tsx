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

// Booting PGlite takes long enough that a list query issued during page load
// beats it and falls back to the network. Starting the mirror as early as the
// module graph allows, rather than waiting for the panel to mount, is what
// lets the first query of a page actually be served locally.
if (IS_LOCAL_FIRST_ENABLED) {
  void import('@/local-first/services/getLocalFirstMirror').then(
    ({ getLocalFirstMirror }) => {
      // Failures are the sync loop's problem to report and retry.
      void getLocalFirstMirror().catch(() => {});
    },
  );
}

export const LocalFirstDebugPanelGate = () => {
  if (!IS_LOCAL_FIRST_ENABLED) return null;

  return (
    <Suspense fallback={null}>
      <LocalFirstDebugPanel />
    </Suspense>
  );
};
