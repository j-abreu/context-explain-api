import {
  normalizeBookDecision,
  isStructuredExplanation,
  STRUCTURED_EXPLANATION_JSON_SCHEMA,
  type BookDecision,
  type BookExplainV4CompletionRequest,
  type BookExplainV4Request,
  type ExplanationInput,
  type StructuredExplanation,
} from '@context-explain/contracts';
import { buildBookCompletionPrompt, buildBookDecisionPrompt, buildExplanationPrompt } from '@context-explain/explanation-core';

export const WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast' as const;

export type ExplanationProviderResult = StructuredExplanation;

export type ExplanationProvider = {
  explain: (request: ExplanationInput) => Promise<ExplanationProviderResult>;
  decideBookExplanation?: (request: BookExplainV4Request) => Promise<BookDecision>;
  completeBookExplanation?: (request: BookExplainV4CompletionRequest) => Promise<StructuredExplanation>;
};

const BOOK_DECISION_JSON_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    action: { type: 'string', enum: ['answer', 'search'] },
    explanation: STRUCTURED_EXPLANATION_JSON_SCHEMA,
    bookMode: { type: 'string', enum: ['reference', 'narrative', 'uncertain'] },
    classificationBasis: { type: 'string', maxLength: 240 },
    queries: { type: 'array', maxItems: 3, items: { type: 'object', additionalProperties: false, properties: { text: { type: 'string', maxLength: 200 }, requestedScope: { type: 'string', enum: ['before_selection', 'whole_book'] } }, required: ['text', 'requestedScope'] } },
  }, required: ['action'],
} as const;

export type WorkersAiBinding = {
  run(
    model: typeof WORKERS_AI_MODEL,
    input: {
      messages: Array<{ role: 'system' | 'user'; content: string }>;
      max_tokens: number;
      temperature: number;
      stream: false;
      response_format: {
        type: 'json_schema';
        json_schema: object;
      };
    },
  ): Promise<unknown>;
};

export type ExplanationProviderErrorCode = 'timeout' | 'service_unavailable' | 'internal_error';

export class ExplanationProviderError extends Error {
  constructor(
    readonly code: ExplanationProviderErrorCode,
    readonly retryable: boolean,
  ) {
    super('The explanation provider failed.');
    this.name = 'ExplanationProviderError';
  }
}

export function createWorkersAiExplanationProvider(ai: WorkersAiBinding): ExplanationProvider {
  return {
    async explain(request) {
      const prompt = buildExplanationPrompt(request);

      try {
        const result = await ai.run(WORKERS_AI_MODEL, {
          messages: [
            { role: 'system', content: prompt.instructions },
            { role: 'user', content: prompt.input },
          ],
          max_tokens: prompt.maxOutputTokens,
          temperature: 0.2,
          stream: false,
          response_format: {
            type: 'json_schema',
            json_schema: STRUCTURED_EXPLANATION_JSON_SCHEMA,
          },
        });
        const explanation = extractStructuredExplanation(result);

        if (explanation === undefined) {
          console.error('Workers AI returned no usable explanation.', {
            promptVersion: prompt.version,
            ...describeResultShape(result),
          });
          throw new ExplanationProviderError('internal_error', false);
        }

        return request.document.grounding === 'source-bound'
          ? { ...explanation, relatedTerms: [] }
          : explanation;
      } catch (error: unknown) {
        if (error instanceof ExplanationProviderError) {
          throw error;
        }

        console.error('Workers AI request failed.', describeError(error));
        throw classifyWorkersAiError(error);
      }
    },
    async decideBookExplanation(request) {
      const prompt = buildBookDecisionPrompt(request);
      const result = await runPrompt(ai, prompt, BOOK_DECISION_JSON_SCHEMA);
      const decision = normalizeBookDecision(extractJson(result));
      if (decision === undefined) {
        console.error('Workers AI returned no usable book decision.', { promptVersion: prompt.version, ...describeResultShape(result) });
        throw new ExplanationProviderError('internal_error', false);
      }
      return decision;
    },
    async completeBookExplanation(request) {
      const prompt = buildBookCompletionPrompt(request);
      const result = await runPrompt(ai, prompt, STRUCTURED_EXPLANATION_JSON_SCHEMA);
      const explanation = extractStructuredExplanation(result);
      if (explanation === undefined) {
        console.error('Workers AI returned no usable book completion.', { promptVersion: prompt.version, ...describeResultShape(result) });
        throw new ExplanationProviderError('internal_error', false);
      }
      return { ...explanation, relatedTerms: [] };
    },
  };
}

async function runPrompt(ai: WorkersAiBinding, prompt: { instructions: string; input: string; maxOutputTokens: number }, schema: object): Promise<unknown> {
  try {
    return await ai.run(WORKERS_AI_MODEL, { messages: [{ role: 'system', content: prompt.instructions }, { role: 'user', content: prompt.input }], max_tokens: prompt.maxOutputTokens, temperature: 0.2, stream: false, response_format: { type: 'json_schema', json_schema: schema } });
  } catch (error: unknown) {
    console.error('Workers AI request failed.', describeError(error));
    throw classifyWorkersAiError(error);
  }
}

function extractStructuredExplanation(result: unknown): StructuredExplanation | undefined {
  const value = extractJson(result);
  return isStructuredExplanation(value) ? value : undefined;
}

function extractJson(result: unknown): unknown {
  if (!isRecord(result)) {
    return undefined;
  }

  if (result.response !== undefined) {
    return result.response;
  }

  const firstChoice = Array.isArray(result.choices) ? result.choices[0] : undefined;
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return undefined;
  }

  const content = firstChoice.message.content;
  if (isRecord(content)) {
    return content;
  }

  if (typeof content !== 'string') {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(content);
    return parsed;
  } catch {
    return undefined;
  }
}

function classifyWorkersAiError(error: unknown): ExplanationProviderError {
  if (!isRecord(error)) {
    return new ExplanationProviderError('internal_error', false);
  }

  const status = typeof error.status === 'number' ? error.status : undefined;
  const name = typeof error.name === 'string' ? error.name : '';
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';

  if (name === 'AbortError' || message.includes('timeout') || message.includes('timed out')) {
    return new ExplanationProviderError('timeout', true);
  }

  if (status === 429 || (status !== undefined && status >= 500)) {
    return new ExplanationProviderError('service_unavailable', true);
  }

  return new ExplanationProviderError('internal_error', false);
}

function describeResultShape(result: unknown): Record<string, unknown> {
  if (!isRecord(result)) {
    return { resultType: typeof result };
  }

  const firstChoice = Array.isArray(result.choices) ? result.choices[0] : undefined;
  const message = isRecord(firstChoice) && isRecord(firstChoice.message)
    ? firstChoice.message
    : undefined;

  return {
    resultKeys: Object.keys(result),
    responseType: typeof result.response,
    choicesLength: Array.isArray(result.choices) ? result.choices.length : undefined,
    firstChoiceKeys: isRecord(firstChoice) ? Object.keys(firstChoice) : undefined,
    messageKeys: message === undefined ? undefined : Object.keys(message),
    contentType: message === undefined ? undefined : typeof message.content,
  };
}

function describeError(error: unknown): Record<string, unknown> {
  if (!isRecord(error)) {
    return { errorType: typeof error };
  }

  return {
    name: typeof error.name === 'string' ? error.name : undefined,
    status: typeof error.status === 'number' ? error.status : undefined,
    code: typeof error.code === 'number' || typeof error.code === 'string' ? error.code : undefined,
    message: typeof error.message === 'string' ? error.message.slice(0, 300) : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
