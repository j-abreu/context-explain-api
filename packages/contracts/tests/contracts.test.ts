import { describe, expect, it } from 'vitest';

import {
  EXPLANATION_CONTRACT_VERSION,
  BOOK_EXPLANATION_CONTRACT_VERSION,
  BOOK_EXPLANATION_V2_CONTRACT_VERSION,
  WEB_EXPLANATION_CONTRACT_VERSION,
  isBookExplainV2Request,
  isBookExplainRequest,
  isExplainRequest,
  isWebExplainRequest,
  isExplainResponse,
  isStructuredExplanation,
  STRUCTURED_EXPLANATION_JSON_SCHEMA,
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
