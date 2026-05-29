"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReferenceEntitySlug = exports.slugifyName = exports.summarizeKnowledgeProgress = exports.isBuiltInPolityEntity = exports.isFormationSubtype = void 0;
const isFormationSubtype = (value) => value === 'civilization' ||
    value === 'era' ||
    value === 'tradition' ||
    value === 'world_frame' ||
    value === 'other';
exports.isFormationSubtype = isFormationSubtype;
const isBuiltInPolityEntity = (entity) => entity.kind === 'polity' &&
    entity.metadata?.atlasSource === 'historical-basemaps' &&
    entity.metadata?.builtIn === true;
exports.isBuiltInPolityEntity = isBuiltInPolityEntity;
const summarizeKnowledgeProgress = (items) => {
    const byStatus = {
        inbox: 0,
        queued: 0,
        active: 0,
        completed: 0,
        archived: 0,
    };
    for (const item of items) {
        byStatus[item.status] += 1;
    }
    return {
        total: items.length,
        active: byStatus.active,
        completed: byStatus.completed,
        byStatus,
    };
};
exports.summarizeKnowledgeProgress = summarizeKnowledgeProgress;
const slugifyName = (value) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
exports.slugifyName = slugifyName;
const buildReferenceEntitySlug = (kind, title) => `${kind}-${(0, exports.slugifyName)(title)}`;
exports.buildReferenceEntitySlug = buildReferenceEntitySlug;
