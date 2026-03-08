"use client";

import Image from "next/image";
import { startTransition, useEffect, useRef, useState } from "react";

import type { ContentItemCard } from "../lib/content-items";

interface ContentItemPageResponse {
  items: ContentItemCard[];
  hasMore: boolean;
  nextOffset: number;
}

function formatDescription(description: string | null): string {
  if (!description) {
    return "No short description is available for this item yet.";
  }

  return description.length > 380 ? `${description.slice(0, 377).trimEnd()}...` : description;
}

export function MediaDetailSplitList({
  initialItems,
  initialHasMore,
  initialNextOffset,
  pageSize,
}: {
  initialItems: ContentItemCard[];
  initialHasMore: boolean;
  initialNextOffset: number;
  pageSize: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextOffset, setNextOffset] = useState(initialNextOffset);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const feedRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(initialHasMore);
  const nextOffsetRef = useRef(initialNextOffset);
  const waitForScrollRef = useRef(false);

  useEffect(() => {
    hasMoreRef.current = hasMore;
    nextOffsetRef.current = nextOffset;
  }, [hasMore, nextOffset]);

  useEffect(() => {
    const feed = feedRef.current;

    if (!feed) {
      return;
    }

    const unlockLoad = () => {
      if (waitForScrollRef.current) {
        waitForScrollRef.current = false;
      }
    };

    feed.addEventListener("wheel", unlockLoad, { passive: true });
    feed.addEventListener("touchmove", unlockLoad, { passive: true });
    window.addEventListener("keydown", unlockLoad);

    return () => {
      feed.removeEventListener("wheel", unlockLoad);
      feed.removeEventListener("touchmove", unlockLoad);
      window.removeEventListener("keydown", unlockLoad);
    };
  }, []);

  async function loadNextPage() {
    if (loadingRef.current || waitForScrollRef.current || !hasMoreRef.current) {
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);

    try {
      const response = await fetch(`/api/content-items?offset=${nextOffsetRef.current}&limit=${pageSize}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load more content items.");
      }

      const page = (await response.json()) as ContentItemPageResponse;

      startTransition(() => {
        setErrorMessage(null);
        setItems((currentItems) => [...currentItems, ...page.items]);
        setHasMore(page.hasMore);
        setNextOffset(page.nextOffset);
      });
      waitForScrollRef.current = true;
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load more content items.");
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const feed = feedRef.current;
    const sentinel = sentinelRef.current;

    if (!feed || !sentinel || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting) {
          return;
        }

        void loadNextPage();
      },
      {
        root: feed,
        rootMargin: "900px 0px",
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, nextOffset, pageSize]);

  return (
    <section className="media-feed-shell">
      <header className="feed-hud">
        <p className="feed-hud-label">Media Detail Split View</p>
        <p className="feed-hud-copy">Scroll to move one title at a time.</p>
      </header>

      <section className="media-detail-feed" aria-label="Content items" ref={feedRef}>
        {items.map((item, index) => (
          <article className="media-detail-row" key={item.id}>
            <div className="media-detail-art">
              <div className="media-detail-art-inner">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.displayTitle}
                  fill
                  sizes="(max-width: 720px) 72vw, 280px"
                  className="cover-image"
                  priority={index < 2}
                />
                ) : (
                  <div className="image-fallback">No image</div>
                )}
              </div>
            </div>

            <div className="media-detail-meta">
              <div className="media-detail-header">
                <p className="media-kicker">Manga</p>
                <p className="media-sequence">{String(index + 1).padStart(2, "0")}</p>
              </div>

              <div className="media-detail-body">
                <h2>{item.displayTitle}</h2>
                <p className="media-description">{formatDescription(item.descriptionShort)}</p>
              </div>

              <dl className="media-detail-facts">
                <div>
                  <dt>Catalog ID</dt>
                  <dd>{item.id}</dd>
                </div>
                <div>
                  <dt>Image</dt>
                  <dd>{item.imageUrl ? "Available" : "Missing"}</dd>
                </div>
                <div>
                  <dt>Feed Mode</dt>
                  <dd>One per scroll</dd>
                </div>
              </dl>

              {item.sourceUrl ? (
                <a className="image-link" href={item.sourceUrl} target="_blank" rel="noreferrer">
                  Open AniList page
                </a>
              ) : (
                <span className="image-link image-link-disabled">No AniList link</span>
              )}
            </div>
          </article>
        ))}

        {errorMessage ? (
          <div className="feed-status feed-status-error">
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {hasMore ? (
          <div className="feed-status" ref={sentinelRef}>
            <p>{isLoading ? "Loading next title..." : "Keep scrolling for the next title..."}</p>
          </div>
        ) : (
          <div className="feed-status">
            <p>You’ve reached the end of the current catalog slice.</p>
          </div>
        )}
      </section>
    </section>
  );
}
