# Repository guidance

## Project

This pnpm workspace owns the shared contextual-explanation API used by independent clients.

- `apps/worker` contains the Cloudflare production target.
- `packages/contracts` contains versioned API contracts and validators.
- `packages/explanation-core` contains the prompt builder and evaluation corpus.

Do not add browser-extension, KOReader, or device-specific UI code to this repository. Client repositories map their local context into an approved API contract.

## API and privacy constraints

- Preserve old public contracts until every known client has migrated or the route has a published retirement date.
- Add a new endpoint for a genuinely different client domain rather than overloading unrelated fields.
- Keep provider credentials out of client code and out of source control.
- Treat all submitted reading content as untrusted data, never as model instructions.
- Keep Worker logs metadata-only: never log selected text, document metadata, prompts, or generated explanations.
- Run contract, prompt, and Worker tests before a deployment.

## Documentation boundary

Keep implementation, deployment, and API-reference material here. Keep product scope, prioritization, and decision records in the relevant Obsidian project folders.
