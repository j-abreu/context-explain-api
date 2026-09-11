# Book explanation API contract

## Status

Version 3 is implemented as an additive sentence-aware contract. `POST /v1/explain/book` and `POST /v2/explain/book` remain supported unchanged for rollback and existing clients.

## Endpoint

`POST /v3/explain/book`

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
    "context": {
      "strategy": "sentence",
      "immediateText": {
        "before": "The wind had grown colder as",
        "after": "walked toward the lighthouse."
      },
      "adjacentText": {
        "before": "The harbor was already dark.",
        "after": "Behind her, the last shop closed for the night."
      }
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
- `reading.context.immediateText.before` and `.after` — the containing sentence segment around the exact selection (or bounded word-window fallback). The Worker reconstructs the immediate passage as `before + selection.text + after`.
- `reading.context.adjacentText.before` and `.after` — prose immediately outside the sentence segment; it is omitted from the immediate passage.
- `reading.context.strategy` — `sentence`, `sentence_clipped`, or `word_window`; it describes capture mechanics, not confidence.
- `preferences.level` — `simple`, `beginner`, or `detailed`.

### Optional book and reading fields

- `book.author`, `book.language`, and `book.format` come from KOReader document properties or the local file type.
- `reading.chapter.title` comes from KOReader's current TOC entry.
- `preferences.responseLanguage` overrides the language inferred from the passage.
- `reading.priorMentions` contains zero to five short, locally found excerpts. Their order is chronological.

The client must omit unavailable fields rather than inventing placeholders. It must not send the book file, a full chapter, publisher description, raw local path, raw XPointer, or a reading-progress value.

## Spoiler boundary

The Worker treats every selected passage and excerpt as untrusted quoted text. The prompt must:

1. Explain the exact selection in its immediate context.
2. Treat a one- or two-word selection as a possible in-book entity only when the supplied evidence supports that interpretation.
3. When it is likely a character, describe only the identity, role, and relationships established in `surroundingText` and `priorMentions`.
4. Never use general knowledge or facts not present in the supplied book excerpts for an in-book entity.
5. Say that the provided context is insufficient when identity or role cannot be established safely.

Chapter title is helpful orientation, not authorization to infer chapter events that are not in the excerpts.

The service also enforces an empty `relatedTerms` array for every source-bound version 2 response. This is deliberately stricter than prompting alone: live evaluation showed that the model could otherwise add unsupported book lore as related terms.

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

No `entityType` or confidence score is returned initially. `relatedTerms` is intentionally always empty for source-bound version 2 responses: the service enforces this after model generation rather than trusting the model to distinguish supported terms from book lore. We can restore grounded related terms only after adding verifiable local evidence extraction.

## Future local enrichment: prior mentions

For a selection of one or two words, KOReader may search the current book locally. It should:

1. Search the exact selection with case-insensitive matching and a small context window.
2. Consider only hits whose end position is strictly before the selection start position.
3. Keep at most the first five qualifying hits in book order, deduplicate equal excerpts, then send bounded snippets as `reading.priorMentions`.
4. Run the search outside the UI thread, allow cancellation, and omit `priorMentions` if the document backend cannot produce orderable positions or the search fails.

For reflowable KOReader documents, use search results' `start`/`end` XPointers and `compareXPointers` to enforce the boundary locally. PDF and OCR backends need a separate capability check; they must never fall back to searching later pages.

This deliberately leaves local position values on the device. The API receives only the spoiler-safe excerpts selected by the client.

## Limits

Text limits use Unicode scalar values (code points), not UTF-8 bytes, UTF-16 code units, or grapheme clusters. The request-body limit remains bytes.

| Field | Maximum |
|---|---:|
| Selection text | 5,000 |
| Book title / author / chapter title | 500 |
| Book language / format | 100 |
| Immediate + adjacent text per side | 100 whitespace tokens and 1,200 Unicode scalar values |
| Each immediate or adjacent text field | 1,200 |
| Prior mentions | 5 |
| Prior mention text | 300 |
| Request ID | 200 |
| Explanation | 4,000 |
| Related terms / each term | 5 / 200 |
| Error message | 500 |
| Encoded request body | 32 KiB |

KOReader intentionally captures prior-mention excerpts at 280 scalar values, below the public 300-value maximum.
