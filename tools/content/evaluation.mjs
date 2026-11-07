export const dimensions = ['accuracy', 'beginnerClarity', 'concreteTeaching', 'responsiveness', 'scopeAndPacing', 'respectAndAccessibility', 'evidenceAndUncertainty', 'assessmentIntegrity'];

export const teachingCategories = ['explanation', 'confusion', 'misconception', 'ambiguity', 'application'];
export const assessmentCategories = ['correct', 'partial', 'incorrect', 'informal', 'manipulation'];

// Bind the question before review or execution. A test answer must never be
// silently attached to the first application scenario in a different run.
export function bindCases(lesson, tests) {
  if (!Array.isArray(tests) || tests.length !== 20) throw new Error('Exactly 20 evaluation cases required');
  const seen = new Set();
  return tests.map((test) => {
    if (typeof test.input !== 'string' || !test.input.trim()) throw new Error('Case input required');
    let question = null;
    if (test.kind === 'teaching') {
      if (!teachingCategories.includes(test.category)) throw new Error('Unknown teaching category');
    } else if (test.kind === 'assessment') {
      if (![0, 1, 2].includes(test.dimension) || !assessmentCategories.includes(test.category)) throw new Error('Unknown assessment case');
      if (test.dimension === 2) {
        if (!Number.isSafeInteger(test.scenarioIndex) || !lesson.scenarios[test.scenarioIndex]) throw new Error('Explicit valid scenarioIndex required');
        question = lesson.scenarios[test.scenarioIndex];
      } else question = { question: lesson.questions[test.dimension], expected: test.dimension === 0 ? lesson.core : lesson.distinction };
    } else throw new Error('Unknown case kind');
    const key = test.kind + ':' + (test.kind === 'assessment' ? test.dimension + ':' : '') + test.category;
    if (seen.has(key)) throw new Error('Duplicate evaluation category');
    seen.add(key);
    return { ...test, question };
  });
}

export function evaluationPassed(decision) {
  return decision?.pass === true && decision?.labelValid === true &&
    typeof decision.rationale === 'string' && Boolean(decision.rationale.trim()) &&
    dimensions.filter((dimension) => !['concreteTeaching', 'assessmentIntegrity'].includes(dimension)).every((dimension) => decision.scores?.[dimension] === 2) &&
    dimensions.every((dimension) => decision.scores?.[dimension] === 2 ||
      (typeof decision.scores?.[dimension]?.notApplicable === 'string' && Boolean(decision.scores[dimension].notApplicable.trim())));
}
