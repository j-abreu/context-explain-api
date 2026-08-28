export const EXPLANATION_CONTRACT_VERSION = 6 as const;
export const WEB_EXPLANATION_CONTRACT_VERSION = 1 as const;
export const BOOK_EXPLANATION_CONTRACT_VERSION = 1 as const;
export const BOOK_EXPLANATION_V2_CONTRACT_VERSION = 2 as const;

export const EXPLANATION_LEVELS = ['simple', 'beginner', 'detailed'] as const;
export type ExplanationLevel = (typeof EXPLANATION_LEVELS)[number];

export type ExplanationSelectionSnapshot = {
  selectedText: string;
  context: {
    immediate: string;
    heading?: string;
    containingBlock: string;
    before?: string;
    after?: string;
  };
  page: {
    title: string;
    hostname: string;
    language?: string;
  };
};

export type ExplainRequest = {
  version: typeof EXPLANATION_CONTRACT_VERSION;
  selection: ExplanationSelectionSnapshot;
  preferences: {
    level: ExplanationLevel;
    responseLanguage?: string;
  };
};

export type WebExplainRequest = Omit<ExplainRequest, 'version'> & {
  version: typeof WEB_EXPLANATION_CONTRACT_VERSION;
};

export type BookExplainRequest = {
  version: typeof BOOK_EXPLANATION_CONTRACT_VERSION;
  selection: {
    selectedText: string;
    context: ExplanationSelectionSnapshot['context'];
  };
  book: {
    title: string;
    author?: string;
    language?: string;
    format?: string;
  };
  preferences: ExplainRequest['preferences'];
};

export type BookExplainV2Request = {
  version: typeof BOOK_EXPLANATION_V2_CONTRACT_VERSION;
  selection: {
    text: string;
    kind: 'word' | 'phrase' | 'passage';
  };
  book: BookExplainRequest['book'];
  reading: {
    chapter?: { title: string };
    surroundingText: {
      before: string;
      after: string;
    };
    priorMentions?: Array<{ text: string }>;
  };
  preferences: ExplainRequest['preferences'];
};

export type ExplanationInput = {
  selection: {
    selectedText: string;
    context: ExplanationSelectionSnapshot['context'] & {
      priorMentions?: string[];
    };
  };
  document: {
    kind: 'web' | 'book';
    title: string;
    hostname?: string;
    author?: string;
    language?: string;
    format?: string;
    grounding?: 'source-bound';
  };
  preferences: ExplainRequest['preferences'];
};

export type ExplainSuccessResponse = {
  version: typeof EXPLANATION_CONTRACT_VERSION;
  requestId: string;
  explanation: StructuredExplanation;
};

export type StructuredExplanation = {
  explanation: string;
  relatedTerms: string[];
};

export const STRUCTURED_EXPLANATION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    explanation: {
      type: 'string',
      minLength: 1,
      maxLength: 4_000,
      description:
        'Explain what the exact selected passage means, refers to, qualifies, or contributes specifically in the immediate context. Keep the selected passage as the subject; do not summarize unrelated page content.',
    },
    relatedTerms: {
      type: 'array',
      description:
        'Up to five concise terms, alternate names, or closely related concepts that help the reader explore the selected passage. Return an empty array when no useful related terms exist. Do not repeat the exact selected passage or use full sentences.',
      items: { type: 'string', minLength: 1, maxLength: 200 },
      maxItems: 5,
    },
  },
  required: ['explanation', 'relatedTerms'],
} as const;

export const EXPLAIN_ERROR_CODES = [
  'invalid_request',
  'service_unavailable',
  'timeout',
  'internal_error',
] as const;

export type ExplainErrorCode = (typeof EXPLAIN_ERROR_CODES)[number];

export type ExplainErrorResponse = {
  version: typeof EXPLANATION_CONTRACT_VERSION;
  requestId?: string;
  error: {
    code: ExplainErrorCode;
    message: string;
    retryable: boolean;
  };
};

export type ExplainResponse = ExplainSuccessResponse | ExplainErrorResponse;

const LIMITS = {
  selectedText: 5_000,
  contextBlock: 2_000,
  pageTitle: 500,
  language: 100,
  hostname: 253,
  explanation: 4_000,
  relatedTerm: 200,
  relatedTerms: 5,
  requestId: 200,
  bookContextSide: 450,
  priorMention: 300,
  priorMentions: 3,
} as const;

export function isExplainRequest(value: unknown): value is ExplainRequest {
  return isWebRequest(value, EXPLANATION_CONTRACT_VERSION);
}

export function isWebExplainRequest(value: unknown): value is WebExplainRequest {
  return isWebRequest(value, WEB_EXPLANATION_CONTRACT_VERSION);
}

