import { AXES, type AxisKey } from './axes';
import { PARTNER_FIT } from './config';
import { METRICS, ORDINAL, type Metric } from './habits';
import type { PreferenceInput } from './compatibility';
import type { HabitPreference } from './preference';
import type { Customer } from './types';

// 추천용 적합도: 설문 응답에 맞는 후보를 고른다. 세 부분으로 본다.
//  - 금융 습관: 지표별 선호 수준과 후보의 실제 유형이 맞는 정도(가장 중시하는 지표에 가중) + 선호 페르소나 일치
//  - 재무 상태: 소득·재산 선호와 후보 레벨의 거리
//  - 부채 상태: 부채 선호와 후보 레벨의 거리
// 응답이 없는 부분은 빼고 나머지 비중을 키운다. (궁합 점수의 P 는 compatibility.ts 에 그대로 있다.)

export interface FitInput extends PreferenceInput {
  habits?: HabitPreference;
}

/** 선호 수준 하나가 후보와 맞는 정도 0~1. 순서가 있는 지표는 이웃 수준이면 절반. */
function levelMatch(metric: Metric, preferred: string, actual: string | undefined): number {
  if (!actual) return 0;
  if (preferred === actual) return 1;
  const order = ORDINAL[metric];
  if (order && Math.abs(order.indexOf(preferred) - order.indexOf(actual)) === 1) return 0.5;
  return 0;
}

/** 금융 습관 적합도 0~1. 비교할 선호가 없으면 null. */
export function habitFit(habits: HabitPreference | undefined, c: Pick<Customer, 'habits' | 'persona'>): number | null {
  if (!habits) return null;
  let wsum = 0;
  let msum = 0;
  if (c.habits) {
    for (const m of METRICS) {
      const level = habits.levels[m];
      if (level == null) continue;
      const w = Math.min(habits.strength[m] ?? 0, 2) + (habits.main === m ? PARTNER_FIT.mainBoost : 0);
      wsum += w;
      msum += w * levelMatch(m, level, c.habits[m]);
    }
  }
  const matched = wsum > 0 ? msum / wsum : null;
  const persona = habits.persona ? (c.persona === habits.persona ? 1 : 0) : null;
  if (matched == null) return persona;
  if (persona == null) return matched;
  return (1 - PARTNER_FIT.personaShare) * matched + PARTNER_FIT.personaShare * persona;
}

/** 지정한 축들만 본 선호 거리 적합도 0~1. 선호가 없으면 null. */
export function axesFit({ pref, prefWeight }: PreferenceInput, keys: AxisKey[], c: Pick<Customer, 'levels'>): number | null {
  let wsum = 0;
  let dsum = 0;
  for (const axis of AXES) {
    if (!keys.includes(axis.key)) continue;
    const p = pref[axis.key];
    const w = prefWeight[axis.key] ?? 0;
    if (p == null || w <= 0) continue;
    wsum += w;
    dsum += (w * Math.abs(p - c.levels[axis.key])) / (axis.nLevels - 1);
  }
  return wsum === 0 ? null : 1 - dsum / wsum;
}

/** 추천 적합도 0~100 (반올림 전). 응답이 하나도 없으면 중립값 50. */
export function partnerFit(input: FitInput, c: Customer): number {
  const parts: { w: number; v: number | null }[] = [
    { w: PARTNER_FIT.habit, v: habitFit(input.habits, c) },
    { w: PARTNER_FIT.finance, v: axesFit(input, ['income', 'asset'], c) },
    { w: PARTNER_FIT.debt, v: axesFit(input, ['debt'], c) },
  ];
  const used = parts.filter((p) => p.v != null);
  const wsum = used.reduce((s, p) => s + p.w, 0);
  if (wsum === 0) return 50;
  const base = (100 * used.reduce((s, p) => s + p.w * p.v!, 0)) / wsum;
  // 수준 일치는 가짓수가 적어 동점이 많다. 저축·소비·투자 선호와의 연속 거리로 살짝 감점해 순서를 가른다.
  const fine = axesFit(input, ['saving', 'spending', 'investment'], c);
  const score = fine == null ? base : base - PARTNER_FIT.tieBreak * (1 - fine);
  return Math.max(0, Math.min(100, score));
}
