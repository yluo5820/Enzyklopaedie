import type {
  NewPersonPolityMembership,
  PersonPolityMembership,
  PersonPolityMembershipDetail,
  ReferenceEntity,
} from '@enzyklopaedie/shared';
import type sqlite3 from 'sqlite3';
import type { Database } from 'sqlite';
import { hydrateReferenceEntity } from './referenceEntities';

type DbConnection = Database<sqlite3.Database, sqlite3.Statement>;

type PersonPolityMembershipRow = PersonPolityMembership;

type PersonPolityMembershipDetailRow = PersonPolityMembership & {
  personTitle?: string | null;
  personSlug?: string | null;
  polityTitle?: string | null;
  politySlug?: string | null;
};

type ReferenceEntityRow = Omit<ReferenceEntity, 'metadata'> & {
  metadata?: string | null;
};

const hydratePersonPolityMembership = (
  row: PersonPolityMembershipDetailRow
): PersonPolityMembershipDetail => ({
  ...row,
  personTitle: row.personTitle ?? undefined,
  personSlug: row.personSlug ?? undefined,
  polityTitle: row.polityTitle ?? undefined,
  politySlug: row.politySlug ?? undefined,
});

const detailSelect = `
  SELECT
    ppm.*,
    person.title AS personTitle,
    person.slug AS personSlug,
    polity.title AS polityTitle,
    polity.slug AS politySlug
  FROM person_polity_memberships ppm
  JOIN reference_entities person ON person.id = ppm.personEntityId
  JOIN reference_entities polity ON polity.id = ppm.polityEntityId
`;

export const listPersonPolityMembershipsForPerson = async (
  db: DbConnection,
  personEntityId: number
) => {
  const rows = await db.all<PersonPolityMembershipDetailRow[]>(
    `${detailSelect}
     WHERE ppm.personEntityId = ?
     ORDER BY COALESCE(ppm.startYear, -999999) ASC, lower(polity.title) ASC, ppm.id ASC`,
    personEntityId
  );

  return rows.map(hydratePersonPolityMembership);
};

export const listPersonPolityMembershipsForPolity = async (
  db: DbConnection,
  polityEntityId: number
) => {
  const rows = await db.all<PersonPolityMembershipDetailRow[]>(
    `${detailSelect}
     WHERE ppm.polityEntityId = ?
     ORDER BY COALESCE(ppm.startYear, -999999) ASC, lower(person.title) ASC, ppm.id ASC`,
    polityEntityId
  );

  return rows.map(hydratePersonPolityMembership);
};

export const getReferenceEntityById = async (db: DbConnection, id: number) => {
  const row = await db.get<ReferenceEntityRow>('SELECT * FROM reference_entities WHERE id = ?', id);
  return row ? hydrateReferenceEntity(row) : null;
};

export const createPersonPolityMembershipRecord = async (
  db: DbConnection,
  personEntityId: number,
  membership: Omit<NewPersonPolityMembership, 'personEntityId'>
) => {
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO person_polity_memberships
      (personEntityId, polityEntityId, startYear, endYear, note, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    personEntityId,
    membership.polityEntityId,
    membership.startYear ?? null,
    membership.endYear ?? null,
    membership.note?.trim() || null,
    now
  );

  const row = await db.get<PersonPolityMembershipRow>(
    'SELECT * FROM person_polity_memberships WHERE id = ?',
    result.lastID
  );

  return row ?? null;
};
