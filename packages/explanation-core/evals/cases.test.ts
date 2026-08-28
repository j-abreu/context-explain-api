import {
  BOOK_EXPLANATION_V2_CONTRACT_VERSION,
  EXPLANATION_LEVELS,
  isExplainRequest,
  toExplanationInput,
} from '@context-explain/contracts';
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

  it('adds a source-bound evidence rule for version 2 book inputs', () => {
    const prompt = buildExplanationPrompt(
      toExplanationInput({
        version: BOOK_EXPLANATION_V2_CONTRACT_VERSION,
        selection: { text: 'Mira', kind: 'word' },
        book: { title: 'Harbor Lights', language: 'en' },
        reading: {
          surroundingText: { before: 'Before', after: 'after.' },
          priorMentions: [{ text: 'Mira kept the lighthouse key.' }],
        },
        preferences: { level: 'simple' },
      }),
    );

    expect(prompt.instructions).toContain('Do not use general knowledge');
    expect(prompt.instructions).not.toContain('may be identified using stable general knowledge');
    expect(prompt.instructions).toContain('briefly say who the character is');
    expect(prompt.instructions).toContain("establish the character's first appearance");
    expect(JSON.parse(prompt.input)).toMatchObject({
      context: { priorMentions: ['Mira kept the lighthouse key.'] },
    });
  });
});
