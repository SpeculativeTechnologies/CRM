import {
  isDefined,
  parseCanonicalTipTapJsonDocument,
  TIPTAP_DOCUMENT_SCHEMA_VERSION,
  TIPTAP_NODE_TYPES,
  type TipTapDocument,
  type TipTapNode,
} from 'twenty-shared/utils';

// Bodies and signatures are both serialized TipTap documents, so the signature
// is appended as document blocks instead of as an HTML string: nothing new and
// unsanitized enters the email pipeline, and the user can edit or delete the
// inserted blocks like any other part of the draft.

// Nodes that carry meaning without carrying text, so a signature made only of
// them still counts as filled in.
const CONTENT_BEARING_NODE_TYPES: string[] = [
  TIPTAP_NODE_TYPES.IMAGE,
  TIPTAP_NODE_TYPES.VARIABLE_TAG,
  TIPTAP_NODE_TYPES.MENTION_TAG,
  TIPTAP_NODE_TYPES.BUTTON,
  TIPTAP_NODE_TYPES.DIVIDER,
  TIPTAP_NODE_TYPES.HTML,
];

const buildEmptyParagraph = (): TipTapNode => ({
  type: TIPTAP_NODE_TYPES.PARAGRAPH,
});

const isEmptyParagraph = (node: TipTapNode): boolean =>
  node.type === TIPTAP_NODE_TYPES.PARAGRAPH &&
  (node.content ?? []).length === 0;

const hasVisibleContent = (nodes: TipTapNode[]): boolean =>
  nodes.some(
    (node) =>
      (isDefined(node.text) && node.text.trim() !== '') ||
      CONTENT_BEARING_NODE_TYPES.includes(node.type) ||
      hasVisibleContent(node.content ?? []),
  );

// Comparing type and text only: the composer schema fills in default node
// attributes when it parses a document, so an attribute-sensitive comparison
// would stop recognising a signature it had just inserted.
const toBlockSkeleton = (node: TipTapNode): unknown => ({
  type: node.type,
  text: node.text,
  content: node.content?.map(toBlockSkeleton),
});

const areBlocksEquivalent = (
  leftBlocks: TipTapNode[],
  rightBlocks: TipTapNode[],
): boolean =>
  JSON.stringify(leftBlocks.map(toBlockSkeleton)) ===
  JSON.stringify(rightBlocks.map(toBlockSkeleton));

const parseBodyDocument = (
  serializedBody: string,
): TipTapDocument | undefined => {
  if (serializedBody.trim() === '') {
    return {
      type: TIPTAP_NODE_TYPES.DOCUMENT,
      attrs: { schemaVersion: TIPTAP_DOCUMENT_SCHEMA_VERSION },
      content: [],
    };
  }

  return parseCanonicalTipTapJsonDocument(serializedBody);
};

const serializeBodyDocument = (
  document: TipTapDocument,
  blocks: TipTapNode[],
): string =>
  JSON.stringify({
    ...document,
    // A document with no block at all is not a valid TipTap document, so an
    // emptied body keeps one paragraph to put the caret in.
    content: blocks.length === 0 ? [buildEmptyParagraph()] : blocks,
  });

export const parseEmailSignatureBlocks = (
  serializedSignature: string | null | undefined,
): TipTapNode[] => {
  if (!isDefined(serializedSignature) || serializedSignature.trim() === '') {
    return [];
  }

  const signatureDocument =
    parseCanonicalTipTapJsonDocument(serializedSignature);
  const signatureBlocks = signatureDocument?.content ?? [];

  return hasVisibleContent(signatureBlocks) ? signatureBlocks : [];
};

export const isEmailSignatureBlank = (
  serializedSignature: string | null | undefined,
): boolean => parseEmailSignatureBlocks(serializedSignature).length === 0;

export const isEmailBodyEmpty = (serializedBody: string): boolean => {
  if (serializedBody.trim() === '') {
    return true;
  }

  const bodyDocument = parseCanonicalTipTapJsonDocument(serializedBody);

  if (!isDefined(bodyDocument)) {
    return false;
  }

  return !hasVisibleContent(bodyDocument.content ?? []);
};

