# Architecture and Performance Modernization

## Database versioning and correctness

- Database schema is managed by **Flyway**.
- Migrations:
  - `V1__baseline.sql` — baseline schema for H2/MySQL
  - `V2__add_document_sequence.java` — per-user sequence, historical backfill, unique constraint
  - `V3__add_document_summaries.java` — lightweight summary/preview columns and backfill
  - `V4__add_document_search_text.java` — denormalized full-text search column and backfill
  - `V5__refresh_workspace_previews.java` — refresh legacy preview payloads with `pageCount`
- Sequence allocation uses:
  - atomic database uniqueness: `(user_id, sequence_no)`
  - bounded retry when a concurrent create hits the unique constraint
  - explicit flush inside the retry window so deferred constraint errors are retried too
- H2/MySQL migrations are selected through
  `spring.flyway.locations=classpath:db/migration/{vendor},classpath:db/migration/common`.
- `flyway_schema_history` is the source of truth for applied schema versions.

## List query scalability

- Workspace list uses a dedicated paginated endpoint: `GET /api/diagrams/page`.
- Supports:
  - `page`, `size`
  - `mode`
  - `query`
  - `sort` / `direction`
- The list query uses a JPA constructor projection and does **not** select the document
  `content` LOB or the `search_text` index column.
- Full-content search reads the denormalized `search_text` value in the `WHERE` clause, so matching
  deep document text does not load the original 20 MB payload into the API process.
- `preview_json`, `summary_text`, `search_text`, and `page_count` are maintained on
  create/update/restore.
- Preview payloads are capped at 40 pages, 12 nodes, 12 edges, and 12 text blocks per page. The
  original page count is preserved through the preview contract.

## Frontend persistence

- `localStorage` stores only workspace metadata:
  - active document key
  - document counter
  - document count
  - saved timestamp
- Full workspace cache and local drafts are stored in **IndexedDB** through `idb-keyval`.
- Workspace persistence is debounced by 350ms and flushed on:
  - `beforeunload`
  - `pagehide`
  - `visibilitychange` (hidden)
  - component unmount
- When IndexedDB is unavailable (private mode or policy), the same snapshot falls back to a
  dedicated localStorage draft key. If the synchronous unload path races the IndexedDB write, the
  fallback preserves the latest drafts.
- This removes the previous synchronous full-workspace `JSON.stringify` from every editor change.

## Workspace rendering and pagination

- The frontend only holds the current server page plus unsaved local drafts.
- Unsaved drafts participate in the same virtual page model as saved documents. The server request
  is over-fetched only when necessary to offset drafts, so a page still renders exactly the selected
  page size and drafts are not lost while browsing later pages.
- Workspace previews are cached by:
  - document id
  - `updatedAt`
  - content revision
  - summary/full state
- The cache is bounded to 300 entries.
- Search, type filter, sort, and pagination are executed by the server.
- Preview computation is no longer performed for the entire document library on every render.
- Summary-only Markdown and diagram cards read text/labels from their active preview page rather
  than expecting root-level content fields.
- Document normalization treats `content.pages` as authoritative when a page already has meaningful
  content, so legacy root-level defaults cannot overwrite the active preview page and blank every
  thumbnail.

## Bundle size

- Syntax highlighting registers an explicit grammar set instead of importing lowlight `common`.
- jsPDF, JSZip, XMind and editor surfaces remain lazy-loaded.
- Locale message tables are split into:
  - `src/i18n/messages/zh.js`
  - `src/i18n/messages/en.js`
- App and editor styles are extracted into:
  - `src/styles/app.css`
  - `src/styles/editor.css`

## Extraction completed in this pass

- `src/workspace/workspaceDocuments.js` — draft/server normalization, stable keys, merge helpers
- `src/editor/render/workspacePreview.js` — active-page thumbnail and summary projection
- `src/editor/services/workspaceStorage.js` — IndexedDB, metadata, fallback and clone helpers
- `src/editor/render/useMarkdownFormatTools.js` — Markdown table/code/link formatting controls
- `src/editor/state/useDocumentAutoSave.js` — draft persistence, debounced autosave, backoff retry
- `src/editor/state/useDocumentExport.js` — PDF/PNG/SVG/Markdown/OPML/XMind export and print preview
- `src/editor/render/geometry.js` — rotation and resize cursor geometry
- `src/editor/render/markdownCodeBlock.js` — code block metadata and behavior
- `src/i18n/messages/zh.js`
- `src/i18n/messages/en.js`

`Editor.vue` and `useEditorState.js` still contain mode-specific canvas/command logic. The risky
parts are now isolated behind tested modules; further extraction should continue feature-by-feature
with the existing E2E regression suite rather than as a single large rewrite.
