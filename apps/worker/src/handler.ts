import {
  EXPLANATION_CONTRACT_VERSION,
  BOOK_EXPLANATION_CONTRACT_VERSION,
  BOOK_EXPLANATION_V2_CONTRACT_VERSION,
  isBookExplainV2Request,
  WEB_EXPLANATION_CONTRACT_VERSION,
  isBookExplainRequest,
  isExplainRequest,
  isWebExplainRequest,
  toExplanationInput,
  type ExplainErrorCode,
  type ExplanationInput,
} from '@context-explain/contracts';

import {
  ExplanationProviderError,
  type ExplanationProvider,
} from './provider.js';

const REQUEST_BODY_LIMIT_BYTES = 32 * 1024;
const JSON_HEADERS = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
} as const;

export type ExplainRateLimiter = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

type HandleRequestOptions = {
  provider: ExplanationProvider;
  rateLimiter: ExplainRateLimiter;
};

type ExplainRoute = {
  version: number;
  accepts: (value: unknown) => boolean;
  normalize: (value: unknown) => ExplanationInput;
};

const EXPLAIN_ROUTES: Record<string, ExplainRoute> = {
  '/explain': {
    version: EXPLANATION_CONTRACT_VERSION,
    accepts: isExplainRequest,
    normalize: normalizeLegacyWebRequest,
  },
  '/v1/explain/web': {
    version: WEB_EXPLANATION_CONTRACT_VERSION,
    accepts: isWebExplainRequest,
    normalize: normalizeWebRequest,
  },
  '/v1/explain/book': {
    version: BOOK_EXPLANATION_CONTRACT_VERSION,
    accepts: isBookExplainRequest,
    normalize: normalizeBookRequest,
  },
  '/v2/explain/book': {
    version: BOOK_EXPLANATION_V2_CONTRACT_VERSION,
    accepts: isBookExplainV2Request,
    normalize: normalizeBookV2Request,
  },
};

export async function handleRequest(
  request: Request,
  options: HandleRequestOptions,
): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/health') {
    if (request.method !== 'GET') {
      return methodNotAllowed('GET');
    }

    return json({ status: 'ok' }, 200);
  }

  const route = EXPLAIN_ROUTES[url.pathname];
  if (route === undefined) {
    return json({ error: 'not_found' }, 404);
  }

  if (request.method !== 'POST') {
    return methodNotAllowed('POST');
  }

  const requestId = crypto.randomUUID();
  const rateLimitKey = getRateLimitKey(request);
  const { success } = await options.rateLimiter.limit({ key: rateLimitKey });

  if (!success) {
    return explainError(route.version, requestId, 'service_unavailable', 'Too many explanation requests.', true, 429, {
      'retry-after': '60',
    });
  }

  const body = await readJsonBody(request);
  if (!route.accepts(body)) {
    return explainError(
      route.version,
      requestId,
      'invalid_request',
      'The explanation request is invalid.',
      false,
      400,
    );
  }

  try {
    const explanation = await options.provider.explain(route.normalize(body));
    const response = {
      version: route.version,
      requestId,
      explanation,
    };
    return json(response, 200);
  } catch (error: unknown) {
    const providerError =
      error instanceof ExplanationProviderError
        ? error
        : new ExplanationProviderError('internal_error', false);
    const status = providerError.code === 'internal_error' ? 500 : 503;

    return explainError(
      route.version,
      requestId,
      providerError.code,
      getPublicErrorMessage(providerError.code),
      providerError.retryable,
      status,
    );
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > REQUEST_BODY_LIMIT_BYTES) {
    return undefined;
  }

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > REQUEST_BODY_LIMIT_BYTES) {
      return undefined;
    }

    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function getRateLimitKey(request: Request): string {
  const installationId = request.headers.get('x-installation-id')?.trim();
  if (installationId !== undefined && /^[a-zA-Z0-9_-]{20,100}$/.test(installationId)) {
    return `installation:${installationId}`;
  }

  const clientAddress = request.headers.get('cf-connecting-ip') ?? 'unknown';
  return `address:${clientAddress}`;
}

function explainError(
  version: number,
  requestId: string,
  code: ExplainErrorCode,
  message: string,
  retryable: boolean,
  status: number,
  headers?: HeadersInit,
): Response {
  const response = {
    version,
    requestId,
    error: { code, message, retryable },
  };
  return json(response, status, headers);
}

function normalizeLegacyWebRequest(value: unknown): ExplanationInput {
  if (!isExplainRequest(value)) {
    throw new Error('Invalid legacy web request passed to route normalization.');
  }

  return toExplanationInput(value);
}

function normalizeWebRequest(value: unknown): ExplanationInput {
  if (!isWebExplainRequest(value)) {
    throw new Error('Invalid web request passed to route normalization.');
  }

  return toExplanationInput(value);
}

function normalizeBookRequest(value: unknown): ExplanationInput {
  if (!isBookExplainRequest(value)) {
    throw new Error('Invalid book request passed to route normalization.');
  }

  return toExplanationInput(value);
}

function normalizeBookV2Request(value: unknown): ExplanationInput {
  if (!isBookExplainV2Request(value)) {
    throw new Error('Invalid version 2 book request passed to route normalization.');
  }

  return toExplanationInput(value);
}

function getPublicErrorMessage(code: ExplanationProviderError['code']): string {
  if (code === 'timeout') {
    return 'The explanation request timed out.';
  }

  if (code === 'service_unavailable') {
    return 'The explanation service is temporarily unavailable.';
  }

  return 'The explanation could not be generated.';
}

function methodNotAllowed(allow: string): Response {
  return json({ error: 'method_not_allowed' }, 405, { allow });
}

function json(value: unknown, status: number, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...JSON_HEADERS, ...Object.fromEntries(new Headers(headers)) },
  });
}
