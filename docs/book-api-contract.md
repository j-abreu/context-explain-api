# Book explanation API contract

## Status

Proposed for the next book-contract version. `POST /v1/explain/book` remains supported as the first KOReader integration while this contract is evaluated.

## Endpoint

`POST /v2/explain/book`

The route is book-domain specific, rather than KOReader specific, so another reader can adopt it. Versioning stays in the path because this payload deliberately replaces the generic web-shaped context fields in v1.

## Request

```json
{
  "version": 2,
  "selection": {
    "text": "Mira",
    "kind": "word"
  },
  "book": {
    "title": "Harbor Lights",
    "author": "A. Reader",
    "language": "en",
    "format": "epub"
  },
  "reading": {
    "chapter": {
      "title": "Chapter 3"
    },
    "surroundingText": {
      "before": "The wind had grown colder as",
      "after": "walked toward the lighthouse."
    },
    "priorMentions": [
      {
        "text": "Mira kept the lighthouse key in her coat pocket."
      }
    ]
  },
  "preferences": {
    "level": "simple",
    "responseLanguage": "en"
  }
}
```

### Required fields

- `selection.text` — exact selected text.
- `selection.kind` — `word`, `phrase`, or `passage`; this is computed locally from the selection and is only a presentation hint.
- `book.title` — may be an empty string when metadata is unavailable.
- `reading.surroundingText.before` and `.after` — bounded text immediately adjacent to the selection. The Worker reconstructs the immediate passage as `before + selection.text + after`.
- `preferences.level` — `simple`, `beginner`, or `detailed`.

### Optional book and reading fields

- `book.author`, `book.language`, and `book.format` come from KOReader document properties or the local file type.
- `reading.chapter.title` comes from KOReader's current TOC entry.
- `preferences.responseLanguage` overrides the language inferred from the passage.
- `reading.priorMentions` contains zero to three short, locally found excerpts. Their order is chronological.

The client must omit unavailable fields rather than inventing placeholders. It must not send the book file, a full chapter, publisher description, raw local path, raw XPointer, or a reading-progress value.

## Spoiler boundary

The Worker treats every selected passage and excerpt as untrusted quoted text. The prompt must:

1. Explain the exact selection in its immediate context.
2. Treat a one- or two-word selection as a possible in-book entity only when the supplied evidence supports that interpretation.
3. When it is likely a character, describe only the identity, role, and relationships established in `surroundingText` and `priorMentions`.
4. Never use general knowledge or facts not present in the supplied book excerpts for an in-book entity.
5. Say that the provided context is insufficient when identity or role cannot be established safely.

Chapter title is helpful orientation, not authorization to infer chapter events that are not in the excerpts.

## Response

Keep the v1 response shape for the first v2 iteration:

```json
{
  "version": 2,
  "requestId": "…",
  "explanation": {
    "explanation": "Mira is the person walking to the lighthouse; the earlier mention identifies her as carrying its key.",
    "relatedTerms": []
  }
}
```

No `entityType` or confidence score is returned initially. The interface only needs a useful explanation, and an unsupported classification would create false certainty. We can add explicit entity metadata only after evaluating real book selections.

## Future local enrichment: prior mentions

For a selection of one or two words, KOReader may search the current book locally. It should:

1. Search the exact selection with case-insensitive matching and a small context window.
2. Consider only hits whose end position is strictly before the selection start position.
3. Keep at most the first three qualifying hits in book order, deduplicate equal excerpts, then send bounded snippets as `reading.priorMentions`.
4. Run the search outside the UI thread, allow cancellation, and omit `priorMentions` if the document backend cannot produce orderable positions or the search fails.

For reflowable KOReader documents, use search results' `start`/`end` XPointers and `compareXPointers` to enforce the boundary locally. PDF and OCR backends need a separate capability check; they must never fall back to searching later pages.

This deliberately leaves local position values on the device. The API receives only the spoiler-safe excerpts selected by the client.

## Limits to validate before implementation

- selected text: 5,000 Unicode characters maximum
- adjacent context: 450 Unicode characters per side initially
- prior mentions: at most 3 excerpts, initially 300 Unicode characters each
- request: retain the Worker's 32 KiB maximum body size

The exact snippet size and the choice between the first three versus more recent prior mentions are evaluation questions. The initial product decision is first three, as they are most likely to introduce a character without relying on later developments.
