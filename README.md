# Context Explain API

Context Explain API is a Cloudflare Worker for generating structured, context-aware explanations. It is shared infrastructure for independent clients, currently including browser and KOReader readers.

## What it does

- Accepts versioned explanation requests for web pages and books.
- Normalizes client input into a provider-neutral explanation model.
- Uses Workers AI to return a structured explanation and optional related terms.
- Applies source-bound rules to book requests so claims about book-specific people, places, events, and relationships rely only on the supplied context and retrieved excerpts.
- Supports a bounded two-step book flow: the Worker can request one to three local searches, and the client submits a small set of retrieved excerpts for the final explanation.
- Enforces request limits, strict schemas, rate limits, and metadata-only operational logging.

The Worker never searches or stores a reader's book. Book retrieval happens locally in the client, and only bounded excerpts needed to complete an explanation are submitted.

## API surface

| Route | Purpose |
| --- | --- |
| `POST /explain` | Legacy compatibility route. |
| `POST /v1/explain/web` | Versioned web-page explanation. |
| `POST /v1/explain/book` | Initial book explanation contract. |
| `POST /v2/explain/book` | Source-bound book explanation. |
| `POST /v3/explain/book` | Source-bound book explanation with sentence-aware context. |
| `POST /v4/explain/book` | Initial book answer or local-search decision. |
| `POST /v4/explain/book/complete` | Final explanation using client-supplied local excerpts. |

Contract types and validators live in `packages/contracts`. Prompts and evaluation cases live in `packages/explanation-core`. The production Worker is in `apps/worker`.

## Privacy and safety

All submitted content is treated as untrusted data, never as instructions. Client code must not contain model-provider credentials. Requests and responses are length-bounded and validated at the API boundary. Worker logs include only operational metadata; they must not include selected text, book metadata, prompts, excerpts, or generated explanations.

Related terms are returned only when they are useful general vocabulary help for an ordinary one-word concept. The API suppresses them for passages, situations, names, and book-specific terms.

## Local development

Requires Node.js 22+ and pnpm 11.

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm --filter @context-explain/worker run build
```

Run the Worker locally with the configured development bindings:

```sh
pnpm dev:worker
```

## Ownership

This repository owns API contracts, prompt and provider behavior, deployment, rate limits, and service observability. Client repositories own their user interfaces, local context capture, local retrieval, and release process.
