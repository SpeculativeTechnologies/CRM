export const quoteLocalIdentifier = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`;
