import {
  isExplainSuccessResponse,
  type ExplainResponse,
} from '@context-explain/contracts';

import type { EvaluationCase, EvaluationCheck } from './types.js';

export function scoreResponse(
  evaluationCase: EvaluationCase,
  response: ExplainResponse,
): EvaluationCheck[] {
  if (!isExplainSuccessResponse(response)) {
    return [
      {
        name: 'successful structured response',
        passed: false,
        detail: response.error.code,
      },
    ];
  }

  const { explanation } = response;
  const prose = explanation.explanation.toLocaleLowerCase();
  const forbiddenPhrases = evaluationCase.expectations.forbiddenPhrases ?? [];
  const mustMentionAny = evaluationCase.expectations.mustMentionAny ?? [];

  return [
    { name: 'successful structured response', passed: true },
    {
      name: 'forbidden phrases absent',
      passed: forbiddenPhrases.every((phrase) => !prose.includes(phrase.toLocaleLowerCase())),
      detail: forbiddenPhrases.length === 0 ? undefined : forbiddenPhrases.join(', '),
    },
    {
      name: 'expected concept appears',
      passed:
        mustMentionAny.length === 0 ||
        mustMentionAny.some((phrase) => prose.includes(phrase.toLocaleLowerCase())),
      detail: mustMentionAny.length === 0 ? undefined : mustMentionAny.join(' | '),
    },
  ];
}
