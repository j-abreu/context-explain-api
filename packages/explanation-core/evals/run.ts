import { writeFile } from 'node:fs/promises';

import { isExplainResponse, toExplanationInput, type ExplainResponse } from '@context-explain/contracts';

import { buildExplanationPrompt } from '../src/index.js';
import { EVALUATION_CASES } from './cases.js';
import { scoreResponse } from './score.js';
import type { EvaluationCase, EvaluationResult } from './types.js';

const endpoint = process.env.EXPLANATION_EVAL_API_URL?.trim();
const outputArgument = process.argv.find((value) => value.startsWith('--output='));
const outputPath = outputArgument?.slice('--output='.length);
const delayMs = parseNonNegativeNumber(process.env.EXPLANATION_EVAL_DELAY_MS);

if (endpoint === undefined || endpoint.length === 0) {
  const promptSizes = EVALUATION_CASES.map((value) =>
    buildExplanationPrompt(toExplanationInput(value.request)).instructions.length,
  );
  const report = {
    mode: 'offline',
    cases: EVALUATION_CASES.length,
    categories: countBy(EVALUATION_CASES, (value) => value.category),
    levels: countBy(EVALUATION_CASES, (value) => value.level),
    promptVersion: buildExplanationPrompt(toExplanationInput(EVALUATION_CASES[0]!.request)).version,
    promptCharacters: {
      minimum: Math.min(...promptSizes),
      maximum: Math.max(...promptSizes),
    },
    nextStep:
      'Set EXPLANATION_EVAL_API_URL to an /explain endpoint to run live provider evaluations.',
  };
  await emitReport(report, outputPath);
  process.exit(0);
}

const results: EvaluationResult[] = [];

for (const evaluationCase of EVALUATION_CASES) {
  results.push(await runCase(endpoint, evaluationCase));

  if (delayMs > 0) {
    await delay(delayMs);
  }
}

const checks = results.flatMap((value) => value.checks);
const report = {
  mode: 'live',
  endpoint,
  generatedAt: new Date().toISOString(),
  cases: results.length,
  passedChecks: checks.filter((value) => value.passed).length,
  failedChecks: checks.filter((value) => !value.passed).length,
  averageDurationMs:
    results.reduce((total, value) => total + value.durationMs, 0) / Math.max(results.length, 1),
  results,
};

await emitReport(report, outputPath);

async function runCase(url: string, evaluationCase: EvaluationCase): Promise<EvaluationResult> {
  const prompt = buildExplanationPrompt(toExplanationInput(evaluationCase.request));
  const startedAt = performance.now();

  try {
    const response = await fetch(new URL('/explain', url), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-installation-id': 'explanation-eval-runner-0001',
      },
      body: JSON.stringify(evaluationCase.request),
    });
    const body: unknown = await response.json();
    const durationMs = Math.round(performance.now() - startedAt);

    if (!isExplainResponse(body)) {
      return failedResult(evaluationCase, prompt, durationMs, 'Invalid API response.');
    }

    return {
      id: evaluationCase.id,
      category: evaluationCase.category,
      level: evaluationCase.level,
      durationMs,
      promptCharacters: prompt.instructions.length,
      promptVersion: prompt.version,
      response: body,
      checks: scoreResponse(evaluationCase, body),
      reviewFocus: [
        ...evaluationCase.expectations.reviewFocus,
        `The response prose is written in ${evaluationCase.expectations.expectedLanguage}.`,
      ],
    };
  } catch (error: unknown) {
    return failedResult(
      evaluationCase,
      prompt,
      Math.round(performance.now() - startedAt),
      error instanceof Error ? error.message : 'Unknown request failure.',
    );
  }
}

function failedResult(
  evaluationCase: EvaluationCase,
  prompt: ReturnType<typeof buildExplanationPrompt>,
  durationMs: number,
  error: string,
): EvaluationResult {
  const response: ExplainResponse | { error: string } = { error };

  return {
    id: evaluationCase.id,
    category: evaluationCase.category,
    level: evaluationCase.level,
    durationMs,
    promptCharacters: prompt.instructions.length,
    promptVersion: prompt.version,
    response,
    checks: [{ name: 'successful structured response', passed: false, detail: error }],
    reviewFocus: evaluationCase.expectations.reviewFocus,
  };
}

async function emitReport(value: unknown, path: string | undefined): Promise<void> {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;

  if (path === undefined || path.length === 0) {
    process.stdout.write(serialized);
    return;
  }

  await writeFile(path, serialized, 'utf8');
  process.stdout.write(`Wrote evaluation report to ${path}\n`);
}

function countBy<T>(values: T[], key: (value: T) => string): Record<string, number> {
  const result: Record<string, number> = {};

  for (const value of values) {
    const group = key(value);
    result[group] = (result[group] ?? 0) + 1;
  }

  return result;
}

function parseNonNegativeNumber(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
