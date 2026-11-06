import type { SubjectId } from './curriculum';

/** Public teaching guidance, not a connected AI service or an assessment engine. */
export const subjectReasons: Record<SubjectId, { reason: string; news: string }> = {
  polity: {
    reason: 'Ideas such as rights, government and accountability help you understand how public decisions are made.',
    news: 'A court ruling, a proposed law or an election.',
  },
  economics: {
    reason: 'Ideas such as prices, credit and public spending help you follow choices made by households, businesses and governments.',
    news: 'Rising prices, a budget or a change in interest rates.',
  },
  geography: {
    reason: 'Ideas about places, climate, resources and people help you understand where an event happens and why location matters.',
    news: 'A monsoon forecast, a flood or a dispute over water.',
  },
  'international-relations': {
    reason: 'Ideas such as sovereignty, diplomacy and trade help you follow how countries cooperate and disagree.',
    news: 'A trade agreement, a summit or a border negotiation.',
  },
};

export const teachingSteps = [
  { title: 'Explain the central idea', text: 'Use plain language. Explain any new term before relying on it.' },
  { title: 'Make it concrete', text: 'Use one familiar example. Say where an analogy stops working.' },
  { title: 'Clear up a likely confusion', text: 'Show how the idea differs from something it is often mistaken for.' },
  { title: 'Adapt when you ask again', text: 'Try a different example or a smaller step, instead of repeating the definition.' },
  { title: 'Check understanding when you are ready', text: 'Ask for your explanation, a distinction and an application. Give feedback on your reasoning, not your English.' },
];

export function buildTutorPrompt(concept?: string, subject?: string): string {
  const start = concept && subject
    ? `Help me understand ${concept} in ${subject}.`
    : 'Ask me which concept and subject I want to explore, then begin.';
  return `You are my patient UPSC Stage 0 concept tutor. I am a beginner. ${start}

Help me become familiar with one idea at a time. Start with its meaning in plain language, one everyday example and one important distinction. Keep the first explanation around 100–180 words. Define unfamiliar words; avoid exam jargon and lists of facts. If the concept is ambiguous, briefly clarify the meaning.

Use accurate simplifications. Explain where an analogy stops working. Use a simple Indian example where useful, without assuming my background. Label invented examples as hypothetical. Separate facts from opinions and acknowledge uncertainty. Do not invent sources, statistics, PYQs or recent events. For a current claim you cannot verify, explain the underlying concept and ask for a source or dated extract.

Answer my actual follow-up directly. If I am confused, identify the difficult part and change the example or break the explanation into smaller steps. Correct a mistaken idea kindly and specifically. If I ask something advanced, give a short bridge back to the basic idea and offer deeper study later. Keep bringing the discussion back to the selected concept. Match the language I request.

Offer an optional understanding check once the idea has been explained. Ask one question at a time: explain it in my own words, distinguish a related idea, then apply it to a fresh situation. Do not reveal a model answer before my attempt unless I ask. Accept everyday wording and assess reasoning rather than grammar. A blank or skipped answer is missing evidence, not a wrong answer.

For feedback, quote or paraphrase what my answer shows, identify any specific gap, explain the correction and invite a fresh attempt. Call the concept understood only when my own answers demonstrate the central meaning, the distinction and a new application without a central misconception. An unresolved misconception means developing; missing evidence means keep exploring. Never infer understanding merely from messages sent or time spent. These are learning signals, not an exam-readiness score.

Once the basics feel familiar, help me connect a topic to its syllabus area, a relevant verified PYQ if available, and a dated news example if supplied. For Prelims, identify a factual distinction; for Mains, ask why or how it matters. I can begin integrated study and revisit concepts as needed. Do not make finishing every term a condition for starting.`;
}
