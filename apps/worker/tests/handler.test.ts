import {
  EXPLANATION_CONTRACT_VERSION,
  BOOK_EXPLANATION_CONTRACT_VERSION,
  BOOK_EXPLANATION_V2_CONTRACT_VERSION,
  WEB_EXPLANATION_CONTRACT_VERSION,
  toExplanationInput,
  type ExplainRequest,
} from '@context-explain/contracts';
import { describe, expect, it, vi } from 'vitest';

import { handleRequest, type ExplainRateLimiter } from '../src/handler.js';
import {
  ExplanationProviderError,
  type ExplanationProvider,
} from '../src/provider.js';

describe('Cloudflare Worker API', () => {
  it('reports health without consuming rate-limit or inference capacity', async () => {
    const provider: ExplanationProvider = { explain: vi.fn() };
    const rateLimiter = allowAll();
    const response = await handleRequest(new Request('https://api.example.com/health'), {
      provider,
      rateLimiter,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(rateLimiter.limit).not.toHaveBeenCalled();
    expect(provider.explain).not.toHaveBeenCalled();
  });

  it('validates and explains a request through the provider boundary', async () => {
    const provider: ExplanationProvider = {
      explain: vi.fn().mockResolvedValue({
        explanation: 'A Worker-generated contextual explanation.',
        relatedTerms: [],
      }),
    };
    const response = await handleRequest(explainRequest(createRequest()), {
      provider,
      rateLimiter: allowAll(),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      version: EXPLANATION_CONTRACT_VERSION,
      explanation: {
        explanation: 'A Worker-generated contextual explanation.',
        relatedTerms: [],
      },
    });
    expect(provider.explain).toHaveBeenCalledWith(toExplanationInput(createRequest()));
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('accepts the versioned web contract', async () => {
    const provider: ExplanationProvider = {
      explain: vi.fn().mockResolvedValue({ explanation: 'Web explanation.', relatedTerms: [] }),
    };
    const request = { ...createRequest(), version: WEB_EXPLANATION_CONTRACT_VERSION } as const;
    const response = await handleRequest(explainRequest(request, '/v1/explain/web'), {
      provider,
      rateLimiter: allowAll(),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ version: WEB_EXPLANATION_CONTRACT_VERSION });
    expect(provider.explain).toHaveBeenCalledWith(toExplanationInput(request));
  });

  it('accepts a book contract and normalizes book metadata for the provider', async () => {
    const provider: ExplanationProvider = {
      explain: vi.fn().mockResolvedValue({ explanation: 'Book explanation.', relatedTerms: [] }),
    };
    const request = createBookRequest();
    const response = await handleRequest(explainRequest(request, '/v1/explain/book'), {
      provider,
      rateLimiter: allowAll(),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ version: BOOK_EXPLANATION_CONTRACT_VERSION });
    expect(provider.explain).toHaveBeenCalledWith(toExplanationInput(request));
  });

  it('accepts the source-bound version 2 book contract', async () => {
    const provider: ExplanationProvider = {
      explain: vi.fn().mockResolvedValue({ explanation: 'Book explanation.', relatedTerms: [] }),
    };
    const request = createBookV2Request();
    const response = await handleRequest(explainRequest(request, '/v2/explain/book'), {
      provider,
      rateLimiter: allowAll(),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ version: BOOK_EXPLANATION_V2_CONTRACT_VERSION });
    expect(provider.explain).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: expect.objectContaining({
          selectedText: 'Mira',
          context: expect.objectContaining({ priorMentions: ['Mira kept the lighthouse key.'] }),
        }),
        document: expect.objectContaining({ kind: 'book', grounding: 'source-bound' }),
      }),
    );
  });

  it('rejects malformed and oversized requests before inference', async () => {
    const provider: ExplanationProvider = { explain: vi.fn() };

    const malformed = await handleRequest(explainRequest({ version: 1 }), {
      provider,
      rateLimiter: allowAll(),
    });
    const oversized = await handleRequest(
      new Request('https://api.example.com/explain', {
        method: 'POST',
        body: JSON.stringify({ padding: 'x'.repeat(33 * 1024) }),
      }),
      { provider, rateLimiter: allowAll() },
    );

    expect(malformed.status).toBe(400);
    expect(oversized.status).toBe(400);
    expect(provider.explain).not.toHaveBeenCalled();
  });

  it('rate limits before parsing or invoking inference', async () => {
    const provider: ExplanationProvider = { explain: vi.fn() };
    const response = await handleRequest(explainRequest(createRequest()), {
      provider,
      rateLimiter: {
        limit: vi.fn().mockResolvedValue({ success: false }),
      },
    });

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.json()).toMatchObject({
      error: { code: 'service_unavailable', retryable: true },
    });
    expect(provider.explain).not.toHaveBeenCalled();
  });

  it('maps provider failures to safe public errors', async () => {
    const response = await handleRequest(explainRequest(createRequest()), {
      provider: {
        explain: vi
          .fn()
          .mockRejectedValue(new ExplanationProviderError('service_unavailable', true)),
      },
      rateLimiter: allowAll(),
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: { code: 'service_unavailable', retryable: true },
    });
  });
});

function allowAll(): ExplainRateLimiter {
  return { limit: vi.fn().mockResolvedValue({ success: true }) };
}

function explainRequest(body: unknown, path = '/explain'): Request {
  return new Request(`https://api.example.com${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-installation-id': 'test-installation-id-0001',
    },
    body: JSON.stringify(body),
  });
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
    preferences: { level: 'simple' as const },
  };
}

function createRequest(): ExplainRequest {
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
