export const BOOK_ILLUSTRATION_CONTRACT_VERSION = 1 as const;

export type BookIllustrationRequest = {
  version: typeof BOOK_ILLUSTRATION_CONTRACT_VERSION;
  selection: { text: string };
  reading: { context: { before: string; after: string } };
};

const MAX_SELECTION_SCALARS = 700;
const MAX_CONTEXT_SCALARS_PER_SIDE = 600;

export function isBookIllustrationRequest(value: unknown): value is BookIllustrationRequest {
  if (!isRecord(value) || value.version !== BOOK_ILLUSTRATION_CONTRACT_VERSION || !hasExactKeys(value, ['version', 'selection', 'reading'])) return false;
  const selection = value.selection;
  const reading = value.reading;
  if (!isRecord(selection) || !hasExactKeys(selection, ['text']) || !isBoundedString(selection.text, MAX_SELECTION_SCALARS, false)) return false;
  if (!isRecord(reading) || !hasExactKeys(reading, ['context']) || !isRecord(reading.context) || !hasExactKeys(reading.context, ['before', 'after'])) return false;
  return isBoundedString(reading.context.before, MAX_CONTEXT_SCALARS_PER_SIDE, true)
    && isBoundedString(reading.context.after, MAX_CONTEXT_SCALARS_PER_SIDE, true);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

function isBoundedString(value: unknown, maximum: number, allowEmpty: boolean): value is string {
  return typeof value === 'string' && (allowEmpty || value.length > 0) && [...value].length <= maximum;
}
