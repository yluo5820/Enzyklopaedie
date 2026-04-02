import { NextFunction, Request, Response } from 'express';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

type LibraryOfCongressPayload = {
  pagination?: {
    next?: string | null;
    of?: number;
  };
  results?: Array<{
    contributor?: string[];
    date?: string;
    description?: string | string[];
    id?: string;
    image_url?: string[];
    item?: {
      contributor_names?: string[];
      created_published?: string[];
      notes?: string[];
      title?: string;
    };
    language?: string[];
    title?: string;
    url?: string;
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

const parsePage = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(Math.trunc(parsed), 1);
};

const sanitizeLanguageCode = (value?: string) => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return /^[a-z]{3}$/.test(normalized) ? normalized : undefined;
};

const locLanguageFacetByCode: Record<string, string> = {
  ara: 'language:arabic',
  chi: 'language:chinese',
  eng: 'language:english',
  fre: 'language:french',
  ger: 'language:german',
  grc: 'language:greek, ancient',
  ita: 'language:italian',
  jpn: 'language:japanese',
  lat: 'language:latin',
  rus: 'language:russian',
  spa: 'language:spanish',
};

const buildLocFacets = (author?: string, language?: string) => {
  const facets: string[] = [];

  if (author) {
    facets.push(`contributor:${author.toLowerCase()}`);
  }

  const languageFacet = language ? locLanguageFacetByCode[language] : undefined;
  if (languageFacet) {
    facets.push(languageFacet);
  }

  return facets;
};

const fetchLocPayload = async (params: URLSearchParams) => {
  const upstreamResponse = await fetch(`https://www.loc.gov/books/?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Enzyklopaedie/1.0',
    },
  });

  if (!upstreamResponse.ok) {
    return {
      ok: false as const,
      status: upstreamResponse.status,
      payload: null,
    };
  }

  return {
    ok: true as const,
    payload: await upstreamResponse.json() as LibraryOfCongressPayload,
    status: upstreamResponse.status,
  };
};

const normalizeLanguageCodes = (values?: string[]) =>
  (values ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter((value, index, all) => /^[a-z]{3}$/.test(value) && all.indexOf(value) === index);

const normalizeImageUrl = (value?: string) => {
  if (!value) return undefined;
  if (value.startsWith('//')) return `https:${value}`;
  return value;
};

const firstText = (value?: string | string[]) => {
  if (Array.isArray(value)) return value.find(Boolean);
  return value;
};

const parseYear = (...values: Array<string | undefined>) => {
  for (const value of values) {
    const match = value?.match(/-?\d{4}/);
    if (match) return Number(match[0]);
  }
  return undefined;
};

export const searchLibraryOfCongressBooks = asyncErrorHandler(async (req: Request, res: Response) => {
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
  const buildBaseParams = () =>
    new URLSearchParams({
      fo: 'json',
      c: String(limit),
      sp: String(page),
    });

  const primaryParams = buildBaseParams();
  if (query) {
    primaryParams.set('q', query);
    const facets = buildLocFacets(author, language);
    if (facets.length > 0) {
      primaryParams.set('fa', facets.join('|'));
    }
  } else if (author) {
    primaryParams.set('q', author);
    const facets = buildLocFacets(undefined, language);
    if (facets.length > 0) {
      primaryParams.set('fa', facets.join('|'));
    }
  }

  let upstreamResult = await fetchLocPayload(primaryParams);

  if (!upstreamResult.ok) {
    return res.status(upstreamResult.status).json({
      message: 'Library of Congress search failed.',
    });
  }

  let payload = upstreamResult.payload;

  if (query && author && (payload.results?.length ?? 0) === 0) {
    const fallbackParams = buildBaseParams();
    fallbackParams.set('q', `${query} ${author}`.trim());
    const fallbackFacets = buildLocFacets(undefined, language);
    if (fallbackFacets.length > 0) {
      fallbackParams.set('fa', fallbackFacets.join('|'));
    }

    const fallbackResult = await fetchLocPayload(fallbackParams);
    if (fallbackResult.ok) {
      payload = fallbackResult.payload;
    }
  }

  const matches = (payload.results ?? [])
    .map((result) => {
      const item = result.item ?? {};
      return {
        id: result.id ?? result.url ?? crypto.randomUUID(),
        authors: result.contributor ?? item.contributor_names ?? [],
        coverImageUrl: normalizeImageUrl(result.image_url?.[0]),
        description: firstText(result.description) ?? firstText(item.notes),
        languageCodes: normalizeLanguageCodes(result.language),
        pageCount: undefined,
        publishedYear: parseYear(result.date, firstText(item.created_published)),
        provider: 'library_of_congress' as const,
        publisher: undefined,
        sourceUrl: result.url,
        subtitle: undefined,
        title: result.title ?? item.title ?? 'Untitled work',
      };
    })
    .filter((book) => Boolean(book.title));

  const total = typeof payload.pagination?.of === 'number' ? payload.pagination.of : undefined;
  const hasMore =
    typeof payload.pagination?.next === 'string'
      ? true
      : typeof total === 'number'
        ? page * limit < total
        : matches.length === limit;

  res.json({
    hasMore,
    matches,
    nextPage: hasMore ? page + 1 : null,
    page,
    total,
  });
});
