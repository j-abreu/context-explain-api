import { describe, expect, it } from 'vitest';

import {
  EXPLANATION_CONTRACT_VERSION,
  BOOK_EXPLANATION_CONTRACT_VERSION,
  BOOK_EXPLANATION_V2_CONTRACT_VERSION,
  BOOK_EXPLANATION_V3_CONTRACT_VERSION,
  BOOK_EXPLANATION_V4_CONTRACT_VERSION,
  WEB_EXPLANATION_CONTRACT_VERSION,
  isBookExplainV2Request,
  isBookExplainV2Response,
  isBookExplainV3Request,
  isBookExplainV3Response,
  isBookExplainV4CompletionRequest,
  isBookExplainV4Request,
  normalizeSearchPlan,
  isBookExplainRequest,
  isExplainRequest,
  isWebExplainRequest,
  isExplainResponse,
  isStructuredExplanation,
  STRUCTURED_EXPLANATION_JSON_SCHEMA,
  unicodeScalarLength,
} from '../src/index.js';

describe('explanation contracts', () => {
  it('accepts a bounded versioned request', () => {
    expect(isExplainRequest(createRequest())).toBe(true);
    expect(
      isExplainRequest({
        ...createRequest(),
        preferences: { level: 'beginner' },
      }),
    ).toBe(true);
  });

  it('rejects unknown versions, levels, and oversized selections', () => {
    expect(isExplainRequest({ ...createRequest(), version: 2 })).toBe(false);
    expect(
      isExplainRequest({
        ...createRequest(),
        preferences: { level: 'academic' },
      }),
    ).toBe(false);
    expect(
      isExplainRequest({
        ...createRequest(),
        selection: {
          ...createRequest().selection,
          page: { ...createRequest().selection.page, url: 'https://example.com/private-path' },
        },
      }),
    ).toBe(false);
    expect(
      isExplainRequest({
        ...createRequest(),
        preferences: { level: 'concise' },
      }),
    ).toBe(false);
    expect(
      isExplainRequest({
        ...createRequest(),
        selection: { ...createRequest().selection, selectedText: 'x'.repeat(5_001) },
      }),
    ).toBe(false);
  });

  it('validates distinct web and book request contracts', () => {
    expect(isWebExplainRequest({ ...createRequest(), version: WEB_EXPLANATION_CONTRACT_VERSION })).toBe(true);
    expect(isBookExplainRequest(createBookRequest())).toBe(true);
    expect(isBookExplainRequest({ ...createBookRequest(), book: { title: 'A book', url: 'nope' } })).toBe(false);
    expect(isBookExplainV2Request(createBookV2Request())).toBe(true);
    expect(isBookExplainV3Request(createBookV3Request())).toBe(true);
    expect(
      isBookExplainV2Request({
        ...createBookV2Request(),
        reading: { ...createBookV2Request().reading, priorMentions: Array(6).fill({ text: 'Too many.' }) },
      }),
    ).toBe(false);
    expect(
      isBookExplainV2Request({
        ...createBookV2Request(),
        reading: { ...createBookV2Request().reading, priorMentions: Array(5).fill({ text: 'Earlier context.' }) },
      }),
    ).toBe(true);
  });

  it('distinguishes valid success and error responses', () => {
    expect(
      isExplainResponse({
        version: EXPLANATION_CONTRACT_VERSION,
        requestId: 'request-1',
        explanation: {
          explanation: 'Its meaning in this passage.',
          relatedTerms: [],
        },
      }),
    ).toBe(true);
    expect(
      isExplainResponse({
        version: EXPLANATION_CONTRACT_VERSION,
        error: { code: 'invalid_request', message: 'Invalid request.', retryable: false },
      }),
    ).toBe(true);
  });

  it('uses Unicode scalar values and enforces the source-bound v2 response shape', () => {
    expect(unicodeScalarLength('é')).toBe(1);
    expect(unicodeScalarLength('😀')).toBe(1);
    expect(isBookExplainV2Request({
      ...createBookV2Request(),
      selection: { text: '😀'.repeat(5_000), kind: 'passage' },
    })).toBe(true);
    expect(isBookExplainV2Request({
      ...createBookV2Request(),
      selection: { text: '😀'.repeat(5_001), kind: 'passage' },
    })).toBe(false);
    const response = { version: BOOK_EXPLANATION_V2_CONTRACT_VERSION, requestId: 'request-1', explanation: { explanation: 'Grounded.', relatedTerms: [] } };
    expect(isBookExplainV2Response(response)).toBe(true);
    expect(isBookExplainV2Response({ ...response, explanation: { ...response.explanation, relatedTerms: ['unsupported'] } })).toBe(false);
    expect(isBookExplainV2Response({ ...response, extra: true })).toBe(false);
  });

  it('enforces v3 combined context word and scalar limits', () => {
    expect(isBookExplainV3Request({ ...createBookV3Request(), reading: {
      ...createBookV3Request().reading,
      context: { ...createBookV3Request().reading.context, strategy: 'unknown' },
    } })).toBe(false);
    expect(isBookExplainV3Request({ ...createBookV3Request(), reading: {
      ...createBookV3Request().reading,
      context: { ...createBookV3Request().reading.context, immediateText: { before: Array(101).fill('word').join(' '), after: '' } },
    } })).toBe(false);
    expect(isBookExplainV3Request({ ...createBookV3Request(), reading: {
      ...createBookV3Request().reading,
      context: { ...createBookV3Request().reading.context, adjacentText: { before: '😀'.repeat(1_201), after: '' } },
    } })).toBe(false);
    const response = { version: BOOK_EXPLANATION_V3_CONTRACT_VERSION, requestId: 'request-1', explanation: { explanation: 'Grounded.', relatedTerms: [] } };
    expect(isBookExplainV3Response(response)).toBe(true);
    expect(isBookExplainV3Response({ ...response, explanation: { ...response.explanation, relatedTerms: ['unsupported'] } })).toBe(false);
  });

  it('validates v4 context-only requests and clamps unsafe plans', () => {
    const { priorMentions: _priorMentions, ...reading } = createBookV3Request().reading;
    const request = { ...createBookV3Request(), version: BOOK_EXPLANATION_V4_CONTRACT_VERSION, reading };
    expect(isBookExplainV4Request(request)).toBe(true);
    expect(isBookExplainV4Request({ ...request, reading: { ...request.reading, priorMentions: [{ text: 'not allowed' }] } })).toBe(false);
    expect(normalizeSearchPlan({ bookMode: 'narrative', classificationBasis: 'Sequential fiction.', queries: [{ text: ' Mira  key ', requestedScope: 'whole_book' }] })).toEqual({
      bookMode: 'narrative', classificationBasis: 'Sequential fiction.', queries: [{ id: 'q1', text: 'Mira key', requestedScope: 'whole_book', policyScope: 'before_selection', policyReason: 'narrative_guard' }],
    });
    expect(normalizeSearchPlan({ bookMode: 'reference', classificationBasis: 'Reference work.', queries: [{ text: 'same', requestedScope: 'before_selection' }, { text: ' SAME ', requestedScope: 'before_selection' }] })).toBeUndefined();
  });

  it('rejects continuation evidence that broadens scope or includes later text', () => {
    const { priorMentions: _priorMentions, ...reading } = createBookV3Request().reading;
    const original = { ...createBookV3Request(), version: BOOK_EXPLANATION_V4_CONTRACT_VERSION, reading };
    const continuation = { version: BOOK_EXPLANATION_V4_CONTRACT_VERSION, originalRequestId: 'request-1', original, retrieval: {
      bookMode: 'narrative', classificationBasis: 'Sequential fiction.', searches: [{ id: 'q1', text: 'Mira', requestedScope: 'whole_book', policyScope: 'before_selection', policyReason: 'narrative_guard', executedScope: 'before_selection', authorization: 'not_required', status: 'ok', candidateCount: 1, candidateLimitReached: false, matches: [{ relation: 'before', text: 'Mira kept the key.' }] }],
    } };
    expect(isBookExplainV4CompletionRequest(continuation)).toBe(true);
    expect(isBookExplainV4CompletionRequest({ ...continuation, retrieval: { ...continuation.retrieval, searches: [{ ...continuation.retrieval.searches[0], matches: [{ relation: 'after', text: 'Later text.' }] }] } })).toBe(false);
  });


  it('requires the exact structured explanation shape', () => {
    const valid = {
      explanation: 'Its meaning in this passage.',
      relatedTerms: ['related concept'],
    };

    expect(isStructuredExplanation(valid)).toBe(true);
    expect(isStructuredExplanation({ ...valid, explanation: '' })).toBe(false);
    expect(isStructuredExplanation({ ...valid, relatedTerms: Array(6).fill('term') })).toBe(false);
    expect(isStructuredExplanation({ ...valid, extra: 'not allowed' })).toBe(false);
    expect(isStructuredExplanation({ ...valid, explanation: 'x'.repeat(4_001) })).toBe(false);
    expect(STRUCTURED_EXPLANATION_JSON_SCHEMA).toMatchObject({
      additionalProperties: false,
      required: ['explanation', 'relatedTerms'],
      properties: {
        explanation: { maxLength: 4_000 },
        relatedTerms: { maxItems: 5 },
      },
    });
  });
});

