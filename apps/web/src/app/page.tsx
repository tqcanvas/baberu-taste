import Image from "next/image";

import { listContentItems, type ContentItemCard } from "../lib/content-items";

export const dynamic = "force-dynamic";

function formatDescription(description: string | null): string {
  if (!description) {
    return "No short description is available for this item yet.";
  }

  return description.length > 240 ? `${description.slice(0, 237).trimEnd()}...` : description;
}

export default async function HomePage() {
  let contentItems: ContentItemCard[] = [];
  let errorMessage: string | null = null;

  try {
    contentItems = await listContentItems();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Failed to load content items.";
  }

  return (
    <main className="page-shell">
      <section className="hero">
        <p className="eyebrow">Catalog Browser</p>
        <h1>Scroll through manga already loaded into the catalog.</h1>
        <p className="hero-copy">
          This first slice reads directly from Postgres and uses Next.js image optimization for
          remote covers.
        </p>
      </section>

      {errorMessage ? (
        <section className="state-panel">
          <h2>Content unavailable</h2>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {!errorMessage && contentItems.length === 0 ? (
        <section className="state-panel">
          <h2>No content items found</h2>
          <p>Run the manga catalog sync first, then reload this page.</p>
        </section>
      ) : null}

      {!errorMessage && contentItems.length > 0 ? (
        <section className="content-grid" aria-label="Content items">
          {contentItems.map((item) => (
            <article className="content-card" key={item.id}>
              <div className="image-frame">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.displayTitle}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="cover-image"
                  />
                ) : (
                  <div className="image-fallback">No image</div>
                )}
              </div>

              <div className="card-copy">
                <h2>{item.displayTitle}</h2>
                <p>{formatDescription(item.descriptionShort)}</p>
              </div>

              {item.imageUrl ? (
                <a className="image-link" href={item.imageUrl} target="_blank" rel="noreferrer">
                  Open source image
                </a>
              ) : (
                <span className="image-link image-link-disabled">No image link</span>
              )}
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