// The "on by default" preference seeds a draft only while there is nothing to
// disturb, so revisiting a draft the user already wrote never rewrites it.
export const resolveInitialEmailSignatureInclusion = ({
  isSignatureAvailable,
  isIncludedByDefault,
  serializedBody,
}: {
  isSignatureAvailable: boolean;
  isIncludedByDefault: boolean;
  serializedBody: string;
}): boolean =>
  isSignatureAvailable &&
  isIncludedByDefault &&
  isEmailBodyEmpty(serializedBody);

type EmailSignatureBodyArgs = {
  serializedBody: string;
  serializedSignature: string | null | undefined;
};

// Bodies written before the editor moved to TipTap JSON are still raw HTML;
// they cannot be edited block by block, so the signature control stays hidden
// for them rather than silently doing nothing.
export const canInsertEmailSignature = ({
  serializedBody,
  serializedSignature,
}: EmailSignatureBodyArgs): boolean =>
  isDefined(parseBodyDocument(serializedBody)) &&
  !isEmailSignatureBlank(serializedSignature);

export const hasEmailSignature = ({
  serializedBody,
  serializedSignature,
}: EmailSignatureBodyArgs): boolean => {
  const bodyDocument = parseBodyDocument(serializedBody);
  const signatureBlocks = parseEmailSignatureBlocks(serializedSignature);

  if (!isDefined(bodyDocument) || signatureBlocks.length === 0) {
    return false;
  }

  const bodyBlocks = bodyDocument.content ?? [];

  if (bodyBlocks.length < signatureBlocks.length) {
    return false;
  }

  return areBlocksEquivalent(
    bodyBlocks.slice(bodyBlocks.length - signatureBlocks.length),
    signatureBlocks,
  );
};

export const insertEmailSignature = ({
  serializedBody,
  serializedSignature,
}: EmailSignatureBodyArgs): string => {
  const bodyDocument = parseBodyDocument(serializedBody);
  const signatureBlocks = parseEmailSignatureBlocks(serializedSignature);

  if (!isDefined(bodyDocument) || signatureBlocks.length === 0) {
    return serializedBody;
  }

  if (hasEmailSignature({ serializedBody, serializedSignature })) {
    return serializedBody;
  }

  const bodyBlocks = bodyDocument.content ?? [];

  return serializeBodyDocument(bodyDocument, [
    ...bodyBlocks,
    buildEmptyParagraph(),
    ...signatureBlocks,
  ]);
};

export const removeEmailSignature = ({
  serializedBody,
  serializedSignature,
}: EmailSignatureBodyArgs): string => {
  const bodyDocument = parseBodyDocument(serializedBody);
  const signatureBlocks = parseEmailSignatureBlocks(serializedSignature);

  if (
    !isDefined(bodyDocument) ||
    signatureBlocks.length === 0 ||
    !hasEmailSignature({ serializedBody, serializedSignature })
  ) {
    return serializedBody;
  }

  const bodyBlocks = bodyDocument.content ?? [];
  const blocksBeforeSignature = bodyBlocks.slice(
    0,
    bodyBlocks.length - signatureBlocks.length,
  );

  const lastBlockBeforeSignature = blocksBeforeSignature.at(-1);

  // The blank line the insertion added as spacing goes away with it, but a
  // blank line the user left behind on purpose stays.
  const blocksWithoutSpacer =
    blocksBeforeSignature.length > 1 &&
    isDefined(lastBlockBeforeSignature) &&
    isEmptyParagraph(lastBlockBeforeSignature)
      ? blocksBeforeSignature.slice(0, -1)
      : blocksBeforeSignature;

  return serializeBodyDocument(bodyDocument, blocksWithoutSpacer);
};

export const setEmailSignatureIncluded = ({
  serializedBody,
  serializedSignature,
  isIncluded,
}: EmailSignatureBodyArgs & { isIncluded: boolean }): string =>
  isIncluded
    ? insertEmailSignature({ serializedBody, serializedSignature })
    : removeEmailSignature({ serializedBody, serializedSignature });