function createRequest() {
  return {
    version: EXPLANATION_CONTRACT_VERSION,
    selection: {
      selectedText: 'contextual representation',
      context: {
        immediate: 'A model learns a contextual representation.',
        containingBlock: 'A model learns a contextual representation.',
      },
      page: {
        title: 'How models learn',
        hostname: 'example.com',
        language: 'en',
      },
    },
    preferences: { level: 'simple' },
  };
}

function createBookRequest() {
  return {
    version: BOOK_EXPLANATION_CONTRACT_VERSION,
    selection: {
      selectedText: 'the lighthouse',
      context: {
        immediate: 'Mira walked toward the lighthouse before the storm arrived.',
        containingBlock: 'Mira walked toward the lighthouse before the storm arrived.',
        heading: 'Chapter 3',
      },
    },
    book: { title: 'Harbor Lights', author: 'A. Reader', language: 'en', format: 'epub' },
    preferences: { level: 'simple' },
  };
}

function createBookV2Request() {
  return {
    version: BOOK_EXPLANATION_V2_CONTRACT_VERSION,
    selection: { text: 'Mira', kind: 'word' as const },
    book: { title: 'Harbor Lights', author: 'A. Reader', language: 'en', format: 'epub' },
    reading: {
      chapter: { title: 'Chapter 3' },
      surroundingText: { before: 'Before', after: 'after.' },
      priorMentions: [{ text: 'Mira kept the lighthouse key.' }],
    },
    preferences: { level: 'simple' as const },
  };
}

function createBookV3Request() {
  return {
    version: BOOK_EXPLANATION_V3_CONTRACT_VERSION,
    selection: { text: 'Mira', kind: 'word' as const },
    book: { title: 'Harbor Lights', author: 'A. Reader', language: 'en', format: 'epub' },
    reading: {
      chapter: { title: 'Chapter 3' },
      context: {
        strategy: 'sentence' as const,
        immediateText: { before: 'The wind had grown colder as', after: 'walked toward the lighthouse.' },
        adjacentText: { before: 'The harbor was already dark.', after: 'Behind her, the last shop closed.' },
      },
      priorMentions: [{ text: 'Mira kept the lighthouse key.' }],
    },
    preferences: { level: 'simple' as const },
  };
}
