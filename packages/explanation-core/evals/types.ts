import type {
  ExplainRequest,
  ExplainResponse,
  ExplanationLevel,
} from '@context-explain/contracts';

export const EVALUATION_CATEGORIES = [
  'term',
  'phrase',
  'named-entity',
  'sentence',
  'paragraph',
  'fragment',
  'multilingual',
  'code-or-math',
  'adversarial',
] as const;

export type EvaluationCategory = (typeof EVALUATION_CATEGORIES)[number];

export type EvaluationExpectations = {
  expectedLanguage: string;
  forbiddenPhrases?: string[];
  mustMentionAny?: string[];
  reviewFocus: string[];
};

export type EvaluationCase = {
  id: string;
  category: EvaluationCategory;
  level: ExplanationLevel;
  request: ExplainRequest;
  expectations: EvaluationExpectations;
};

export type EvaluationCheck = {
  name: string;
  passed: boolean;
  detail?: string;
};

export type EvaluationResult = {
  id: string;
  category: EvaluationCategory;
  level: ExplanationLevel;
  durationMs: number;
  promptCharacters: number;
  promptVersion: string;
  response: ExplainResponse | { error: string };
  checks: EvaluationCheck[];
  reviewFocus: string[];
};
