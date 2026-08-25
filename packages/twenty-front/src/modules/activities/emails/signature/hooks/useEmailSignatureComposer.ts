import { useState } from 'react';

import { useCurrentUserEmailSignature } from '@/activities/emails/signature/hooks/useCurrentUserEmailSignature';
import {
  hasEmailSignature,
  insertEmailSignature,
  resolveInitialEmailSignatureInclusion,
  setEmailSignatureIncluded,
} from '@/activities/emails/signature/utils/emailSignatureDocument';

type UseEmailSignatureComposerArgs = {
  // Surfaces opt in: thread replies never offer a signature.
  isEnabled?: boolean;
  // The body the composer would start from without a signature.
  initialBody: string;
  // Composers whose body lives in a persisted draft they do not own at mount
  // pass false: they offer the toggle but never rewrite the stored draft on
  // their own.
  shouldSeedInitialBody?: boolean;
};

export const useEmailSignatureComposer = ({
  isEnabled = false,
  initialBody: upstreamInitialBody,
  shouldSeedInitialBody = true,
}: UseEmailSignatureComposerArgs) => {
  const { serializedSignature, isIncludedByDefault, isSignatureAvailable } =
    useCurrentUserEmailSignature({ isEnabled });

  const [initialBody] = useState(() =>
    shouldSeedInitialBody &&
    resolveInitialEmailSignatureInclusion({
      isSignatureAvailable,
      isIncludedByDefault,
      serializedBody: upstreamInitialBody,
    })
      ? insertEmailSignature({
          serializedBody: upstreamInitialBody,
          serializedSignature,
        })
      : upstreamInitialBody,
  );

  const [signatureResyncNonce, setSignatureResyncNonce] = useState(0);

  // Read from the body rather than kept alongside it, so the toggle tells the
  // truth after the user edits or deletes the inserted block by hand.
  const isSignatureIncludedIn = (serializedBody: string): boolean =>
    hasEmailSignature({ serializedBody, serializedSignature });

  // Returns the next body instead of writing it, because each composer owns
  // its body differently (local state, a debounced draft, a template).
  const applySignatureInclusion = (
    serializedBody: string,
    isIncluded: boolean,
  ): string => {
    // The editors read their content from defaultValue on mount only, so a
    // body the toggle rewrote reaches them through a key change.
    setSignatureResyncNonce((previousNonce) => previousNonce + 1);

    return setEmailSignatureIncluded({
      serializedBody,
      serializedSignature,
      isIncluded,
    });
  };

  return {
    isSignatureToggleVisible: isSignatureAvailable,
    initialBody,
    isSignatureIncludedIn,
    applySignatureInclusion,
    signatureResyncKey: `signature-${signatureResyncNonce}`,
  };
};

export type EmailSignatureComposerState = ReturnType<
  typeof useEmailSignatureComposer
>;
