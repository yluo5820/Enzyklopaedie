import type {
  FormationMembership,
  FormationMembershipDetail,
  NewFormationMembership,
  ReferenceEntity,
} from '@enzyklopaedie/shared';
import type sqlite3 from 'sqlite3';
import type { Database } from 'sqlite';
import { hydrateReferenceEntity } from './referenceEntities';

type DbConnection = Database<sqlite3.Database, sqlite3.Statement>;

type FormationMembershipRow = FormationMembership;

type FormationMembershipDetailRow = FormationMembership & {
  formationTitle?: string | null;
  formationSlug?: string | null;
  polityTitle?: string | null;
  politySlug?: string | null;
};

type ReferenceEntityRow = Omit<ReferenceEntity, 'metadata'> & {
  metadata?: string | null;
};

const hydrateFormationMembership = (
  row: FormationMembershipDetailRow
): FormationMembershipDetail => ({
  ...row,
  formationTitle: row.formationTitle ?? undefined,
  formationSlug: row.formationSlug ?? undefined,
  polityTitle: row.polityTitle ?? undefined,
  politySlug: row.politySlug ?? undefined,
});

const detailSelect = `
  SELECT
    fm.*,
    formation.title AS formationTitle,
    formation.slug AS formationSlug,
    polity.title AS polityTitle,
    polity.slug AS politySlug
  FROM formation_memberships fm
  JOIN reference_entities formation ON formation.id = fm.formationEntityId
  JOIN reference_entities polity ON polity.id = fm.polityEntityId
`;

export const listFormationMembershipsForFormation = async (
  db: DbConnection,
  formationEntityId: number
) => {
  const rows = await db.all<FormationMembershipDetailRow[]>(
    `${detailSelect}
     WHERE fm.formationEntityId = ?
     ORDER BY COALESCE(fm.startYear, -999999) ASC, lower(polity.title) ASC, fm.id ASC`,
    formationEntityId
  );

  return rows.map(hydrateFormationMembership);
};

export const listFormationMembershipsForPolity = async (
  db: DbConnection,
  polityEntityId: number
) => {
  const rows = await db.all<FormationMembershipDetailRow[]>(
    `${detailSelect}
     WHERE fm.polityEntityId = ?
     ORDER BY COALESCE(fm.startYear, -999999) ASC, lower(formation.title) ASC, fm.id ASC`,
    polityEntityId
  );

  return rows.map(hydrateFormationMembership);
};

export const getReferenceEntityById = async (db: DbConnection, id: number) => {
  const row = await db.get<ReferenceEntityRow>('SELECT * FROM reference_entities WHERE id = ?', id);
  return row ? hydrateReferenceEntity(row) : null;
};

export const createFormationMembershipRecord = async (
  db: DbConnection,
  formationEntityId: number,
  membership: Omit<NewFormationMembership, 'formationEntityId'>
) => {
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO formation_memberships
      (formationEntityId, polityEntityId, startYear, endYear, note, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    formationEntityId,
    membership.polityEntityId,
    membership.startYear ?? null,
    membership.endYear ?? null,
    membership.note?.trim() || null,
    now
  );

  const row = await db.get<FormationMembershipRow>(
    'SELECT * FROM formation_memberships WHERE id = ?',
    result.lastID
  );

  return row ?? null;
};
