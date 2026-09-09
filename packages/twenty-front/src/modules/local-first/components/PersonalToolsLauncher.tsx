import { Trans } from '@lingui/react/macro';
import { useState } from 'react';

export const PersonalToolsLauncher = () => {
  const [error, setError] = useState(false);
  const open = () => {
    localStorage.removeItem('twenty-personal-tools-locked');
    window.location.assign('/local-workspace/');
  };
  const copy = async () => {
    try {
      const { copyCurrentRecordToPersonalTools } =
        await import('@/local-first/services/copyCurrentRecordToPersonalTools');
      await copyCurrentRecordToPersonalTools();
      open();
    } catch {
      setError(true);
    }
  };
  return (
    <>
      <p>
        <a
          href="/local-workspace/"
          onClick={() =>
            localStorage.removeItem('twenty-personal-tools-locked')
          }
        >
          <Trans>Open personal tools</Trans>
        </a>
      </p>
      {window.location.pathname.startsWith('/object/') && (
        <button onClick={() => void copy()}>
          <Trans>Copy this record into a personal tool</Trans>
        </button>
      )}
      {error && (
        <p role="alert">
          <Trans>
            The record could not be copied. Open a loaded CRM record with
            readable text, number or checkbox fields and try again.
          </Trans>
        </p>
      )}
    </>
  );
};
