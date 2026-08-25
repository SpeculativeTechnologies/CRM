import { act, renderHook } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import {
  TIPTAP_DOCUMENT_SCHEMA_VERSION,
  type TipTapNode,
} from 'twenty-shared/utils';

import { useEmailSignatureComposer } from '@/activities/emails/signature/hooks/useEmailSignatureComposer';
import {
  type CurrentWorkspaceMember,
  currentWorkspaceMemberState,
} from '@/auth/states/currentWorkspaceMemberState';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';

const serializeDocument = (content: TipTapNode[]): string =>
  JSON.stringify({
    type: 'doc',
    attrs: { schemaVersion: TIPTAP_DOCUMENT_SCHEMA_VERSION },
    content,
  });

const paragraph = (text: string): TipTapNode => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

const SIGNATURE = serializeDocument([paragraph('Ada Lovelace')]);

const setCurrentWorkspaceMember = ({
  emailSignature,
  isEmailSignatureIncludedByDefault,
}: {
  emailSignature: string | null;
  isEmailSignatureIncludedByDefault: boolean;
}) => {
  jotaiStore.set(currentWorkspaceMemberState.atom, {
    id: 'workspace-member-1',
    name: { firstName: 'Ada', lastName: 'Lovelace' },
    locale: 'en',
    colorScheme: 'Light',
    userEmail: 'ada@example.com',
    avatarUrl: null,
    emailSignature,
    isEmailSignatureIncludedByDefault,
  } as unknown as CurrentWorkspaceMember);
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <JotaiProvider store={jotaiStore}>{children}</JotaiProvider>
);

describe('useEmailSignatureComposer', () => {
  it('should hide the toggle when the member has no signature', () => {
    setCurrentWorkspaceMember({
      emailSignature: null,
      isEmailSignatureIncludedByDefault: true,
    });

    const { result } = renderHook(
      () => useEmailSignatureComposer({ isEnabled: true, initialBody: '' }),
      { wrapper },
    );

    expect(result.current.isSignatureToggleVisible).toBe(false);
    expect(result.current.initialBody).toBe('');
  });

  it('should hide the toggle on surfaces that did not opt in', () => {
    setCurrentWorkspaceMember({
      emailSignature: SIGNATURE,
      isEmailSignatureIncludedByDefault: true,
    });

    const { result } = renderHook(
      () => useEmailSignatureComposer({ initialBody: '' }),
      { wrapper },
    );

    expect(result.current.isSignatureToggleVisible).toBe(false);
    expect(result.current.initialBody).toBe('');
  });

  it('should not seed the body when inclusion is not the default', () => {
    setCurrentWorkspaceMember({
      emailSignature: SIGNATURE,
      isEmailSignatureIncludedByDefault: false,
    });

    const { result } = renderHook(
      () => useEmailSignatureComposer({ isEnabled: true, initialBody: '' }),
      { wrapper },
    );

    expect(result.current.isSignatureToggleVisible).toBe(true);
    expect(result.current.initialBody).toBe('');
    expect(result.current.isSignatureIncludedIn('')).toBe(false);
  });

  it('should seed an empty body when inclusion is the default', () => {
    setCurrentWorkspaceMember({
      emailSignature: SIGNATURE,
      isEmailSignatureIncludedByDefault: true,
    });

    const { result } = renderHook(
      () => useEmailSignatureComposer({ isEnabled: true, initialBody: '' }),
      { wrapper },
    );

    expect(
      result.current.isSignatureIncludedIn(result.current.initialBody),
    ).toBe(true);
  });

  it('should leave a prefilled body alone even when inclusion is the default', () => {
    setCurrentWorkspaceMember({
      emailSignature: SIGNATURE,
      isEmailSignatureIncludedByDefault: true,
    });

    const draftBody = serializeDocument([paragraph('Half-written reply')]);

    const { result } = renderHook(
      () =>
        useEmailSignatureComposer({
          isEnabled: true,
          initialBody: draftBody,
        }),
      { wrapper },
    );

    expect(result.current.initialBody).toBe(draftBody);
    expect(result.current.isSignatureIncludedIn(draftBody)).toBe(false);
  });

  it('should not seed the body when seeding is disabled', () => {
    setCurrentWorkspaceMember({
      emailSignature: SIGNATURE,
      isEmailSignatureIncludedByDefault: true,
    });

    const { result } = renderHook(
      () =>
        useEmailSignatureComposer({
          isEnabled: true,
          initialBody: '',
          shouldSeedInitialBody: false,
        }),
      { wrapper },
    );

    expect(result.current.isSignatureToggleVisible).toBe(true);
    expect(result.current.initialBody).toBe('');
  });

  it('should add then remove the signature without disturbing the body', () => {
    setCurrentWorkspaceMember({
      emailSignature: SIGNATURE,
      isEmailSignatureIncludedByDefault: false,
    });

    const body = serializeDocument([paragraph('Hello Grace')]);

    const { result } = renderHook(
      () => useEmailSignatureComposer({ isEnabled: true, initialBody: body }),
      { wrapper },
    );

    let bodyWithSignature = '';

    act(() => {
      bodyWithSignature = result.current.applySignatureInclusion(body, true);
    });

    expect(result.current.isSignatureIncludedIn(bodyWithSignature)).toBe(true);

    let bodyWithoutSignature = '';

    act(() => {
      bodyWithoutSignature = result.current.applySignatureInclusion(
        bodyWithSignature,
        false,
      );
    });

    expect(bodyWithoutSignature).toBe(body);
  });

  it('should change the resync key on every toggle so the editor remounts', () => {
    setCurrentWorkspaceMember({
      emailSignature: SIGNATURE,
      isEmailSignatureIncludedByDefault: false,
    });

    const { result } = renderHook(
      () => useEmailSignatureComposer({ isEnabled: true, initialBody: '' }),
      { wrapper },
    );

    const initialResyncKey = result.current.signatureResyncKey;

    act(() => {
      result.current.applySignatureInclusion('', true);
    });

    expect(result.current.signatureResyncKey).not.toBe(initialResyncKey);
  });
});
