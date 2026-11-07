# Stage 0 calibration evidence

Recorded 7 November 2026. These are development results, not a publication approval or a claim about learner outcomes. Machine-readable evidence: [report.json](../content/stage0/calibration/report.json).

Four source-backed drafts—Constitution, Inflation, Weather and Diplomacy—passed independent content review after revision. A deliberately wrong inflation definition was rejected. Review also caught an actual nation/state prerequisite confusion. Author/tutor candidate: gpt-5.4-mini-2026-03-17; reviewer: gpt-5.4-2026-03-05.

The tutor and assessor then produced 160 actual outputs: 20 cases per placement, each repeated with a distinct provider receipt. All four semantic reviews completed. The isolated Railway budget ledger records **$0.782090 charged against a $1 ceiling**. Jobs were cleared after completion; uncertain dispatches are not automatically retried.

| Placement | Outputs reviewed | Outputs flagged by the reviewing model |
| --- | ---: | ---: |
| Constitution | 40 | 8 |
| Inflation | 40 | 5 |
| Weather | 40 | 1 |
| Diplomacy | 40 | 5 |

These counts are review flags, not verified error rates. Some flags identify reference-case defects; some identify tutor/assessor defects. Several judge booleans contradict their own explanation. The weather flag may be overly strict when the complete response is considered. Those disagreements require adjudication rather than treating the reviewing model as ground truth.

## Findings and implemented corrections

1. **Question/reference mismatch.** Several generated application answers addressed a different scenario from the question actually passed to the assessor. The pipeline now requires an explicit scenario index, binds the question before review/execution, and independently checks every reference category before paid runtime evaluation. Missing, duplicated and out-of-range cases are rejected deterministically.
2. **Grading consistency.** Some partial answers received full credit; one correct informal distinction answer was under-credited. The revised assessor contract emphasizes evidence for the exact question, equal treatment of informal reasoning, and no credit for reasoning supplied by the assessor itself. This is a candidate correction requiring reevaluation.
3. **Subject scope.** One diplomacy response used negotiations between Indian states as an international-relations example. The revised tutor contract explicitly distinguishes sovereign countries from subnational states and requires examples to preserve subject meaning.
4. **Quotation formatting.** Seven assessment outputs initially failed exact-span validation because the model added quotation marks or changed ASCII casing. Validation now resolves those formatting differences only if it can return the exact original learner-input substring. Invented evidence still fails. This correction does not change semantic scores.
5. **Reviewer reliability.** New runtime reviews require separate `pass` and `labelValid` decisions and explain their meaning. A false label blocks publication even when the assessor's grade is appropriate. Contradictory or disputed reviews remain held for independent adjudication; no automatic override is implemented.

The recorded 160 outputs used prompt version `stage0-tutor-2026-11-07-v1`. The candidate fixes use **v2**, which has not yet completed real-output calibration. Old receipts remain as evidence and cannot establish approval for the new prompt.

## Remaining release conditions

- Resolve disputed labels/judgements, regenerate mismatched references and repeat affected evaluations against v2.
- Implement bounded model revision/adjudication scheduling with durable receipts and a separately approved full-curriculum currency budget.
- Author, source-check and independently evaluate all 253 placements. Four content approvals alone do not meet the runtime gate.
- Keep `content:complete` failing until every placement has the required publication evidence. At this checkpoint, **0/253 flagship placements are approved**, and the 12 existing pilots remain pilots.

Source provenance and limited excerpts are versioned beside the calibration artifacts; retrieved full texts remain local. Sources include the Federal Reserve inflation explainer, NOAA weather/climate explanation, the US State Department diplomacy encyclopedia and NCERT *Indian Constitution at Work*, chapter 1. Source hashes prove text integrity, not correctness; independent claim review remains necessary.
