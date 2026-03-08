import { NextResponse } from "next/server";

import {
  CONTENT_ITEM_PAGE_SIZE,
  listContentItemPage,
} from "../../../lib/content-items";

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parsePositiveInteger(searchParams.get("limit"), CONTENT_ITEM_PAGE_SIZE);
  const offset = parsePositiveInteger(searchParams.get("offset"), 0);

  try {
    const page = await listContentItemPage({ limit, offset });
    return NextResponse.json(page);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load content items.";

    return NextResponse.json(
      {
        message,
      },
      { status: 500 },
    );
  }
}
