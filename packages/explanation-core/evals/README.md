# Explanation evaluations

This directory contains synthetic, provider-neutral fixtures for measuring explanation quality. The corpus covers terms, phrases, named entities, sentences, paragraphs, ambiguous fragments, multilingual passages, code and formulas, and adversarial page content. Every scenario runs at the `simple`, `beginner`, and `detailed` levels.

Run the offline corpus and prompt-size checks:

```sh
pnpm --filter @context-explain/explanation-core eval
```

Run the corpus against a local or deployed API endpoint:

```sh
EXPLANATION_EVAL_API_URL=http://127.0.0.1:8787 \
  pnpm --filter @context-explain/explanation-core eval -- --output=/tmp/explanation-eval.json
```

## Book baseline

`book-v1-baseline.json` contains eight public-domain book selections for the active `POST /v1/explain/book` contract. The companion runner is explicitly live-only and sends one request at a time:

```sh
pnpm --filter @context-explain/explanation-core eval:book -- \
  --endpoint=https://context-explain-api.jere-lab.workers.dev \
  --output=/tmp/book-v1-baseline-report.json
```

The default seven-second interval keeps the eight requests comfortably within the current per-installation limit. Review the stored `reviewFocus` notes for each response; this is a qualitative spoiler-safety baseline, not an automated pass/fail score.

Run the matching source-bound version 2 fixture with:

```sh
pnpm --filter @context-explain/explanation-core eval:book -- \
  --fixture=./book-v2-baseline.json \
  --endpoint=https://context-explain-api.jere-lab.workers.dev \
  --output=/tmp/book-v2-baseline-report.json
```

The runner sends synthetic fixture data only. Live runs are opt-in because they can consume provider quota or incur cost. When targeting the production Worker, set `EXPLANATION_EVAL_DELAY_MS=6500` to remain below its current per-installation rate limit.

Automated checks cover schema success, forbidden injected phrases, and expected core concepts. Reviewers should additionally score each result from 1–5 for:

- exact-selection adherence
- contextual relevance
- groundedness and appropriate uncertainty
- language correctness
- readability at the requested level

Compare prompt or model variants on the same corpus. Change one major variable at a time and retain latency, token, error, and human-review results with the decision record.
