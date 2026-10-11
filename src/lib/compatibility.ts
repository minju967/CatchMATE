import { AXES, AXIS_BY_KEY, levelLabel, type AxisKey, type Levels, type PrefLevels } from './axes';
import { DEBT_BURDEN_PENALTY, GRADES, LIFE, SCORE_WEIGHTS } from './config';
import { sameZone } from './regions';

export interface PreferenceInput {
  pref: PrefLevels;
  prefWeight: Record<AxisKey, number>;
}

export interface MatchProfile {
  region: string;
  age: number;
  levels: Levels;
}

const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

/** 축별 습관 조화도 0~1 (§7.3) */
export function axisHarmony(key: AxisKey, a: number, b: number, nLevels: number): number {
  const diff = Math.abs(a - b);
  if (key === 'investment') {
    // 투자자끼리는 1단계 차이까지 만점. 한쪽만 미투자(0)면 "하느냐 마느냐"의 차이라 관용 없이 감점한다.
    if ((a === 0) !== (b === 0)) return 1 - diff / (nLevels - 1);
    return 1 - Math.max(0, diff - 1) / (nLevels - 2);
  }
  // 부채: 비슷할수록 높되, 두 사람의 평균 부담이 클수록 깎는다 (둘 다 무부채 ≠ 둘 다 과부담)
  if (key === 'debt') return (1 - diff / (nLevels - 1)) * (1 - DEBT_BURDEN_PENALTY * ((a + b) / 2 / (nLevels - 1)));
  if (key === 'asset' || key === 'income') return 1 - (0.5 * diff) / (nLevels - 1); // 완만한 유사도
  return 1 - diff / (nLevels - 1); // saving, spending
}

/** 영역 안 축들의 조화도 평균 × 100 */
function groupHarmony(keys: AxisKey[], a: Levels, b: Levels): number {
  const sum = keys.reduce((s, key) => s + axisHarmony(key, a[key], b[key], AXIS_BY_KEY[key].nLevels), 0);
  return (100 * sum) / keys.length;
}

/** 금융 습관 — 저축·소비·투자 (§7.1) */
export const habitHarmony = (a: Levels, b: Levels) => groupHarmony(['saving', 'spending', 'investment'], a, b);

/** 재무 상태 — 재산·소득 (§7.2) */
export const financeHarmony = (a: Levels, b: Levels) => groupHarmony(['asset', 'income'], a, b);

/** 부채 상태 — 부채 (§7.3). 부담 보정은 axisHarmony 에 들어 있다. */
export const debtHarmony = (a: Levels, b: Levels) => groupHarmony(['debt'], a, b);

/** 생활 조건 — 지역·나이 (§7.4) */
export function lifeScore(a: Pick<MatchProfile, 'region' | 'age'>, b: Pick<MatchProfile, 'region' | 'age'>): number {
  const region = a.region === b.region ? LIFE.region.same : sameZone(a.region, b.region) ? LIFE.region.sameZone : LIFE.region.other;
  const diff = Math.abs(a.age - b.age);
  const age = LIFE.age.find((r) => diff <= r.maxDiff)?.score ?? LIFE.ageOther;
  return (region + age) / 2;
}

export function gradeLabel(total: number): string {
  return GRADES.find((g) => total >= g.min)!.label;
}

/** 점수 구간의 게이지 색 (CSS 값) */
export function gradeColor(total: number): string {
  return GRADES.find((g) => total >= g.min)!.color;
}

export interface AxisCompare {
  key: AxisKey;
  part: string;
  me: number;
  partner: number;
  meLabel: string;
  partnerLabel: string;
  /** 0~100 */
  harmony: number;
}

export interface Compatibility {
  total: number;
  label: string;
  habit: number;
  finance: number;
  debt: number;
  life: number;
  axisCompare: AxisCompare[];
}

/** 궁합 점수 (§7). 하위 점수를 먼저 정수로 반올림한 뒤 가중합하므로 화면의 숫자로 총점을 검산할 수 있다. */
export function computeCompatibility(me: MatchProfile, partner: MatchProfile): Compatibility {
  const habit = Math.round(habitHarmony(me.levels, partner.levels));
  const finance = Math.round(financeHarmony(me.levels, partner.levels));
  const debt = Math.round(debtHarmony(me.levels, partner.levels));
  const life = Math.round(lifeScore(me, partner));
  const total = Math.round(
    clamp100(SCORE_WEIGHTS.habit * habit + SCORE_WEIGHTS.finance * finance + SCORE_WEIGHTS.debt * debt + SCORE_WEIGHTS.life * life),
  );

  const axisCompare = AXES.map((axis) => ({
    key: axis.key,
    part: axis.part,
    me: me.levels[axis.key],
    partner: partner.levels[axis.key],
    meLabel: levelLabel(axis.key, me.levels[axis.key]),
    partnerLabel: levelLabel(axis.key, partner.levels[axis.key]),
    harmony: Math.round(100 * axisHarmony(axis.key, me.levels[axis.key], partner.levels[axis.key], axis.nLevels)),
  }));

  return { total, label: gradeLabel(total), habit, finance, debt, life, axisCompare };
}
