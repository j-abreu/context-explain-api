export const EXPLANATION_CONTRACT_VERSION = 6 as const;
export const WEB_EXPLANATION_CONTRACT_VERSION = 1 as const;
export const BOOK_EXPLANATION_CONTRACT_VERSION = 1 as const;
export const BOOK_EXPLANATION_V2_CONTRACT_VERSION = 2 as const;
export const BOOK_EXPLANATION_V3_CONTRACT_VERSION = 3 as const;
export const BOOK_EXPLANATION_V4_CONTRACT_VERSION = 4 as const;

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

export const BOOK_V2_LIMITS = {
  selectedText: 5_000,
  bookTitle: 500,
  bookAuthor: 500,
  bookLanguage: 100,
  bookFormat: 100,
  chapterTitle: 500,
  surroundingText: 450,
  priorMention: 300,
  priorMentions: 5,
  requestId: 200,
  explanation: 4_000,
  relatedTerm: 200,
  relatedTerms: 5,
  errorMessage: 500,
  requestBodyBytes: 32 * 1024,
} as const;

export const BOOK_V3_LIMITS = {
  ...BOOK_V2_LIMITS,
  contextWordsPerSide: 100,
  contextScalarsPerSide: 1_200,
  contextFieldScalars: 1_200,
} as const;

export const BOOK_V4_LIMITS = {
  ...BOOK_V3_LIMITS,
  retrievalRounds: 1,
  modelCalls: 2,
  queries: 3,
  queryScalars: 200,
  queryWords: 24,
  totalQueryScalars: 400,
  candidateHits: 50,
  excerptsPerQuery: 3,
  excerptsTotal: 6,
  excerptScalars: 300,
  classificationBasis: 240,
} as const;

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

export type BookExplainV3Request = {
  version: typeof BOOK_EXPLANATION_V3_CONTRACT_VERSION;
  selection: BookExplainV2Request['selection'];
  book: BookExplainRequest['book'];
  reading: {
    chapter?: { title: string };
    context: {
      strategy: 'sentence' | 'sentence_clipped' | 'word_window';
      immediateText: { before: string; after: string };
      adjacentText: { before: string; after: string };
    };
    priorMentions?: Array<{ text: string }>;
  };
  preferences: ExplainRequest['preferences'];
};

/** V4 deliberately preserves V3's sentence-aware capture while removing eager retrieval. */
export type BookExplainV4Request = Omit<BookExplainV3Request, 'version'> & {
  version: typeof BOOK_EXPLANATION_V4_CONTRACT_VERSION;
  reading: Omit<BookExplainV3Request['reading'], 'priorMentions'>;
};

export const BOOK_MODES = ['reference', 'narrative', 'uncertain'] as const;
export type BookMode = (typeof BOOK_MODES)[number];
export const SEARCH_SCOPES = ['before_selection', 'whole_book'] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];
export const POLICY_REASONS = ['model_requested', 'narrative_guard', 'uncertain_guard'] as const;
export type PolicyReason = (typeof POLICY_REASONS)[number];
export const SEARCH_STATUSES = ['ok', 'no_matches', 'unsupported', 'timeout', 'failed'] as const;
export type SearchStatus = (typeof SEARCH_STATUSES)[number];
export const SEARCH_AUTHORIZATIONS = ['not_required', 'approved_whole_book', 'reader_downgrade'] as const;
export type SearchAuthorization = (typeof SEARCH_AUTHORIZATIONS)[number];

export type BookSearchQuery = {
  id: string;
  text: string;
  requestedScope: SearchScope;
  policyScope: SearchScope;
  policyReason: PolicyReason;
};

export type BookSearchPlan = {
  bookMode: BookMode;
  classificationBasis: string;
  queries: BookSearchQuery[];
};

export type BookExplainV4InitialResponse = {
  version: typeof BOOK_EXPLANATION_V4_CONTRACT_VERSION;
  requestId: string;
  outcome: { type: 'answer'; explanation: StructuredExplanation } | { type: 'search'; plan: BookSearchPlan };
};

/** Provider output is deliberately smaller than the public response and never carries policy fields. */
export type BookDecision =
  | { action: 'answer'; explanation: StructuredExplanation }
  | { action: 'search'; bookMode: BookMode; classificationBasis: string; queries: Array<{ text: string; requestedScope: SearchScope }> };

