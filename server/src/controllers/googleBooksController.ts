import { NextFunction, Request, Response } from 'express';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

type GoogleBooksVolumePayload = {
  items?: Array<{
    id?: string;
    volumeInfo?: {
      authors?: string[];
      description?: string;
      imageLinks?: {
        smallThumbnail?: string;
        thumbnail?: string;
      };
      infoLink?: string;
      pageCount?: number;
      publishedDate?: string;
      publisher?: string;
      subtitle?: string;
      title?: string;
    };
  }>;
};

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseMaxResults = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 10;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 20);
};

export const searchGoogleBooks = asyncErrorHandler(async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query) {
    return res.status(400).json({ message: 'A search query is required.' });
  }

  const params = new URLSearchParams({
    q: query,
    maxResults: String(parseMaxResults(req.query.maxResults)),
  });

  const apiKey = process.env.GOOGLE_BOOKS_API_KEY || process.env.VITE_GOOGLE_BOOKS_API_KEY;
  if (apiKey) {
    params.set('key', apiKey);
  }

  const upstreamResponse = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`);

  if (!upstreamResponse.ok) {
    const errorPayload = await upstreamResponse.json().catch(() => null) as
      | { error?: { message?: string } }
      | null;

    return res.status(upstreamResponse.status).json({
      message: errorPayload?.error?.message || 'Google Books search failed.',
    });
  }

  const payload = await upstreamResponse.json() as GoogleBooksVolumePayload;

  const matches = (payload.items ?? [])
    .map((item) => {
      const volumeInfo = item.volumeInfo ?? {};
      const publishedYearMatch =
        typeof volumeInfo.publishedDate === 'string'
          ? volumeInfo.publishedDate.match(/^-?\d{4}/)
          : null;

      return {
        id: item.id ?? crypto.randomUUID(),
        authors: volumeInfo.authors ?? [],
        coverImageUrl: volumeInfo.imageLinks?.thumbnail ?? volumeInfo.imageLinks?.smallThumbnail,
        description: volumeInfo.description,
        pageCount: volumeInfo.pageCount,
        publishedYear: publishedYearMatch ? Number(publishedYearMatch[0]) : undefined,
        publisher: volumeInfo.publisher,
        sourceUrl: volumeInfo.infoLink,
        subtitle: volumeInfo.subtitle,
        title: volumeInfo.title ?? 'Untitled volume',
      };
    })
    .filter((book) => Boolean(book.title));

  res.json(matches);
});
