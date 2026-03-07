import type {
  AniListMedia,
  AniListMediaPage,
  AniListPageResponse,
} from "../ingestion/anilist/types.js";

const ANILIST_CATALOG_PAGE_QUERY = `
  query AniListMangaPage($page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
        lastPage
        perPage
        total
      }
      media(type: MANGA, sort: ID) {
        id
        siteUrl
        updatedAt
        title {
          romaji
          english
          native
        }
        synonyms
        description
        coverImage {
          large
        }
        bannerImage
        averageScore
        popularity
        favourites
        status
        format
        countryOfOrigin
        isAdult
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        chapters
        volumes
        source
      }
    }
  }
`;

const ANILIST_UPDATED_PAGE_QUERY = `
  query AniListMangaUpdatesPage($page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        currentPage
        hasNextPage
        lastPage
        perPage
        total
      }
      media(type: MANGA, sort: [UPDATED_AT_DESC, ID_DESC]) {
        id
        siteUrl
        updatedAt
        title {
          romaji
          english
          native
        }
        synonyms
        description
        coverImage {
          large
        }
        bannerImage
        averageScore
        popularity
        favourites
        status
        format
        countryOfOrigin
        isAdult
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        chapters
        volumes
        source
      }
    }
  }
`;

function formatGraphQLErrors(errors: NonNullable<AniListPageResponse["errors"]>): string {
  return errors.map((error) => error.message).join("; ");
}

async function executeAniListPageQuery(
  apiUrl: string,
  page: number,
  perPage: number,
  query: string,
): Promise<AniListMediaPage> {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      query,
      variables: { page, perPage },
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `AniList request failed with status ${response.status}: ${responseText.slice(0, 400)}`,
    );
  }

  let payload: AniListPageResponse;

  try {
    payload = JSON.parse(responseText) as AniListPageResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`AniList response was not valid JSON: ${message}`);
  }

  if (payload.errors?.length) {
    throw new Error(`AniList GraphQL error: ${formatGraphQLErrors(payload.errors)}`);
  }

  return {
    media: payload.data?.Page?.media ?? [],
    pageInfo: payload.data?.Page?.pageInfo ?? null,
  };
}

export async function fetchAniListMangaPage(
  apiUrl: string,
  page: number,
  perPage: number,
): Promise<AniListMedia[]> {
  const result = await executeAniListPageQuery(apiUrl, page, perPage, ANILIST_CATALOG_PAGE_QUERY);
  return result.media;
}

export async function fetchAniListMangaCatalogPage(
  apiUrl: string,
  page: number,
  perPage: number,
): Promise<AniListMediaPage> {
  return executeAniListPageQuery(apiUrl, page, perPage, ANILIST_CATALOG_PAGE_QUERY);
}

export async function fetchAniListUpdatedMangaPage(
  apiUrl: string,
  page: number,
  perPage: number,
): Promise<AniListMedia[]> {
  const result = await executeAniListPageQuery(apiUrl, page, perPage, ANILIST_UPDATED_PAGE_QUERY);
  return result.media;
}
