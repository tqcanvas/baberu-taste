import { createHash } from "node:crypto";

import type {
  AniListMedia,
  AniListMediaTitle,
  ContentTitleType,
  MapAniListPageResult,
  MappedAniListRecord,
  MappedTitle,
  ValidationError,
} from "./types.js";

interface TitleCandidate {
  titleType: ContentTitleType;
  title: string;
  normalizedTitle: string;
}

type ExplicitTitleType = keyof AniListMediaTitle;

const EXPLICIT_TITLE_ORDER: ExplicitTitleType[] = ["english", "romaji", "native"];

function cleanText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned : null;
}

function stripHtml(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const withoutTags = value.replace(/<[^>]+>/g, " ");
  return cleanText(withoutTags);
}

export function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function toDate(unixSeconds: number | null): Date | null {
  if (!unixSeconds || unixSeconds <= 0) {
    return null;
  }

  return new Date(unixSeconds * 1000);
}

function buildTitles(media: AniListMedia): { displayTitle: string | null; titles: MappedTitle[] } {
  const explicitCandidates: TitleCandidate[] = [];

  for (const titleType of EXPLICIT_TITLE_ORDER) {
    const rawTitle = cleanText(media.title?.[titleType] ?? null);

    if (!rawTitle) {
      continue;
    }

    explicitCandidates.push({
      titleType,
      title: rawTitle,
      normalizedTitle: normalizeTitle(rawTitle),
    });
  }

  const synonymCandidates: TitleCandidate[] = [];
  const seenSynonyms = new Set<string>();

  for (const synonym of media.synonyms ?? []) {
    const cleanedSynonym = cleanText(synonym);

    if (!cleanedSynonym) {
      continue;
    }

    const normalizedSynonym = normalizeTitle(cleanedSynonym);

    if (seenSynonyms.has(normalizedSynonym)) {
      continue;
    }

    seenSynonyms.add(normalizedSynonym);
    synonymCandidates.push({
      titleType: "synonym",
      title: cleanedSynonym,
      normalizedTitle: normalizedSynonym,
    });
  }

  const primaryCandidate = explicitCandidates[0] ?? synonymCandidates[0] ?? null;

  if (!primaryCandidate) {
    return {
      displayTitle: null,
      titles: [],
    };
  }

  const allCandidates = [...explicitCandidates, ...synonymCandidates];
  let primaryAssigned = false;

  const titles = allCandidates.map((candidate, index) => {
    const isPrimary =
      !primaryAssigned &&
      candidate.titleType === primaryCandidate.titleType &&
      candidate.normalizedTitle === primaryCandidate.normalizedTitle;

    if (isPrimary) {
      primaryAssigned = true;
    }

    return {
      titleType: candidate.titleType,
      title: candidate.title,
      normalizedTitle: candidate.normalizedTitle,
      isPrimary,
      sortOrder: index,
    };
  });

  return {
    displayTitle: primaryCandidate.title,
    titles,
  };
}

function createPayloadHash(media: AniListMedia): string {
  return createHash("sha256").update(JSON.stringify(media)).digest("hex");
}

function buildValidationError(sourceId: string | null, message: string): ValidationError {
  return { sourceId, message };
}

export function mapAniListPage(mediaList: AniListMedia[]): MapAniListPageResult {
  const validationErrors: ValidationError[] = [];
  const records: MappedAniListRecord[] = [];

  for (const media of mediaList) {
    const sourceId =
      typeof media.id === "number" && Number.isInteger(media.id) && media.id > 0
        ? String(media.id)
        : null;

    if (!sourceId) {
      validationErrors.push(buildValidationError(null, "AniList media is missing a valid id"));
      continue;
    }

    const { displayTitle, titles } = buildTitles(media);

    if (!displayTitle) {
      validationErrors.push(
        buildValidationError(sourceId, "AniList media is missing all candidate titles"),
      );
      continue;
    }

    records.push({
      sourceId,
      displayTitle,
      contentItem: {
        mediaType: "manga",
        displayTitle,
        descriptionShort: stripHtml(media.description),
        imageUrl: media.coverImage?.large ?? null,
        bannerImageUrl: media.bannerImage ?? null,
        averageScore: media.averageScore ?? null,
        popularity: media.popularity ?? null,
        favourites: media.favourites ?? null,
        status: media.status ?? null,
        format: media.format ?? null,
        countryOfOrigin: media.countryOfOrigin ?? null,
        isAdult: media.isAdult ?? false,
        startYear: media.startDate?.year ?? null,
        startMonth: media.startDate?.month ?? null,
        startDay: media.startDate?.day ?? null,
        endYear: media.endDate?.year ?? null,
        endMonth: media.endDate?.month ?? null,
        endDay: media.endDate?.day ?? null,
      },
      mangaDetails: {
        chapters: media.chapters ?? null,
        volumes: media.volumes ?? null,
        sourceMaterial: media.source ?? null,
      },
      titles,
      source: {
        sourceName: "anilist",
        sourceEntityType: "media",
        sourceId,
        sourceUrl: media.siteUrl ?? null,
        sourceUpdatedAt: toDate(media.updatedAt ?? null),
      },
      rawPayload: media,
      payloadHash: createPayloadHash(media),
    });
  }

  return {
    records,
    validationErrors,
  };
}
