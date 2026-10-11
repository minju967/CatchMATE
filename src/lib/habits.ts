import { groupOf, TRAIT_INDICATORS, type TraitIndicator } from './assign';
import { PERSONA_BY_GROUP, type PersonaCode } from './personas';

// 금융 습관 6지표 (설문 data/persona/persona_v2_summary.md). 설문은 상대에게 바라는 지표별 수준을 묻고,
// 후보는 같은 지표의 실제 유형을 가진다. 둘을 같은 이름(수준)으로 맞추는 곳이 이 파일이다.

export type Metric = 'S' | 'V' | 'C' | 'P' | 'I' | 'D';
export type Domain = '저축' | '소비' | '투자';

export const METRICS: Metric[] = ['S', 'V', 'C', 'P', 'I', 'D'];

export const METRIC_INDICATOR: Record<Metric, TraitIndicator> = {
  S: 'saving_type_peer',
  V: 'spend_segment_percentile_peer_new',
  C: 'category_segment_peer',
  P: 'payment_segment',
  I: 'investment_intensity_type_peer',
  D: 'portfolio_concentration_type',
};

export const METRIC_LABEL: Record<Metric, string> = Object.fromEntries(METRICS.map((m) => [m, TRAIT_INDICATORS[METRIC_INDICATOR[m]].label])) as Record<Metric, string>;
export const METRIC_DOMAIN: Record<Metric, Domain> = Object.fromEntries(METRICS.map((m) => [m, TRAIT_INDICATORS[METRIC_INDICATOR[m]].domain])) as Record<Metric, Domain>;

/** 설문의 수준 이름 → 데이터의 유형 이름. 데이터에서 페르소나 특징이 될 수 없는 다수형(계획·카드·집중)은 undefined. */
export const TYPE_OF_LEVEL: Record<Metric, Record<string, string | undefined>> = {
  S: { 알뜰: '알뜰형', 계획: '계획형', 소비: '소비형' },
  V: { 여유: '여유형', 적정: '적정형', 과소비: '과소비형' }, // 여유 = 소비가 또래보다 낮음
  C: { 문화: '문화형', 생활비: '생활비형', 식비: '식비형', 교육: '교육형', 기타: '기타형' },
  P: { 현금: '현금중심형', 균형: '균형형', 카드: '카드중심형' },
  I: { 소극: '소극형', 보통: '보통형', 적극: '적극형' },
  D: { 분산: '분산형', 중간: '중간형', 집중: '집중형' },
};

export const LEVELS = Object.fromEntries(METRICS.map((m) => [m, Object.keys(TYPE_OF_LEVEL[m])])) as Record<Metric, string[]>;

/** 지표 값이 순서를 가지는 지표(이웃 수준이면 부분 점수) */
export const ORDINAL: Partial<Record<Metric, string[]>> = { V: ['여유', '적정', '과소비'], I: ['소극', '보통', '적극'] };

/** 지표별 수준 (보류·해당 없음은 키가 없다) */
export type HabitLevels = Partial<Record<Metric, string>>;

const LEVEL_OF_TYPE = Object.fromEntries(
  METRICS.map((m) => [m, Object.fromEntries(Object.entries(TYPE_OF_LEVEL[m]).map(([level, type]) => [type!, level]))]),
) as Record<Metric, Record<string, string>>;

/** 후보의 지표별 데이터 유형 → 수준. 저축 비선호·여유자금 없음·투자 미해당처럼 고를 수 없는 값은 건너뛴다. */
export function habitLevelsOf(types: Record<TraitIndicator, string>): HabitLevels {
  const out: HabitLevels = {};
  for (const m of METRICS) {
    const level = LEVEL_OF_TYPE[m][types[METRIC_INDICATOR[m]]];
    if (level) out[m] = level;
  }
  return out;
}

/** 지표와 수준으로 정해지는 페르소나. 다수형(계획·카드·집중)이면 null. */
export function personaOfLevel(metric: Metric, level: string): PersonaCode | null {
  const type = TYPE_OF_LEVEL[metric][level];
  const group = type && groupOf({ indicator: METRIC_INDICATOR[metric], type });
  return group ? PERSONA_BY_GROUP[group].code : null;
}