export type BookSearchMatch = { relation: 'before' | 'after'; text: string };
export type BookSearchExecution = BookSearchQuery & {
  executedScope: SearchScope;
  authorization: SearchAuthorization;
  status: SearchStatus;
  candidateCount: number;
  candidateLimitReached: boolean;
  matches: BookSearchMatch[];
};
export type BookExplainV4CompletionRequest = {
  version: typeof BOOK_EXPLANATION_V4_CONTRACT_VERSION;
  originalRequestId: string;
  original: BookExplainV4Request;
  retrieval: {
    bookMode: BookMode;
    classificationBasis: string;
    searches: BookSearchExecution[];
  };
};
export type BookExplainV4CompletionResponse = {
  version: typeof BOOK_EXPLANATION_V4_CONTRACT_VERSION;
  requestId: string;
  explanation: StructuredExplanation;
};

export type ExplanationInput = {
  selection: {
    selectedText: string;
    context: ExplanationSelectionSnapshot['context'] & {
      priorMentions?: string[];
      captureStrategy?: 'sentence' | 'sentence_clipped' | 'word_window';
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
  selectedText: BOOK_V2_LIMITS.selectedText,
  contextBlock: 2_000,
  pageTitle: 500,
  language: 100,
  hostname: 253,
  explanation: 4_000,
  relatedTerm: 200,
  relatedTerms: 5,
  requestId: BOOK_V2_LIMITS.requestId,
  bookContextSide: BOOK_V2_LIMITS.surroundingText,
  priorMention: BOOK_V2_LIMITS.priorMention,
  priorMentions: BOOK_V2_LIMITS.priorMentions,
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
    isBoundedString(book.title, 0, BOOK_V2_LIMITS.bookTitle) &&
    isOptionalBoundedString(book.author, BOOK_V2_LIMITS.bookAuthor) &&
    isOptionalBoundedString(book.language, BOOK_V2_LIMITS.bookLanguage) &&
    isOptionalBoundedString(book.format, BOOK_V2_LIMITS.bookFormat) &&
    isValidBookReadingContext(reading) &&
    isValidPreferences(preferences)
  );
}

export function isBookExplainV3Request(value: unknown): value is BookExplainV3Request {
  if (!isRecord(value) || value.version !== BOOK_EXPLANATION_V3_CONTRACT_VERSION
    || !hasExactlyKeys(value, ['version', 'selection', 'book', 'reading', 'preferences'])) return false;
  const { selection, book, reading, preferences } = value;
  return isRecord(selection) && hasExactlyKeys(selection, ['text', 'kind'])
    && isRecord(book) && hasOnlyKeys(book, ['title', 'author', 'language', 'format'])
    && isRecord(reading) && hasOnlyKeys(reading, ['chapter', 'context', 'priorMentions'])
    && isRecord(preferences) && hasOnlyKeys(preferences, ['level', 'responseLanguage'])
    && isBoundedString(selection.text, 1, BOOK_V3_LIMITS.selectedText)
    && ['word', 'phrase', 'passage'].includes(selection.kind as string)
    && isBoundedString(book.title, 0, BOOK_V3_LIMITS.bookTitle)
    && isOptionalBoundedString(book.author, BOOK_V3_LIMITS.bookAuthor)
    && isOptionalBoundedString(book.language, BOOK_V3_LIMITS.bookLanguage)
    && isOptionalBoundedString(book.format, BOOK_V3_LIMITS.bookFormat)
    && isValidBookV3ReadingContext(reading) && isValidPreferences(preferences);
}

export function isBookExplainV4Request(value: unknown): value is BookExplainV4Request {
  if (!isRecord(value) || value.version !== BOOK_EXPLANATION_V4_CONTRACT_VERSION
    || !hasExactlyKeys(value, ['version', 'selection', 'book', 'reading', 'preferences'])) return false;
  const { selection, book, reading, preferences } = value;
  return isRecord(selection) && hasExactlyKeys(selection, ['text', 'kind'])
    && isRecord(book) && hasOnlyKeys(book, ['title', 'author', 'language', 'format'])
    && isRecord(reading) && hasOnlyKeys(reading, ['chapter', 'context'])
    && isRecord(preferences) && hasOnlyKeys(preferences, ['level', 'responseLanguage'])
    && isBoundedString(selection.text, 1, BOOK_V4_LIMITS.selectedText)
    && ['word', 'phrase', 'passage'].includes(selection.kind as string)
    && isBoundedString(book.title, 0, BOOK_V4_LIMITS.bookTitle)
    && isOptionalBoundedString(book.author, BOOK_V4_LIMITS.bookAuthor)
    && isOptionalBoundedString(book.language, BOOK_V4_LIMITS.bookLanguage)
    && isOptionalBoundedString(book.format, BOOK_V4_LIMITS.bookFormat)
    && isValidBookV4ReadingContext(reading) && isValidPreferences(preferences);
}

export function normalizeBookSearchQuery(value: string): string | undefined {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  if (normalized.length === 0 || /[\u0000-\u001f\u007f]/u.test(normalized)
    || unicodeScalarLength(normalized) > BOOK_V4_LIMITS.queryScalars
    || wordCount(normalized) > BOOK_V4_LIMITS.queryWords) return undefined;
  return normalized;
}

export function normalizeSearchPlan(value: unknown): BookSearchPlan | undefined {
  if (!isRecord(value) || !BOOK_MODES.includes(value.bookMode as BookMode)
    || !isBoundedString(value.classificationBasis, 1, BOOK_V4_LIMITS.classificationBasis)
    || !Array.isArray(value.queries) || value.queries.length === 0 || value.queries.length > BOOK_V4_LIMITS.queries) return undefined;
  const seen = new Set<string>();
  let totalScalars = 0;
  const queries: BookSearchQuery[] = [];
  for (let index = 0; index < value.queries.length; index += 1) {
    const query = value.queries[index];
    if (!isRecord(query) || !hasOnlyKeys(query, ['text', 'requestedScope', 'id', 'policyScope', 'policyReason'])
      || !SEARCH_SCOPES.includes(query.requestedScope as SearchScope)) return undefined;
    const text = typeof query.text === 'string' ? normalizeBookSearchQuery(query.text) : undefined;
    if (text === undefined) return undefined;
    const dedupeKey = text.toLocaleLowerCase();
    if (seen.has(dedupeKey)) return undefined;
    seen.add(dedupeKey);
    totalScalars += unicodeScalarLength(text);
    if (totalScalars > BOOK_V4_LIMITS.totalQueryScalars) return undefined;
    const requestedScope = query.requestedScope as SearchScope;
    const policy = clampSearchScope(value.bookMode as BookMode, requestedScope);
    queries.push({ id: `q${index + 1}`, text, requestedScope, ...policy });
  }
  return { bookMode: value.bookMode as BookMode, classificationBasis: value.classificationBasis, queries };
}

export function normalizeBookDecision(value: unknown): BookDecision | undefined {
  if (!isRecord(value) || (value.action !== 'answer' && value.action !== 'search')) return undefined;
  if (value.action === 'answer') {
    return hasExactlyKeys(value, ['action', 'explanation']) && isSourceBoundExplanation(value.explanation)
      ? { action: 'answer', explanation: value.explanation }
      : undefined;
  }
  if (!hasExactlyKeys(value, ['action', 'bookMode', 'classificationBasis', 'queries'])) return undefined;
  const plan = normalizeSearchPlan({
    bookMode: value.bookMode,
    classificationBasis: value.classificationBasis,
    queries: Array.isArray(value.queries)
      ? value.queries.map((query) => isRecord(query) ? { text: query.text, requestedScope: query.requestedScope } : query)
      : value.queries,
  });
  return plan === undefined ? undefined : {
    action: 'search', bookMode: plan.bookMode, classificationBasis: plan.classificationBasis,
    queries: plan.queries.map(({ text, requestedScope }) => ({ text, requestedScope })),
  };
}

export function clampSearchScope(bookMode: BookMode, requestedScope: SearchScope): Pick<BookSearchQuery, 'policyScope' | 'policyReason'> {
  if (bookMode === 'narrative' && requestedScope === 'whole_book') return { policyScope: 'before_selection', policyReason: 'narrative_guard' };
  if (bookMode === 'uncertain' && requestedScope === 'whole_book') return { policyScope: 'before_selection', policyReason: 'uncertain_guard' };
  return { policyScope: requestedScope, policyReason: 'model_requested' };
}

export function isBookExplainV4InitialResponse(value: unknown): value is BookExplainV4InitialResponse {
  if (!isRecord(value) || value.version !== BOOK_EXPLANATION_V4_CONTRACT_VERSION
    || !hasExactlyKeys(value, ['version', 'requestId', 'outcome']) || !isBoundedString(value.requestId, 1, BOOK_V4_LIMITS.requestId) || !isRecord(value.outcome)) return false;
  if (value.outcome.type === 'answer') return hasExactlyKeys(value.outcome, ['type', 'explanation']) && isSourceBoundExplanation(value.outcome.explanation);
  return value.outcome.type === 'search' && hasExactlyKeys(value.outcome, ['type', 'plan']) && isNormalizedSearchPlan(value.outcome.plan);
}

export function isBookExplainV4CompletionRequest(value: unknown): value is BookExplainV4CompletionRequest {
  if (!isRecord(value) || value.version !== BOOK_EXPLANATION_V4_CONTRACT_VERSION
    || !hasExactlyKeys(value, ['version', 'originalRequestId', 'original', 'retrieval'])
    || !isBoundedString(value.originalRequestId, 1, BOOK_V4_LIMITS.requestId)
    || !isBookExplainV4Request(value.original) || !isRecord(value.retrieval)) return false;
  const retrieval = value.retrieval;
  if (!hasExactlyKeys(retrieval, ['bookMode', 'classificationBasis', 'searches'])
    || !BOOK_MODES.includes(retrieval.bookMode as BookMode)
    || !isBoundedString(retrieval.classificationBasis, 1, BOOK_V4_LIMITS.classificationBasis)
    || !Array.isArray(retrieval.searches) || retrieval.searches.length === 0 || retrieval.searches.length > BOOK_V4_LIMITS.queries) return false;
  let totalMatches = 0;
  return retrieval.searches.every((search) => {
    if (!isSearchExecution(search)) return false;
    const expectedPolicy = clampSearchScope(retrieval.bookMode as BookMode, search.requestedScope);
    if (search.policyScope !== expectedPolicy.policyScope || search.policyReason !== expectedPolicy.policyReason) return false;
    totalMatches += search.matches.length;
    return totalMatches <= BOOK_V4_LIMITS.excerptsTotal;
  });
}

export function matchesAcceptedSearchPlan(value: BookExplainV4CompletionRequest, plan: BookSearchPlan): boolean {
  const { retrieval } = value;
  if (retrieval.bookMode !== plan.bookMode || retrieval.classificationBasis !== plan.classificationBasis || retrieval.searches.length !== plan.queries.length) return false;
  return retrieval.searches.every((search, index) => {
    const query = plan.queries[index];
    if (query === undefined) return false;
    return search.id === query.id && search.text === query.text && search.requestedScope === query.requestedScope
      && search.policyScope === query.policyScope && search.policyReason === query.policyReason
      && (search.executedScope === search.policyScope || (search.policyScope === 'whole_book' && search.executedScope === 'before_selection'));
  });
}

export function isBookExplainV4CompletionResponse(value: unknown): value is BookExplainV4CompletionResponse {
  return isRecord(value) && value.version === BOOK_EXPLANATION_V4_CONTRACT_VERSION
    && hasExactlyKeys(value, ['version', 'requestId', 'explanation'])
    && isBoundedString(value.requestId, 1, BOOK_V4_LIMITS.requestId) && isSourceBoundExplanation(value.explanation);
}

export function toExplanationInput(
  request: ExplainRequest | WebExplainRequest | BookExplainRequest | BookExplainV2Request | BookExplainV3Request | BookExplainV4Request,
): ExplanationInput {
  if ('reading' in request && 'context' in request.reading) {
    const { immediateText, adjacentText, strategy } = request.reading.context;
    const immediate = [immediateText.before, request.selection.text, immediateText.after].filter((value) => value.length > 0).join(' ');
    return {
      selection: { selectedText: request.selection.text, context: {
        immediate, containingBlock: immediate, captureStrategy: strategy,
        ...(adjacentText.before.length === 0 ? {} : { before: adjacentText.before }),
        ...(adjacentText.after.length === 0 ? {} : { after: adjacentText.after }),
        ...(request.reading.chapter === undefined ? {} : { heading: request.reading.chapter.title }),
        ...(request.reading.priorMentions === undefined ? {} : { priorMentions: request.reading.priorMentions.map((mention) => mention.text) }),
      } },
      document: { kind: 'book', title: request.book.title, grounding: 'source-bound',
        ...(request.book.author === undefined ? {} : { author: request.book.author }),
        ...(request.book.language === undefined ? {} : { language: request.book.language }),
        ...(request.book.format === undefined ? {} : { format: request.book.format }) },
      preferences: request.preferences,
    };
  }
  if ('reading' in request && 'surroundingText' in request.reading) {
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
    const bookRequest = request as BookExplainRequest;
    return {
      selection: bookRequest.selection,
      document: {
        kind: 'book',
        title: bookRequest.book.title,
        ...(bookRequest.book.author === undefined ? {} : { author: bookRequest.book.author }),
        ...(bookRequest.book.language === undefined ? {} : { language: bookRequest.book.language }),
        ...(bookRequest.book.format === undefined ? {} : { format: bookRequest.book.format }),
      },
      preferences: bookRequest.preferences,
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

export function isBookExplainV2Response(value: unknown): boolean {
  return isBookResponse(value, BOOK_EXPLANATION_V2_CONTRACT_VERSION);
}

export function isBookExplainV3Response(value: unknown): boolean {
  return isBookResponse(value, BOOK_EXPLANATION_V3_CONTRACT_VERSION);
}

function isBookResponse(value: unknown, version: number): boolean {
  if (!isRecord(value) || value.version !== version) return false;
  if ('explanation' in value) {
    return hasExactlyKeys(value, ['version', 'requestId', 'explanation'])
      && isBoundedString(value.requestId, 1, BOOK_V2_LIMITS.requestId)
      && isRecord(value.explanation)
      && hasExactlyKeys(value.explanation, ['explanation', 'relatedTerms'])
      && isBoundedString(value.explanation.explanation, 1, BOOK_V2_LIMITS.explanation)
      && Array.isArray(value.explanation.relatedTerms)
      && value.explanation.relatedTerms.length === 0;
  }
  return hasOnlyKeys(value, ['version', 'requestId', 'error'])
    && isOptionalBoundedString(value.requestId, BOOK_V2_LIMITS.requestId)
    && isRecord(value.error)
    && hasExactlyKeys(value.error, ['code', 'message', 'retryable'])
    && EXPLAIN_ERROR_CODES.includes(value.error.code as ExplainErrorCode)
    && isBoundedString(value.error.message, 1, BOOK_V2_LIMITS.errorMessage)
    && typeof value.error.retryable === 'boolean';
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
        isBoundedString(chapter.title, 1, BOOK_V2_LIMITS.chapterTitle))) &&
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

function isValidBookV3ReadingContext(value: Record<string, unknown>): boolean {
  const { chapter, context, priorMentions } = value;
  if (!isRecord(context) || !hasExactlyKeys(context, ['strategy', 'immediateText', 'adjacentText'])) return false;
  const immediate = context.immediateText;
  const adjacent = context.adjacentText;
  if (!isRecord(immediate) || !hasExactlyKeys(immediate, ['before', 'after']) || !isRecord(adjacent) || !hasExactlyKeys(adjacent, ['before', 'after'])
    || !['sentence', 'sentence_clipped', 'word_window'].includes(context.strategy as string)
    || !isBoundedString(immediate.before, 0, BOOK_V3_LIMITS.contextFieldScalars) || !isBoundedString(immediate.after, 0, BOOK_V3_LIMITS.contextFieldScalars)
    || !isBoundedString(adjacent.before, 0, BOOK_V3_LIMITS.contextFieldScalars) || !isBoundedString(adjacent.after, 0, BOOK_V3_LIMITS.contextFieldScalars)
    || wordCount(`${immediate.before} ${adjacent.before}`) > BOOK_V3_LIMITS.contextWordsPerSide || wordCount(`${immediate.after} ${adjacent.after}`) > BOOK_V3_LIMITS.contextWordsPerSide
    || unicodeScalarLength(immediate.before) + unicodeScalarLength(adjacent.before) > BOOK_V3_LIMITS.contextScalarsPerSide || unicodeScalarLength(immediate.after) + unicodeScalarLength(adjacent.after) > BOOK_V3_LIMITS.contextScalarsPerSide) return false;
  return (chapter === undefined || (isRecord(chapter) && hasExactlyKeys(chapter, ['title']) && isBoundedString(chapter.title, 1, BOOK_V3_LIMITS.chapterTitle)))
    && (priorMentions === undefined || (Array.isArray(priorMentions) && priorMentions.length <= BOOK_V3_LIMITS.priorMentions && priorMentions.every((mention) => isRecord(mention) && hasExactlyKeys(mention, ['text']) && isBoundedString(mention.text, 1, BOOK_V3_LIMITS.priorMention))));
}

function isValidBookV4ReadingContext(value: Record<string, unknown>): boolean {
  return isValidBookV3ReadingContext({ ...value, priorMentions: undefined });
}

function isNormalizedSearchPlan(value: unknown): value is BookSearchPlan {
  if (!isRecord(value) || !hasExactlyKeys(value, ['bookMode', 'classificationBasis', 'queries'])) return false;
  const suppliedQueries = value.queries;
  if (!Array.isArray(suppliedQueries)) return false;
  const normalized = normalizeSearchPlan(value);
  if (normalized === undefined || normalized.queries.length !== suppliedQueries.length) return false;
  return normalized.queries.every((query, index) => {
    const supplied = suppliedQueries[index];
    return isRecord(supplied) && hasExactlyKeys(supplied, ['id', 'text', 'requestedScope', 'policyScope', 'policyReason'])
      && query.id === supplied.id && query.text === supplied.text && query.requestedScope === supplied.requestedScope
      && query.policyScope === supplied.policyScope && query.policyReason === supplied.policyReason;
  });
}

function isSearchExecution(value: unknown): value is BookSearchExecution {
  if (!isRecord(value) || !hasExactlyKeys(value, ['id', 'text', 'requestedScope', 'policyScope', 'policyReason', 'executedScope', 'authorization', 'status', 'candidateCount', 'candidateLimitReached', 'matches'])) return false;
  const candidateCount = value.candidateCount;
  if (!isBoundedString(value.id, 1, BOOK_V4_LIMITS.requestId) || typeof value.text !== 'string' || normalizeBookSearchQuery(value.text) !== value.text
    || !SEARCH_SCOPES.includes(value.requestedScope as SearchScope) || !SEARCH_SCOPES.includes(value.policyScope as SearchScope)
    || !POLICY_REASONS.includes(value.policyReason as PolicyReason) || !SEARCH_SCOPES.includes(value.executedScope as SearchScope)
    || !SEARCH_AUTHORIZATIONS.includes(value.authorization as SearchAuthorization) || !SEARCH_STATUSES.includes(value.status as SearchStatus)
    || !Number.isInteger(candidateCount) || typeof candidateCount !== 'number' || candidateCount < 0 || candidateCount > BOOK_V4_LIMITS.candidateHits
    || typeof value.candidateLimitReached !== 'boolean' || !Array.isArray(value.matches) || value.matches.length > BOOK_V4_LIMITS.excerptsPerQuery) return false;
  if (value.status !== 'ok' && (value.matches.length !== 0 || (value.status === 'no_matches' && value.candidateCount !== 0))) return false;
  if (value.authorization === 'approved_whole_book' && !(value.policyScope === 'whole_book' && value.executedScope === 'whole_book')) return false;
  if (value.authorization === 'reader_downgrade' && !(value.policyScope === 'whole_book' && value.executedScope === 'before_selection')) return false;
  if (value.authorization === 'not_required' && value.policyScope === 'whole_book' && value.executedScope === 'whole_book') return false;
  return value.matches.every((match) => isRecord(match) && hasExactlyKeys(match, ['relation', 'text'])
    && (match.relation === 'before' || match.relation === 'after')
    && isBoundedString(match.text, 1, BOOK_V4_LIMITS.excerptScalars)
    && !(value.executedScope === 'before_selection' && match.relation !== 'before'));
}

function isSourceBoundExplanation(value: unknown): value is StructuredExplanation {
  return isStructuredExplanation(value) && value.relatedTerms.length === 0;
}

export function wordCount(value: string): number {
  const normalized = value.trim();
  return normalized === '' ? 0 : normalized.split(/\s+/u).length;
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
  return typeof value === 'string' && unicodeScalarLength(value) >= minimum && unicodeScalarLength(value) <= maximum;
}

export function unicodeScalarLength(value: string): number {
  return Array.from(value).length;
}

function isOptionalBoundedString(value: unknown, maximum: number): value is string | undefined {
  return value === undefined || isBoundedString(value, 0, maximum);
}
