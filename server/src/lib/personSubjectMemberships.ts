import type {
  NewPersonSubjectMembership,
  PersonSubjectMembership,
  PersonSubjectMembershipDetail,
  ReferenceEntity,
  Subject,
} from '@enzyklopaedie/shared';
import type sqlite3 from 'sqlite3';
import type { Database } from 'sqlite';
import { hydrateReferenceEntity } from './referenceEntities';

type DbConnection = Database<sqlite3.Database, sqlite3.Statement>;

type PersonSubjectMembershipRow = PersonSubjectMembership;

type PersonSubjectMembershipDetailRow = PersonSubjectMembership & {
  personTitle?: string | null;
  personSlug?: string | null;
  subjectName?: string | null;
  subjectSlug?: string | null;
};

type ReferenceEntityRow = Omit<ReferenceEntity, 'metadata'> & {
  metadata?: string | null;
};

type SubjectRow = Subject;

const hydratePersonSubjectMembership = (
  row: PersonSubjectMembershipDetailRow
): PersonSubjectMembershipDetail => ({
  ...row,
  personTitle: row.personTitle ?? undefined,
  personSlug: row.personSlug ?? undefined,
  subjectName: row.subjectName ?? undefined,
  subjectSlug: row.subjectSlug ?? undefined,
});

const detailSelect = `
  SELECT
    psm.*,
    person.title AS personTitle,
    person.slug AS personSlug,
    subject.name AS subjectName,
    subject.slug AS subjectSlug
  FROM person_subject_memberships psm
  JOIN reference_entities person ON person.id = psm.personEntityId
  JOIN topics subject ON subject.id = psm.subjectId
`;

export const listPersonSubjectMembershipsForPerson = async (
  db: DbConnection,
  personEntityId: number
) => {
  const rows = await db.all<PersonSubjectMembershipDetailRow[]>(
    `${detailSelect}
     WHERE psm.personEntityId = ?
     ORDER BY lower(subject.name) ASC, psm.id ASC`,
    personEntityId
  );

  return rows.map(hydratePersonSubjectMembership);
};

export const getReferenceEntityById = async (db: DbConnection, id: number) => {
  const row = await db.get<ReferenceEntityRow>('SELECT * FROM reference_entities WHERE id = ?', id);
  return row ? hydrateReferenceEntity(row) : null;
};

export const getSubjectById = async (db: DbConnection, id: number) =>
  db.get<SubjectRow>('SELECT * FROM topics WHERE id = ?', id);

export const createPersonSubjectMembershipRecord = async (
  db: DbConnection,
  personEntityId: number,
  membership: Omit<NewPersonSubjectMembership, 'personEntityId'>
) => {
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO person_subject_memberships
      (personEntityId, subjectId, note, createdAt)
     VALUES (?, ?, ?, ?)`,
    personEntityId,
    membership.subjectId,
    membership.note?.trim() || null,
    now
  );

  const row = await db.get<PersonSubjectMembershipRow>(
    'SELECT * FROM person_subject_memberships WHERE id = ?',
    result.lastID
  );

  return row ?? null;
};
