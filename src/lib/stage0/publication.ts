import release from './release.json';

/** Build-time public capability manifest. Assessment anchors never belong here. */
export interface PublicLesson {
  id: string; version: string; objective: string; explanation: string; example: string;
  differently: string; confusion: string; sources: { title: string; url: string; locator: string }[];
}
export interface GuidedConcept { id: string; version: string; sources: { title: string; url: string; locator: string }[] }
export const publication = release as { version: string; pilotPlacements: string[]; published: PublicLesson[]; guided?: GuidedConcept[] };
export const assessmentPlacements = new Set(publication.pilotPlacements.concat(publication.published.map(lesson => lesson.id)));
export const guidedConcepts = new Map((publication.guided || []).map(c => [c.id, c]));
export const tutorPlacements = new Set([...assessmentPlacements, ...guidedConcepts.keys()]);
export const publicLessons = new Map(publication.published.map((lesson) => [lesson.id, lesson]));
export const availableFor = (subject: string) => [...tutorPlacements].filter((id) => id.startsWith(subject + '/')).length;
export const checksFor = (subject: string) => [...assessmentPlacements].filter(id => id.startsWith(subject + '/')).length;
