import { AXIS_KEYS, type AxisKey, type PrefLevels } from './axes';
import { collectEvidence, topLevel, type AnswerStep } from './evidence';
import { METRICS, METRIC_DOMAIN, personaOfLevel, type Domain, type Metric } from './habits';
import type { PersonaCode } from './personas';

/** qid → 선택지 key. null/undefined 는 건너뛴 문항. 답한 순서대로 들어 있다. */
export type Answers = Record<string, string | null | undefined>;

/** 금융 습관 선호: 상대에게 바라는 지표별 수준 */
export interface HabitPreference {
  /** 지표별 선호 수준 (증거가 없는 지표는 키가 없다) */
  levels: Partial<Record<Metric, string>>;
  /** 지표별 증거 강도 (직접 1.0 · 간접 0.35의 합) */
  strength: Partial<Record<Metric, number>>;
  /** 가장 중시하는 영역 */
  domain: Domain | null;
  /** 가장 중시하는 지표 (주요 특징 1에 해당) */
  main: Metric | null;
  /** 선호하는 페르소나 (주요 선호 지표와 수준으로 정해진다). 정할 수 없으면 null */
  persona: PersonaCode | null;
}

export interface Preference {
  /** 축별 선호 수준 (궁합 점수 P 용). 재무·부채는 문항에서, 저축·소비·투자는 습관 선호에서 옮겨 온다. */
  pref: PrefLevels;
  /** 축별 확신 강도 */
  prefWeight: Record<AxisKey, number>;
  habits: HabitPreference;
  answeredCount: number;
}

export function toSteps(answers: Answers): AnswerStep[] {
  return Object.entries(answers).map(([id, key]) => ({ id, key: key ?? null }));
}

export function countAnswered(answers: Answers): number {
  return collectEvidence(toSteps(answers)).answered;
}

// 습관 수준 → 6축 레벨 (저축 0~2, 소비 0~2, 투자 0~4). 소비 '여유'는 소비가 낮은 쪽이라 절제(0)에 해당한다.
const AXIS_LEVEL = {
  saving: { 소비: 0, 계획: 1, 알뜰: 2 },
  spending: { 여유: 0, 적정: 1, 과소비: 2 },
  investment: { 소극: 1, 보통: 2, 적극: 3 },
} as const;

export function computePreference(answers: Answers): Preference {
  const ev = collectEvidence(toSteps(answers));

  const levels: HabitPreference['levels'] = {};
  const strength: HabitPreference['strength'] = {};
  for (const m of METRICS) {
    const top = topLevel(ev, m);
    if (!top) continue;
    levels[m] = top.level;
    strength[m] = Object.values(ev.score[m]).reduce((s, v) => s + v, 0);
  }

  // 가장 중시하는 지표: Q37 에서 고른 지표 > 중시하는 영역 안에서 증거가 가장 큰 지표 > 전체에서 가장 큰 지표.
  // 다수형(계획·카드·집중)은 페르소나를 정할 수 없어 건너뛴다.
  const strongest = (pool: Metric[]) => [...pool].sort((a, b) => (strength[b] ?? 0) - (strength[a] ?? 0));
  const ordered = [
    ...(ev.focus ? [ev.focus] : []),
    ...strongest(METRICS.filter((m) => ev.domain && METRIC_DOMAIN[m] === ev.domain && m !== ev.focus)),
    ...strongest(METRICS.filter((m) => !ev.domain || METRIC_DOMAIN[m] !== ev.domain)),
  ].filter((m) => levels[m] != null);
  const main = ordered.find((m) => personaOfLevel(m, levels[m]!)) ?? null;
  const persona = main ? personaOfLevel(main, levels[main]!) : null;

  const sumLevel = Object.fromEntries(AXIS_KEYS.map((k) => [k, ev.axisSum[k]])) as Record<AxisKey, number>;
  const prefWeight = Object.fromEntries(AXIS_KEYS.map((k) => [k, ev.axisWeight[k]])) as Record<AxisKey, number>;
  for (const [axis, metric] of [['saving', 'S'], ['spending', 'V'], ['investment', 'I']] as const) {
    const table = AXIS_LEVEL[axis] as Record<string, number>;
    for (const [level, score] of Object.entries(ev.score[metric])) {
      sumLevel[axis] += table[level] * score;
      prefWeight[axis] += score;
    }
  }
  const pref = Object.fromEntries(AXIS_KEYS.map((k) => [k, prefWeight[k] > 0 ? sumLevel[k] / prefWeight[k] : null])) as PrefLevels;

  return { pref, prefWeight, habits: { levels, strength, domain: ev.domain, main, persona }, answeredCount: ev.answered };
}
