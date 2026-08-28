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

The runner sends synthetic fixture data only. Live runs are opt-in because they can consume provider quota or incur cost. When targeting the production Worker, set `EXPLANATION_EVAL_DELAY_MS=6500` to remain below its current per-installation rate limit.

Automated checks cover schema success, forbidden injected phrases, and expected core concepts. Reviewers should additionally score each result from 1–5 for:

- exact-selection adherence
- contextual relevance
- groundedness and appropriate uncertainty
- language correctness
- readability at the requested level

Compare prompt or model variants on the same corpus. Change one major variable at a time and retain latency, token, error, and human-review results with the decision record.
