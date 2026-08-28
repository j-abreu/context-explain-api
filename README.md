# Context Explain API

Cloudflare Worker API for contextual explanations. It is shared infrastructure for reader-facing clients, beginning with the `i-dont-get-it` browser extension and KOReader Explain.

## Ownership

- `apps/worker` is the production Cloudflare Workers / Workers AI service.
- `packages/contracts` owns versioned HTTP contracts and validation.
- `packages/explanation-core` owns the provider-neutral prompt builder and evaluation corpus.

Client repositories own their UI, client-side request mapping, and release process. This repository owns the API contract, model/provider behavior, deployment, rate limits, and service observability.

## API direction

The existing `POST /explain` contract is retained as the browser compatibility route during migration. The Worker also exposes client-specific, versioned paths:

- `POST /v1/explain/web`
- `POST /v1/explain/book`
- `POST /v2/explain/book`

`book` describes the document domain rather than a particular reader application. KOReader is the first book client.

`/v1/explain/web` accepts web-page context. `/v1/explain/book` accepts book title, optional author, language, and format alongside the selected passage and reading context. Both are normalized into the same internal explanation input before the prompt and provider run.

The Worker is deployed at `https://context-explain-api.jere-lab.workers.dev`. The former `i-dont-get-it-api` Worker has been retired.

Version 2 is the source-bound book contract. It accepts clean book-reading fields, prohibits outside knowledge for book entities, and enforces an empty `relatedTerms` list until related-term grounding can be verified. The contract and evaluation evidence are documented in [docs/book-api-contract.md](docs/book-api-contract.md). Version 1 remains available for the existing client during migration.

## Local checks

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm --filter @context-explain/worker build
```

## Migration source

This repository was extracted from `i-dont-get-it` at commit `d03414a` on 2026-08-28. The next migration step is to make this repository the sole source of truth for the Worker deployment, then update each client deliberately.
