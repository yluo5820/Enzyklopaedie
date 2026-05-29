import type {
  CanonicalHistoricalEntityKind,
  CanonicalHistoricalSearchMatch,
  FormationSubtype,
  ReferenceEntityKind,
} from '@enzyklopaedie/shared';

export type WikidataAuthoritySearchKind = CanonicalHistoricalEntityKind | 'all';

type WikidataSearchPayload = {
  search?: Array<{
    concepturi?: string;
    description?: string;
    id?: string;
    label?: string;
  }>;
};

type WikidataClaim = {
  mainsnak?: {
    datavalue?: {
      value?: any;
    };
  };
};

type WikidataEntityPayload = {
  entities?: Record<
    string,
    {
      claims?: Record<string, WikidataClaim[]>;
      descriptions?: Record<string, { value?: string }>;
      id: string;
      labels?: Record<string, { value?: string }>;
      sitelinks?: Record<string, { title?: string; url?: string }>;
    }
  >;
};

type WikipediaSummaryPayload = {
  content_urls?: {
    desktop?: {
      page?: string;
    };
  };
  extract?: string;
  thumbnail?: {
    source?: string;
  };
};

type WikipediaSummary = {
  extract?: string;
  pageUrl?: string;
  thumbnailUrl?: string;
};

export const canonicalKinds = [
  'person',
  'ruler',
  'battle',
  'nation',
  'civilization',
  'era',
  'place',
  'region',
] as const satisfies CanonicalHistoricalEntityKind[];

export const localEntityKindMap: Partial<Record<CanonicalHistoricalEntityKind, ReferenceEntityKind>> = {
  civilization: 'formation',
  era: 'formation',
  nation: 'polity',
  person: 'person',
  place: 'polity',
  region: 'polity',
  ruler: 'person',
};

export const localFormationSubtypeMap: Partial<Record<CanonicalHistoricalEntityKind, FormationSubtype>> = {
  civilization: 'civilization',
  era: 'era',
};

const wikimediaHeaders = {
  Accept: 'application/json',
  'User-Agent': 'Enzyklopaedie/1.0',
};

export const isCanonicalHistoricalEntityKind = (
  value: unknown
): value is CanonicalHistoricalEntityKind =>
  typeof value === 'string' && canonicalKinds.includes(value as CanonicalHistoricalEntityKind);

const getClaimValues = (
  claims: Record<string, WikidataClaim[]> | undefined,
  property: string
) => (claims?.[property] ?? []).map((claim) => claim.mainsnak?.datavalue?.value).filter(Boolean);

const getEntityIds = (
  claims: Record<string, WikidataClaim[]> | undefined,
  property: string
) =>
  getClaimValues(claims, property)
    .map((value) => value?.id)
    .filter((value): value is string => typeof value === 'string');

const getCoordinate = (claims: Record<string, WikidataClaim[]> | undefined) => {
  const coordinate = getClaimValues(claims, 'P625')[0];
  if (
    coordinate &&
    typeof coordinate.latitude === 'number' &&
    typeof coordinate.longitude === 'number'
  ) {
    return {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };
  }

  return undefined;
};