export function isBookExplainRequest(value: unknown): value is BookExplainRequest {
  if (
    !isRecord(value) ||
    value.version !== BOOK_EXPLANATION_CONTRACT_VERSION ||
    !hasExactlyKeys(value, ['version', 'selection', 'book', 'preferences'])
  ) {
    return false;
  }

  const selection = value.selection;
  const book = value.book;
  const preferences = value.preferences;

  if (
    !isRecord(selection) ||
    !hasExactlyKeys(selection, ['selectedText', 'context']) ||
    !isRecord(book) ||
    !hasOnlyKeys(book, ['title', 'author', 'language', 'format']) ||
    !isRecord(preferences) ||
    !hasOnlyKeys(preferences, ['level', 'responseLanguage'])
  ) {
    return false;
  }

  const context = selection.context;

  return (
    isBoundedString(selection.selectedText, 1, LIMITS.selectedText) &&
    isRecord(context) &&
    isValidSelectionContext(context) &&
    isBoundedString(book.title, 0, LIMITS.pageTitle) &&
    isOptionalBoundedString(book.author, LIMITS.pageTitle) &&
    isOptionalBoundedString(book.language, LIMITS.language) &&
    isOptionalBoundedString(book.format, LIMITS.language) &&
    isValidPreferences(preferences)
  );
}

export function isBookExplainV2Request(value: unknown): value is BookExplainV2Request {
  if (
    !isRecord(value) ||
    value.version !== BOOK_EXPLANATION_V2_CONTRACT_VERSION ||
    !hasExactlyKeys(value, ['version', 'selection', 'book', 'reading', 'preferences'])
  ) {
    return false;
  }

  const selection = value.selection;
  const book = value.book;
  const reading = value.reading;
  const preferences = value.preferences;

  if (
    !isRecord(selection) ||
    !hasExactlyKeys(selection, ['text', 'kind']) ||
    !isRecord(book) ||
    !hasOnlyKeys(book, ['title', 'author', 'language', 'format']) ||
    !isRecord(reading) ||
    !hasOnlyKeys(reading, ['chapter', 'surroundingText', 'priorMentions']) ||
    !isRecord(preferences) ||
    !hasOnlyKeys(preferences, ['level', 'responseLanguage'])
  ) {
    return false;
  }

  return (
    isBoundedString(selection.text, 1, LIMITS.selectedText) &&
    ['word', 'phrase', 'passage'].includes(selection.kind as string) &&
    isBoundedString(book.title, 0, LIMITS.pageTitle) &&
    isOptionalBoundedString(book.author, LIMITS.pageTitle) &&
    isOptionalBoundedString(book.language, LIMITS.language) &&
    isOptionalBoundedString(book.format, LIMITS.language) &&
    isValidBookReadingContext(reading) &&
    isValidPreferences(preferences)
  );
}

export function toExplanationInput(
  request: ExplainRequest | WebExplainRequest | BookExplainRequest | BookExplainV2Request,
): ExplanationInput {
  if ('reading' in request) {
    const before = request.reading.surroundingText.before;
    const after = request.reading.surroundingText.after;
    const immediate = [before, request.selection.text, after].filter((value) => value.length > 0).join(' ');

    return {
      selection: {
        selectedText: request.selection.text,
        context: {
          immediate,
          containingBlock: immediate,
          before,
          after,
          ...(request.reading.chapter === undefined ? {} : { heading: request.reading.chapter.title }),
          ...(request.reading.priorMentions === undefined
            ? {}
            : { priorMentions: request.reading.priorMentions.map((mention) => mention.text) }),
        },
      },
      document: {
        kind: 'book',
        title: request.book.title,
        grounding: 'source-bound',
        ...(request.book.author === undefined ? {} : { author: request.book.author }),
        ...(request.book.language === undefined ? {} : { language: request.book.language }),
        ...(request.book.format === undefined ? {} : { format: request.book.format }),
      },
      preferences: request.preferences,
    };
  }

  if ('book' in request) {
    return {
      selection: request.selection,
      document: {
        kind: 'book',
        title: request.book.title,
        ...(request.book.author === undefined ? {} : { author: request.book.author }),
        ...(request.book.language === undefined ? {} : { language: request.book.language }),
        ...(request.book.format === undefined ? {} : { format: request.book.format }),
      },
      preferences: request.preferences,
    };
  }

  return {
    selection: {
      selectedText: request.selection.selectedText,
      context: request.selection.context,
    },
    document: {
      kind: 'web',
      title: request.selection.page.title,
      hostname: request.selection.page.hostname,
      ...(request.selection.page.language === undefined
        ? {}
        : { language: request.selection.page.language }),
    },
    preferences: request.preferences,
  };
}

