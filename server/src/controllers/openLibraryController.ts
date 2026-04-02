import { NextFunction, Request, Response } from 'express';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

type OpenLibrarySearchPayload = {
  docs?: Array<{
    author_name?: string[];
    cover_i?: number;
    edition_key?: string[];
    first_publish_year?: number;
    key?: string;
    language?: string[];
    number_of_pages_median?: number;
    publisher?: string[];
    subtitle?: string;
    title?: string;
  }>;
  numFound?: number;
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

const parsePage = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(Math.trunc(parsed), 1);
};

const buildCoverUrl = (coverId?: number) =>
  coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg?default=false` : undefined;

const buildSourceUrl = (workKey?: string) =>
  workKey ? `https://openlibrary.org${workKey}` : undefined;

const sanitizeLanguageCode = (value?: string) => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return /^[a-z]{3}$/.test(normalized) ? normalized : undefined;
};

const quoteTerm = (value: string) => JSON.stringify(value.trim());

const normalizeLanguageCodes = (values?: string[]) =>
  (values ?? [])
    .map((value) => value.split('/').filter(Boolean).pop() ?? value)
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, all) => /^[a-z]{3}$/.test(value) && all.indexOf(value) === index);

export const searchOpenLibraryBooks = asyncErrorHandler(async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const author = typeof req.query.author === 'string' ? req.query.author.trim() : '';
  const language = sanitizeLanguageCode(
    typeof req.query.language === 'string' ? req.query.language : undefined
  );

  if (!query && !author) {
    return res.status(400).json({ message: 'A title/keyword query or author is required.' });
  }

  const page = parsePage(req.query.page);
  const limit = parseMaxResults(req.query.maxResults);
  const queryParts = [
    query || null,
    author ? `author:${quoteTerm(author)}` : null,
    language ? `language:${language}` : null,
  ].filter(Boolean);

  const params = new URLSearchParams({
    q: queryParts.join(' AND '),
    limit: String(limit),
    page: String(page),
    fields: [
      'key',
      'title',
      'subtitle',
      'author_name',
      'first_publish_year',
      'language',
      'publisher',
      'cover_i',
      'edition_key',
      'number_of_pages_median',
    ].join(','),
  });

  const contactEmail = process.env.OPEN_LIBRARY_CONTACT_EMAIL?.trim();
  const userAgent = contactEmail
    ? `Enzyklopaedie/1.0 (${contactEmail})`
    : 'Enzyklopaedie/1.0';

  const upstreamResponse = await fetch(`https://openlibrary.org/search.json?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': userAgent,
      ...(contactEmail ? { From: contactEmail } : {}),
    },
  });

  if (!upstreamResponse.ok) {
    return res.status(upstreamResponse.status).json({
      message: 'Open Library search failed.',
    });
  }

  const payload = await upstreamResponse.json() as OpenLibrarySearchPayload;

  const matches = (payload.docs ?? [])
    .map((doc) => {
      return {
        id: doc.key ?? doc.edition_key?.[0] ?? crypto.randomUUID(),
        authors: doc.author_name ?? [],
        coverImageUrl: buildCoverUrl(doc.cover_i),
        languageCodes: normalizeLanguageCodes(doc.language),
        pageCount: doc.number_of_pages_median,
        publishedYear: doc.first_publish_year,
        provider: 'open_library' as const,
        publisher: doc.publisher?.[0],
        sourceUrl: buildSourceUrl(doc.key),
        subtitle: doc.subtitle,
        title: doc.title ?? 'Untitled work',
      };
    })
    .filter((book) => Boolean(book.title));

  const total = typeof payload.numFound === 'number' ? payload.numFound : undefined;
  const hasMore = typeof total === 'number' ? page * limit < total : matches.length === limit;

  res.json({
    hasMore,
    matches,
    nextPage: hasMore ? page + 1 : null,
    page,
    total,
  });
});
