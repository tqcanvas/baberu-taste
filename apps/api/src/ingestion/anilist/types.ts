export interface AniListMediaTitle {
  romaji: string | null;
  english: string | null;
  native: string | null;
}

export interface AniListMediaDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AniListMediaCoverImage {
  large: string | null;
}

export interface AniListMedia {
  id: number;
  siteUrl: string | null;
  updatedAt: number | null;
  title: AniListMediaTitle | null;
  synonyms: Array<string | null> | null;
  description: string | null;
  coverImage: AniListMediaCoverImage | null;
  bannerImage: string | null;
  averageScore: number | null;
  popularity: number | null;
  favourites: number | null;
  status: string | null;
  format: string | null;
  countryOfOrigin: string | null;
  isAdult: boolean | null;
  startDate: AniListMediaDate | null;
  endDate: AniListMediaDate | null;
  chapters: number | null;
  volumes: number | null;
  source: string | null;
}

export interface AniListPageData {
  Page: {
    pageInfo: AniListPageInfo | null;
    media: AniListMedia[] | null;
  } | null;
}

export interface AniListPageInfo {
  currentPage: number | null;
  hasNextPage: boolean | null;
  lastPage: number | null;
  perPage: number | null;
  total: number | null;
}

export interface AniListGraphQLError {
  message: string;
}

export interface AniListPageResponse {
  data?: AniListPageData;
  errors?: AniListGraphQLError[];
}

export type ContentTitleType = "romaji" | "english" | "native" | "synonym";

export interface MappedContentItem {
  mediaType: "manga";
  displayTitle: string;
  descriptionShort: string | null;
  imageUrl: string | null;
  bannerImageUrl: string | null;
  averageScore: number | null;
  popularity: number | null;
  favourites: number | null;
  status: string | null;
  format: string | null;
  countryOfOrigin: string | null;
  isAdult: boolean;
  startYear: number | null;
  startMonth: number | null;
  startDay: number | null;
  endYear: number | null;
  endMonth: number | null;
  endDay: number | null;
}

export interface MappedMangaDetails {
  chapters: number | null;
  volumes: number | null;
  sourceMaterial: string | null;
}

export interface MappedTitle {
  titleType: ContentTitleType;
  title: string;
  normalizedTitle: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface MappedSource {
  sourceName: "anilist";
  sourceEntityType: "media";
  sourceId: string;
  sourceUrl: string | null;
  sourceUpdatedAt: Date | null;
}

export interface MappedAniListRecord {
  sourceId: string;
  displayTitle: string;
  contentItem: MappedContentItem;
  mangaDetails: MappedMangaDetails;
  titles: MappedTitle[];
  source: MappedSource;
  rawPayload: AniListMedia;
  payloadHash: string;
}

export interface ValidationError {
  sourceId: string | null;
  message: string;
}

export interface MapAniListPageResult {
  records: MappedAniListRecord[];
  validationErrors: ValidationError[];
}

export interface PersistPageResult {
  insertedCount: number;
  updatedCount: number;
  titleRowsWritten: number;
}

export interface SyncBoundary {
  lastUpdatedAt: number;
  lastSourceId: number;
}

export type AniListSyncStopReason = "boundary" | "exhausted" | "max-pages";

export interface SyncAniListMangaResult extends PersistPageResult {
  fetchedCount: number;
  processedCount: number;
  pageCount: number;
  stopReason: AniListSyncStopReason;
  boundaryBefore: SyncBoundary;
  boundaryAfter: SyncBoundary;
  boundarySaved: boolean;
}

export type CatalogSyncStatus = "idle" | "running" | "failed" | "completed";

export interface AniListMediaPage {
  media: AniListMedia[];
  pageInfo: AniListPageInfo | null;
}

export interface CatalogSyncCheckpoint {
  nextPage: number;
  perPage: number;
  lastProcessedSourceId: number | null;
  totalPagesProcessed: number;
  totalRecordsProcessed: number;
  status: CatalogSyncStatus;
  failureCount: number;
  lastError: string | null;
}

export interface SyncAniListMangaCatalogResult extends PersistPageResult {
  fetchedCount: number;
  pageCount: number;
  startPage: number;
  endPage: number;
  checkpoint: CatalogSyncCheckpoint;
  stopReason: "completed" | "max-pages";
}