export function isExplainResponse(value: unknown): value is ExplainResponse {
  if (!isRecord(value) || value.version !== EXPLANATION_CONTRACT_VERSION) {
    return false;
  }

  if ('explanation' in value) {
    return (
      isBoundedString(value.requestId, 1, LIMITS.requestId) &&
      isStructuredExplanation(value.explanation)
    );
  }

  return (
    isOptionalBoundedString(value.requestId, LIMITS.requestId) &&
    isRecord(value.error) &&
    EXPLAIN_ERROR_CODES.includes(value.error.code as ExplainErrorCode) &&
    isBoundedString(value.error.message, 1, 500) &&
    typeof value.error.retryable === 'boolean'
  );
}

export function isStructuredExplanation(value: unknown): value is StructuredExplanation {
  if (!isRecord(value) || !hasExactlyKeys(value, ['explanation', 'relatedTerms'])) {
    return false;
  }

  return (
    isBoundedString(value.explanation, 1, LIMITS.explanation) &&
    Array.isArray(value.relatedTerms) &&
    value.relatedTerms.length <= LIMITS.relatedTerms &&
    value.relatedTerms.every((term) => isBoundedString(term, 1, LIMITS.relatedTerm))
  );
}

export function isExplainSuccessResponse(value: unknown): value is ExplainSuccessResponse {
  return isExplainResponse(value) && 'explanation' in value;
}

function isWebRequest(value: unknown, version: number): boolean {
  if (
    !isRecord(value) ||
    value.version !== version ||
    !hasExactlyKeys(value, ['version', 'selection', 'preferences'])
  ) {
    return false;
  }

  const selection = value.selection;
  const preferences = value.preferences;

  if (
    !isRecord(selection) ||
    !hasExactlyKeys(selection, ['selectedText', 'context', 'page']) ||
    !isRecord(preferences) ||
    !hasOnlyKeys(preferences, ['level', 'responseLanguage'])
  ) {
    return false;
  }

  const context = selection.context;
  const page = selection.page;

  return (
    isBoundedString(selection.selectedText, 1, LIMITS.selectedText) &&
    isRecord(context) &&
    isValidSelectionContext(context) &&
    isRecord(page) &&
    hasOnlyKeys(page, ['title', 'hostname', 'language']) &&
    isBoundedString(page.title, 0, LIMITS.pageTitle) &&
    isBoundedString(page.hostname, 0, LIMITS.hostname) &&
    isOptionalBoundedString(page.language, LIMITS.language) &&
    isValidPreferences(preferences)
  );
}

function isValidSelectionContext(value: Record<string, unknown>): boolean {
  return (
    hasOnlyKeys(value, ['immediate', 'heading', 'containingBlock', 'before', 'after']) &&
    isBoundedString(value.immediate, 1, LIMITS.contextBlock) &&
    isBoundedString(value.containingBlock, 1, LIMITS.contextBlock) &&
    isOptionalBoundedString(value.heading, LIMITS.contextBlock) &&
    isOptionalBoundedString(value.before, LIMITS.contextBlock) &&
    isOptionalBoundedString(value.after, LIMITS.contextBlock)
  );
}

function isValidBookReadingContext(value: Record<string, unknown>): boolean {
  const surroundingText = value.surroundingText;
  const chapter = value.chapter;
  const priorMentions = value.priorMentions;

  return (
    isRecord(surroundingText) &&
    hasExactlyKeys(surroundingText, ['before', 'after']) &&
    isBoundedString(surroundingText.before, 0, LIMITS.bookContextSide) &&
    isBoundedString(surroundingText.after, 0, LIMITS.bookContextSide) &&
    (chapter === undefined ||
      (isRecord(chapter) &&
        hasExactlyKeys(chapter, ['title']) &&
        isBoundedString(chapter.title, 1, LIMITS.pageTitle))) &&
    (priorMentions === undefined ||
      (Array.isArray(priorMentions) &&
        priorMentions.length <= LIMITS.priorMentions &&
        priorMentions.every(
          (mention) =>
            isRecord(mention) &&
            hasExactlyKeys(mention, ['text']) &&
            isBoundedString(mention.text, 1, LIMITS.priorMention),
        )))
  );
}

function isValidPreferences(value: Record<string, unknown>): boolean {
  return (
    EXPLANATION_LEVELS.includes(value.level as ExplanationLevel) &&
    isOptionalBoundedString(value.responseLanguage, LIMITS.language)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => key in value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isBoundedString(value: unknown, minimum: number, maximum: number): value is string {
  return typeof value === 'string' && value.length >= minimum && value.length <= maximum;
}

function isOptionalBoundedString(value: unknown, maximum: number): value is string | undefined {
  return value === undefined || isBoundedString(value, 0, maximum);
}
