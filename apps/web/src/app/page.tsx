import { MediaDetailSplitList } from "../components/media-detail-split-list";
import {
  CONTENT_ITEM_PAGE_SIZE,
  type ContentItemPage,
  listContentItemPage,
} from "../lib/content-items";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let errorMessage: string | null = null;
  let initialPage: ContentItemPage = {
    items: [],
    hasMore: false,
    nextOffset: 0,
  };

  try {
    initialPage = await listContentItemPage({
      limit: CONTENT_ITEM_PAGE_SIZE,
      offset: 0,
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Failed to load content items.";
  }

  return (
    <main className="page-shell page-shell-feed">
      {errorMessage ? (
        <section className="state-panel">
          <h2>Content unavailable</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {!errorMessage && initialPage.items.length === 0 ? (
        <section className="state-panel">
          <h2>No content items found</h2>
          <p>Run the manga catalog sync first, then reload this page.</p>
        </section>
      ) : null}

      {!errorMessage && initialPage.items.length > 0 ? (
        <MediaDetailSplitList
          initialItems={initialPage.items}
          initialHasMore={initialPage.hasMore}
          initialNextOffset={initialPage.nextOffset}
          pageSize={CONTENT_ITEM_PAGE_SIZE}
        />
      ) : null}
    </main>
  );
}
