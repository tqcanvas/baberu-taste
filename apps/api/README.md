# API

AniList manga ingestion currently has three command modes:

- `sync:anilist:manga:debug`
  - Purpose: fetch, validate, and persist one explicit AniList page for targeted debugging.
  - Query style: `sort: ID`
  - Use this when you want a deterministic small slice to inspect mapping or persistence behavior.

- `sync:anilist:manga:catalog`
  - Purpose: backfill the AniList manga catalog into `baberu_taste` and resume safely after interruption.
  - Query style: `sort: ID`
  - State: `catalog_sync_checkpoints`
  - Use this for the initial bulk load or long-running resumeable catalog syncs.

- `sync:anilist:manga`
  - Purpose: poll AniList for newer changes after the catalog is already loaded.
  - Query style: `sort: [UPDATED_AT_DESC, ID_DESC]`
  - State: `sync_boundaries`
  - Use this for recurring update syncs that should stop early once the saved watermark is reached.

Recommended workflow:

1. Run `sync:anilist:manga:catalog` to build the catalog.
2. Run `sync:anilist:manga` on a schedule for incremental updates.
3. Use `sync:anilist:manga:debug` for small manual validation runs and debugging.
