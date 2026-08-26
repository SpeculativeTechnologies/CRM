import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { isEmailSignatureBlank } from '@/activities/emails/signature/utils/emailSignatureDocument';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

type UseCurrentUserEmailSignatureArgs = {
  // Composers that must never offer a signature (thread replies) pass false,
  // so the affordance is opt-in per surface as well as per email.
  isEnabled?: boolean;
};

export const useCurrentUserEmailSignature = ({
  isEnabled = true,
}: UseCurrentUserEmailSignatureArgs = {}) => {
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);

  const serializedSignature = currentWorkspaceMember?.emailSignature ?? '';

  return {
    serializedSignature,
    isIncludedByDefault:
      currentWorkspaceMember?.isEmailSignatureIncludedByDefault ?? false,
    isSignatureAvailable:
      isEnabled && !isEmailSignatureBlank(serializedSignature),
  };
};
