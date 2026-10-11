import { isHabitEffect, NO_PREFERENCE_KEY, QUESTION_BY_ID } from '@/data/questions';
import { AXIS_KEYS, type AxisKey } from './axes';
import { METRICS, type Domain, type Metric } from './habits';

// 응답(문항 id + 선택지 key, 답한 순서대로) → 지표별 증거. 선택한 선택지에 적힌 효과만 반영한다.

/** 직접 증거 1.0, 간접 증거 0.35 (임시값, data/persona/questionnaire_reinforcement_proposal.md) */
export const EVIDENCE_WEIGHT = { d: 1, i: 0.35 } as const;

export interface AnswerStep {
  id: string;
  key: string | null;
}

export interface Evidence {
  /** 지표 → 수준 → 점수 */
  score: Record<Metric, Record<string, number>>;
  /** 지표별 직접 증거 수 */
  direct: Record<Metric, number>;
  /** 가장 중시하는 영역 (Q35). 상관없음이거나 묻지 않았으면 null */
  domain: Domain | null;
  /** 영역 안에서 가장 중시하는 지표 (Q37) */
  focus: Metric | null;
  /** 재무·부채 축 선호: Σ(level·w), Σw */
  axisSum: Record<AxisKey, number>;
  axisWeight: Record<AxisKey, number>;
  /** 실제로 선택지를 고른 문항 수 (건너뛴 문항 제외, 상관없음 포함) */
  answered: number;
}

export function collectEvidence(steps: AnswerStep[]): Evidence {
  const ev: Evidence = {
    score: Object.fromEntries(METRICS.map((m) => [m, {}])) as Evidence['score'],
    direct: Object.fromEntries(METRICS.map((m) => [m, 0])) as Evidence['direct'],
    domain: null,
    focus: null,
    axisSum: Object.fromEntries(AXIS_KEYS.map((k) => [k, 0])) as Evidence['axisSum'],
    axisWeight: Object.fromEntries(AXIS_KEYS.map((k) => [k, 0])) as Evidence['axisWeight'],
    answered: 0,
  };
  for (const step of steps) {
    const q = QUESTION_BY_ID[step.id];
    const option = q?.options.find((o) => o.key === step.key);
    if (!q || !option) continue;
    ev.answered += 1;
    if (option.key === NO_PREFERENCE_KEY) continue;
    if (option.domain) ev.domain = option.domain;
    if (option.focus) ev.focus = option.focus;
    for (const e of option.effects) {
      if (isHabitEffect(e)) {
        ev.score[e.metric][e.level] = (ev.score[e.metric][e.level] ?? 0) + EVIDENCE_WEIGHT[e.strength];
        if (e.strength === 'd') ev.direct[e.metric] += 1;
      } else {
        ev.axisSum[e.axis] += e.level * e.w;
        ev.axisWeight[e.axis] += e.w;
      }
    }
  }
  return ev;
}

/** 지표의 가장 높은 점수 수준과 그 점수 */
export function topLevel(ev: Evidence, metric: Metric): { level: string; score: number } | null {
  const top = Object.entries(ev.score[metric]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return top ? { level: top[0], score: top[1] } : null;
}
