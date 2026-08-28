import { readFile, writeFile } from 'node:fs/promises';

type BookRequest = {
  version: 1;
  selection: {
    selectedText: string;
    context: {
      immediate: string;
      containingBlock: string;
      before?: string;
      after?: string;
      heading?: string;
    };
  };
  book: {
    title: string;
    author?: string;
    language?: string;
    format?: string;
  };
  preferences: {
    level: 'simple' | 'beginner' | 'detailed';
    responseLanguage?: string;
  };
};

type FixtureCase = {
  id: string;
  source: { title: string; author: string; location: string; url: string };
  request: BookRequest;
  reviewFocus: string[];
};

type Fixture = {
  fixtureVersion: number;
  description: string;
  cases: FixtureCase[];
};

const DEFAULT_FIXTURE = new URL('./book-v1-baseline.json', import.meta.url);
const endpoint = readArgument('--endpoint');
const fixturePath = readArgument('--fixture');
const outputPath = readArgument('--output');
const delayMs = parseDelay(readArgument('--delay-ms') ?? '7000');

if (endpoint === undefined) {
  throw new Error('Pass --endpoint=https://host.example to run the book evaluation.');
}

const fixture = await readFixture(fixturePath === undefined ? DEFAULT_FIXTURE : new URL(fixturePath, import.meta.url));
const results: unknown[] = [];

for (const [index, evaluationCase] of fixture.cases.entries()) {
  const startedAt = performance.now();
  const response = await fetch(new URL('/v1/explain/book', endpoint), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-installation-id': 'book-baseline-evaluation-0001',
    },
    body: JSON.stringify(evaluationCase.request),
  });
  const body: unknown = await response.json();

  results.push({
    id: evaluationCase.id,
    source: evaluationCase.source,
    request: evaluationCase.request,
    status: response.status,
    durationMs: Math.round(performance.now() - startedAt),
    response: body,
    reviewFocus: evaluationCase.reviewFocus,
  });

  if (index < fixture.cases.length - 1) {
    await delay(delayMs);
  }
}

const report = {
  fixtureVersion: fixture.fixtureVersion,
  description: fixture.description,
  endpoint: new URL(endpoint).origin,
  generatedAt: new Date().toISOString(),
  cases: results.length,
  results,
};
const serialized = `${JSON.stringify(report, null, 2)}\n`;

if (outputPath === undefined) {
  process.stdout.write(serialized);
} else {
  await writeFile(outputPath, serialized, 'utf8');
  process.stdout.write(`Wrote book evaluation report to ${outputPath}\n`);
}

async function readFixture(url: URL): Promise<Fixture> {
  return JSON.parse(await readFile(url, 'utf8')) as Fixture;
}

function readArgument(name: string): string | undefined {
  const value = process.argv.find((argument) => argument.startsWith(`${name}=`));
  return value?.slice(name.length + 1);
}

function parseDelay(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('--delay-ms must be a non-negative number.');
  }
  return parsed;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
