import release from './release.json';

/** Build-time public capability manifest. Assessment anchors never belong here. */
export interface PublicLesson {
  id: string; version: string; objective: string; explanation: string; example: string;
  differently: string; confusion: string; sources: { title: string; url: string; locator: string }[];
}
export const publication = release as { version: string; pilotPlacements: string[]; published: PublicLesson[] };
export const tutorPlacements = new Set(publication.pilotPlacements.concat(publication.published.map((lesson) => lesson.id)));
export const publicLessons = new Map(publication.published.map((lesson) => [lesson.id, lesson]));
export const availableFor = (subject: string) => [...tutorPlacements].filter((id) => id.startsWith(subject + '/')).length;
