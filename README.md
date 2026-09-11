# Context Explain API

Cloudflare Worker API for contextual explanations, shared by reader-facing clients including KOReader Explain.

## Current state

The Worker is deployed at `https://context-explain-api.jere-lab.workers.dev` and owns versioned contracts, prompt behavior, Workers AI integration, rate limiting, and observability.

- Compatibility routes remain available at `POST /explain`, `POST /v1/explain/web`, and `POST /v1/explain/book`.
- `POST /v2/explain/book` and `POST /v3/explain/book` provide source-bound book explanations with bounded reading context.
- Feature 04 uses `POST /v4/explain/book` for an initial answer-or-search decision and `POST /v4/explain/book/complete` for a final explanation after client-side retrieval.
- v4 permits one to three bounded client-side search queries; it never performs book retrieval in the Worker.
- v4 returns related terms only for a lowercase one-word ordinary concept. Phrases, passages, situations, proper names, and book-specific terms return an empty list.

`apps/worker` is the production Worker, `packages/contracts` owns HTTP validation, and `packages/explanation-core` owns provider-neutral prompts and evaluations.

## Build, test, and deploy

Requires Node.js 22+ and pnpm 11.

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm --filter @context-explain/worker run build
```

Deploy after the checks pass:

```sh
pnpm --filter @context-explain/worker run deploy
```

The deployment uses configured Cloudflare bindings for Workers AI and rate limiting. Do not place provider credentials in a client repository.

## Ownership

Client repositories own their UI, local context/retrieval behavior, and release process. This repository owns API contracts, model/provider behavior, deployment, and service observability.
