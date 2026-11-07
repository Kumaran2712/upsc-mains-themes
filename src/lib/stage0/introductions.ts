import polity from '../../../content/stage0/introductions/polity.json';
import economics from '../../../content/stage0/introductions/economics.json';
import geography from '../../../content/stage0/introductions/geography.json';
import internationalRelations from '../../../content/stage0/introductions/international-relations.json';
import { concepts } from './curriculum';

export interface Introduction { id: string; explanation: string; example: string; distinction: string; origin: string }
const entries: Introduction[] = [polity, economics, geography, internationalRelations].flatMap(file => file.entries);
export const introductions = new Map(entries.map(entry => [entry.id, entry]));
const known = new Set(concepts.map(c => c.id));
if (introductions.size !== concepts.length || entries.length !== concepts.length || entries.some(entry => !known.has(entry.id) ||
  [entry.explanation, entry.example, entry.distinction].some(text => typeof text !== 'string' || text.trim().length < 40))) {
  throw new Error('Every Stage 0 concept requires a complete, placement-specific introductory guide');
}
