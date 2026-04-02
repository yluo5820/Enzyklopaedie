import { slugifyTopicName, type KnowledgeItem, type StudyTopic, type StudyTopicSummary } from '@enzyklopaedie/shared';
import type sqlite3 from 'sqlite3';
import type { Database } from 'sqlite';

type DbConnection = Database<sqlite3.Database, sqlite3.Statement>;

const getDbConnection = async () => {
  return import('../db').then(({ getDb }) => getDb());
};

const studyTopicSummarySelect = `
  SELECT
    st.*,
    s.name AS subjectName,
    s.slug AS subjectSlug,
    COALESCE(item_counts.itemCount, 0) AS itemCount,
    COALESCE(child_counts.childTopicCount, 0) AS childTopicCount
  FROM study_topics st
  INNER JOIN topics s ON s.id = st.subjectId
  LEFT JOIN (
    SELECT studyTopicId, COUNT(*) AS itemCount
    FROM knowledge_item_study_topics
    GROUP BY studyTopicId
  ) item_counts ON item_counts.studyTopicId = st.id
  LEFT JOIN (
    SELECT parentTopicId, COUNT(*) AS childTopicCount
    FROM study_topics
    WHERE parentTopicId IS NOT NULL
    GROUP BY parentTopicId
  ) child_counts ON child_counts.parentTopicId = st.id
`;

export const listStudyTopics = async (subjectId?: number) => {
  const db = await getDbConnection();
  return subjectId
    ? db.all<StudyTopicSummary[]>(
        `${studyTopicSummarySelect}
         WHERE st.subjectId = ?
         ORDER BY COALESCE(st.parentTopicId, 0) ASC, lower(st.name) ASC, st.createdAt ASC`,
        subjectId
      )
    : db.all<StudyTopicSummary[]>(
        `${studyTopicSummarySelect}
         ORDER BY lower(s.name) ASC, COALESCE(st.parentTopicId, 0) ASC, lower(st.name) ASC, st.createdAt ASC`
      );
};

export const getStudyTopicById = async (studyTopicId: number) => {
  const db = await getDbConnection();
  return db.get<StudyTopicSummary>(
    `${studyTopicSummarySelect}
     WHERE st.id = ?`,
    studyTopicId
  );
};

export const listKnowledgeItemsForStudyTopic = async (studyTopicId: number) => {
  const db = await getDbConnection();
  return db.all<KnowledgeItem[]>(
    `SELECT ki.*
     FROM knowledge_item_study_topics kist
     INNER JOIN knowledge_items ki ON ki.id = kist.knowledgeItemId
     WHERE kist.studyTopicId = ?
     ORDER BY ki.updatedAt DESC`,
    studyTopicId
  );
};

export const listStudyTopicsByKnowledgeItem = async (knowledgeItemId: number) => {
  const db = await getDbConnection();
  return db.all<StudyTopicSummary[]>(
    `${studyTopicSummarySelect}
     INNER JOIN knowledge_item_study_topics kist ON kist.studyTopicId = st.id
     WHERE kist.knowledgeItemId = ?
     ORDER BY lower(s.name) ASC, COALESCE(st.parentTopicId, 0) ASC, lower(st.name) ASC, st.createdAt ASC`,
    knowledgeItemId
  );
};

export const generateUniqueStudyTopicSlug = async (
  db: DbConnection,
  name: string,
  subjectSlug?: string
) => {
  const baseName = slugifyTopicName(name) || 'topic';
  const baseSlug = subjectSlug ? `${subjectSlug}-${baseName}` : baseName;
  let slug = baseSlug;
  let suffix = 2;

  while (await db.get('SELECT id FROM study_topics WHERE slug = ?', slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

const ensureCanonicalStudyTopicForSubject = async (
  db: DbConnection,
  subject: { id: number; name: string; slug: string }
) => {
  const existing = await db.get<StudyTopic>(
    'SELECT * FROM study_topics WHERE subjectId = ? AND parentTopicId IS NULL ORDER BY id ASC LIMIT 1',
    subject.id
  );

  if (existing) {
    return existing.id;
  }

  const now = new Date().toISOString();
  const name = `General ${subject.name}`;
  const slug = await generateUniqueStudyTopicSlug(db, name, subject.slug);
  const result = await db.run(
    `INSERT INTO study_topics
      (subjectId, name, slug, summary, description, parentTopicId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    subject.id,
    name,
    slug,
    'Auto-created default topic for migrated subject-level item assignments.',
    null,
    null,
    now,
    now
  );

  return result.lastID as number;
};

export const syncLegacyStudyTopics = async (db: DbConnection) => {
  const legacyAssignments = await db.all<
    Array<{
      knowledgeItemId: number;
      subjectId: number;
      subjectName: string;
      subjectSlug: string;
      sortOrder?: number | null;
    }>
  >(
    `SELECT
        kit.knowledgeItemId,
        kit.sortOrder,
        s.id AS subjectId,
        s.name AS subjectName,
        s.slug AS subjectSlug
      FROM knowledge_item_topics kit
      INNER JOIN topics s ON s.id = kit.topicId`
  );

  for (const assignment of legacyAssignments) {
    const studyTopicId = await ensureCanonicalStudyTopicForSubject(db, {
      id: assignment.subjectId,
      name: assignment.subjectName,
      slug: assignment.subjectSlug,
    });

    await db.run(
      `INSERT OR IGNORE INTO knowledge_item_study_topics
        (knowledgeItemId, studyTopicId, sortOrder)
       VALUES (?, ?, ?)`,
      assignment.knowledgeItemId,
      studyTopicId,
      assignment.sortOrder ?? 0
    );
  }
};
