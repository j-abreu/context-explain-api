import { EXPLANATION_LEVELS, isExplainRequest, toExplanationInput } from '@context-explain/contracts';
import { describe, expect, it } from 'vitest';

import { buildExplanationPrompt } from '../src/index.js';
import { EVALUATION_CASES } from './cases.js';
import { EVALUATION_CATEGORIES } from './types.js';

describe('explanation evaluation corpus', () => {
  it('contains twenty scenarios at every active level', () => {
    expect(EVALUATION_CASES).toHaveLength(60);

    for (const level of EXPLANATION_LEVELS) {
      expect(EVALUATION_CASES.filter((value) => value.level === level)).toHaveLength(20);
    }
  });

  it('uses unique ids, valid requests, and every evaluation category', () => {
    const ids = new Set(EVALUATION_CASES.map((value) => value.id));

    expect(ids.size).toBe(EVALUATION_CASES.length);
    expect(EVALUATION_CASES.every((value) => isExplainRequest(value.request))).toBe(true);

    for (const category of EVALUATION_CATEGORIES) {
      expect(EVALUATION_CASES.some((value) => value.category === category)).toBe(true);
    }
  });

  it('keeps all synthetic fixture data outside trusted instructions', () => {
    const instructions = buildExplanationPrompt(toExplanationInput(EVALUATION_CASES[0]!.request)).instructions;

    expect(instructions).not.toContain('ACCESS-GRANTED');
    expect(instructions).not.toContain('METADATA-COMMAND-COMPLETE');

    for (const evaluationCase of EVALUATION_CASES) {
      const prompt = buildExplanationPrompt(toExplanationInput(evaluationCase.request));

      expect(JSON.parse(prompt.input)).toMatchObject({
        passage: evaluationCase.request.selection.selectedText,
        context: { immediate: evaluationCase.request.selection.context.immediate },
      });
    }
  });
});