const parseTimeYear = (value: unknown) => {
  if (!value || typeof value !== 'object' || typeof (value as { time?: unknown }).time !== 'string') {
    return undefined;
  }

  const raw = (value as { time: string }).time;
  const match = raw.match(/^([+-]\d{4,})/);
  if (!match) return undefined;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getFirstYear = (
  claims: Record<string, WikidataClaim[]> | undefined,
  properties: string[]
) => {
  for (const property of properties) {
    for (const value of getClaimValues(claims, property)) {
      const year = parseTimeYear(value);
      if (year !== undefined) {
        return year;
      }
    }
  }

  return undefined;
};

const buildCommonsImageUrl = (filename?: string) => {
  if (!filename) return undefined;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=480`;
};

const normalizeText = (value?: string) => value?.trim().toLowerCase() ?? '';

const mediaInstanceIds = new Set([
  'Q11424', // film
  'Q386724', // work
  'Q5398426', // television series
  'Q7725634', // literary work
  'Q7889', // video game
  'Q21191270', // television series episode
]);

const polityInstanceIds = new Set([
  'Q6256', // country
  'Q7275', // state
  'Q48349', // empire
  'Q3024240', // historical country
  'Q3624078', // sovereign state
  'Q417175', // kingdom
  'Q66724388', // historical state
]);

const detectKind = (
  requestedKind: WikidataAuthoritySearchKind,
  title: string,
  description: string,
  claims?: Record<string, WikidataClaim[]>
): CanonicalHistoricalEntityKind | null => {
  const titleText = normalizeText(title);
  const descriptionText = normalizeText(description);
  const instanceOfIds = getEntityIds(claims, 'P31');
  const isLikelyMedia =
    instanceOfIds.some((id) => mediaInstanceIds.has(id)) ||
    /\b(tv|television|film|movie|series|drama series|novel|book|album|song|video game|podcast)\b/.test(descriptionText);
  const isAboutnessPage =
    /^(history of|outline of|timeline of|list of)\b/.test(titleText) ||
    /\b(occurrences and people|history of|outline of|timeline of|list of)\b/.test(descriptionText);
  if (isLikelyMedia || isAboutnessPage) {
    return null;
  }

  if (requestedKind !== 'all') {
    return requestedKind;
  }

  const isHuman = instanceOfIds.includes('Q5');

  if (isHuman) {
    if (/\b(king|queen|emperor|empress|monarch|ruler|pharaoh|caliph|sultan|shah|tsar)\b/.test(descriptionText)) {
      return 'ruler';
    }
    return 'person';
  }

  if (instanceOfIds.includes('Q178561') || descriptionText.includes('battle')) {
    return 'battle';
  }

  if (
    instanceOfIds.some((id) => polityInstanceIds.has(id)) ||
    /\b(country|state|empire|kingdom|republic|nation|dynasty|polity|caliphate|sultanate|duchy|commonwealth)\b/.test(descriptionText)
  ) {
    return 'nation';
  }

  if (descriptionText.includes('civilization')) {
    return 'civilization';
  }

  if (/\b(era|historical period|period of history|age)\b/.test(descriptionText)) {
    return 'era';
  }

  if (/\b(region|province|territory|county|prefecture)\b/.test(descriptionText)) {
    return 'region';
  }

  if (getCoordinate(claims) && /\b(city|town|settlement|capital|archaeological site|site|place)\b/.test(descriptionText)) {
    return 'place';
  }

  return null;
};

const scoreMatch = (
  requestedKind: WikidataAuthoritySearchKind,
  query: string,
  title: string,
  description: string,
  detectedKind: CanonicalHistoricalEntityKind,
  claims?: Record<string, WikidataClaim[]>
) => {
  const normalizedQuery = normalizeText(query);
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeText(description);
  let score = 0;

  if (normalizedTitle === normalizedQuery) score += 80;
  else if (normalizedTitle.startsWith(normalizedQuery)) score += 50;
  else if (normalizedTitle.includes(normalizedQuery)) score += 25;

  if (requestedKind !== 'all' && detectedKind === requestedKind) {
    score += 40;
  }

  if (requestedKind === 'person' && getEntityIds(claims, 'P31').includes('Q5')) {
    score += 15;
  }

  if (requestedKind === 'battle' && normalizedDescription.includes('battle')) {
    score += 15;
  }

  if (normalizedDescription.includes(normalizedQuery)) {
    score += 10;
  }

  return score;
};

const buildSearchQuery = (query: string, kind: WikidataAuthoritySearchKind) => {
  const trimmed = query.trim();
  if (kind === 'all') {
    return trimmed;
  }

  if (kind === 'battle') {
    return `${trimmed} battle`;
  }

  if (kind === 'ruler') {
    return `${trimmed} ruler`;
  }

  if (kind === 'era') {
    return `${trimmed} historical period`;
  }

  if (kind === 'civilization') {
    return `${trimmed} civilization`;
  }

  if (kind === 'nation') {
    return `${trimmed} state`;
  }

  if (kind === 'region') {
    return `${trimmed} region`;
  }

  return trimmed;
};

const getStringClaim = (
  claims: Record<string, WikidataClaim[]> | undefined,
  property: string
) => {
  const value = getClaimValues(claims, property)[0];
  return typeof value === 'string' ? value : undefined;
};

const getEnglishWikipediaTitle = (
  sitelinks: Record<string, { title?: string; url?: string }> | undefined
) => {
  const title = sitelinks?.enwiki?.title;
  return typeof title === 'string' && title.trim() ? title.trim() : undefined;
};

const buildEnglishWikipediaUrl = (title: string) =>
  `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;

const fetchWikipediaSummary = async (title: string): Promise<WikipediaSummary | undefined> => {
  const response = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    { headers: wikimediaHeaders }
  );

  if (!response.ok) {
    return undefined;
  }

  const payload = (await response.json()) as WikipediaSummaryPayload;
  return {
    extract: typeof payload.extract === 'string' ? payload.extract : undefined,
    pageUrl:
      typeof payload.content_urls?.desktop?.page === 'string'
        ? payload.content_urls.desktop.page
        : buildEnglishWikipediaUrl(title),
    thumbnailUrl:
      typeof payload.thumbnail?.source === 'string' ? payload.thumbnail.source : undefined,
  };
};

export const searchWikidataCanonicalEntities = async ({
  includeWikipediaSummary = false,
  kind,
  limit,
  query,
}: {
  includeWikipediaSummary?: boolean;
  kind: WikidataAuthoritySearchKind;
  limit: number;
  query: string;
}): Promise<CanonicalHistoricalSearchMatch[]> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const searchParams = new URLSearchParams({
    action: 'wbsearchentities',
    format: 'json',
    language: 'en',
    type: 'item',
    limit: String(limit),
    search: buildSearchQuery(trimmedQuery, kind),
  });

  const searchResponse = await fetch(`https://www.wikidata.org/w/api.php?${searchParams.toString()}`, {
    headers: wikimediaHeaders,
  });

  if (!searchResponse.ok) {
    const error = new Error('Wikidata search failed.');
    (error as Error & { status?: number }).status = searchResponse.status;
    throw error;
  }

  const searchPayload = (await searchResponse.json()) as WikidataSearchPayload;
  const searchResults = searchPayload.search ?? [];
  const ids = searchResults
    .map((result) => result.id)
    .filter((value): value is string => typeof value === 'string');

  if (ids.length === 0) {
    return [];
  }

  const entityParams = new URLSearchParams({
    action: 'wbgetentities',
    format: 'json',
    languages: 'en',
    ids: ids.join('|'),
    props: 'labels|descriptions|claims|sitelinks',
  });

  const entityResponse = await fetch(`https://www.wikidata.org/w/api.php?${entityParams.toString()}`, {
    headers: wikimediaHeaders,
  });

  if (!entityResponse.ok) {
    const error = new Error('Wikidata entity lookup failed.');
    (error as Error & { status?: number }).status = entityResponse.status;
    throw error;
  }

  const entityPayload = (await entityResponse.json()) as WikidataEntityPayload;
  const wikipediaSummaries = new Map<string, WikipediaSummary | undefined>();

  if (includeWikipediaSummary) {
    await Promise.all(
      ids.map(async (id) => {
        const title = getEnglishWikipediaTitle(entityPayload.entities?.[id]?.sitelinks);
        if (!title) {
          wikipediaSummaries.set(id, undefined);
          return;
        }

        try {
          wikipediaSummaries.set(id, await fetchWikipediaSummary(title));
        } catch {
          wikipediaSummaries.set(id, undefined);
        }
      })
    );
  }

  return searchResults
    .map((result) => {
      if (!result.id) return null;

      const entity = entityPayload.entities?.[result.id];
      const claims = entity?.claims;
      const title = entity?.labels?.en?.value ?? result.label ?? result.id;
      const wikidataDescription = entity?.descriptions?.en?.value ?? result.description ?? undefined;
      const coordinates = getCoordinate(claims);
      const detectedKind = detectKind(kind, title, wikidataDescription ?? '', claims);
      if (!detectedKind) {
        return null;
      }
      const imageFilename = getStringClaim(claims, 'P18');
      const geoshapeTitle = getStringClaim(claims, 'P3896');
      const wikipediaTitle = getEnglishWikipediaTitle(entity?.sitelinks);
      const wikipediaSummary = wikipediaSummaries.get(result.id);
      const wikipediaUrl = wikipediaSummary?.pageUrl ??
        (wikipediaTitle ? buildEnglishWikipediaUrl(wikipediaTitle) : undefined);

      const match: CanonicalHistoricalSearchMatch & { score: number } = {
        authority: 'wikidata',
        authorityId: result.id,
        kind: detectedKind,
        title,
        summary: wikidataDescription,
        description: wikipediaSummary?.extract ?? wikidataDescription,
        startYear: getFirstYear(claims, ['P580', 'P571', 'P569', 'P585']),
        endYear: getFirstYear(claims, ['P582', 'P576', 'P570']),
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        imageUrl:
          (typeof imageFilename === 'string' ? buildCommonsImageUrl(imageFilename) : undefined) ??
          wikipediaSummary?.thumbnailUrl,
        sourceUrl: result.concepturi || `https://www.wikidata.org/wiki/${result.id}`,
        metadata: {
          description: wikidataDescription,
          geoshapeTitle,
          hasGeoshape: Boolean(geoshapeTitle),
          wikidataDescription,
          wikidataId: result.id,
          wikipediaTitle,
          wikipediaUrl,
        },
        score: scoreMatch(kind, trimmedQuery, title, wikidataDescription ?? '', detectedKind, claims),
      };

      return match;
    })
    .filter((match): match is CanonicalHistoricalSearchMatch & { score: number } => Boolean(match))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit)
    .map(({ score: _score, ...match }) => match);
};
