import seedrandom from 'seedrandom';
import { AXES, flowLevels, flowRatios, percentileRanks, quantileLevel, roundPercent, type AxisKey, type Levels, type Ratios } from './axes';
import { SEED } from './config';
import { financeStatus } from './finance';
import { PERSONAS } from './personas';
import { incomeBandOf, REGION_WEIGHTS } from './regions';
import type { Customer, Rng } from './types';

// 목업 고객 생성 (§9.4). DB 없이도 쓸 수 있는 순수 함수라 seed 스크립트와 테스트가 함께 쓴다.
// 목업은 시연용 데이터가 아니라 로직 시험용이다: 레벨은 아래 "원형" 범위에서 뽑고,
// 페르소나 16종은 실데이터의 비율대로 따로 뽑는다(레벨과 연동되지 않는다).

type Archetype = keyof typeof SEED.personaShare;

/** 목업 레벨을 뽑는 원형별 축 레벨 범위 [최소, 최대] (예전 5종 페르소나의 범위) */
const ARCHETYPE_RANGE: Record<Archetype, Record<AxisKey, [number, number]>> = {
  SAVER: { saving: [2, 2], spending: [0, 0], investment: [0, 1], asset: [1, 2], income: [0, 1], debt: [0, 1] },
  PLANNER: { saving: [1, 1], spending: [1, 1], investment: [0, 2], asset: [1, 1], income: [1, 1], debt: [0, 2] },
  GROWER: { saving: [1, 2], spending: [1, 1], investment: [3, 4], asset: [1, 2], income: [1, 2], debt: [1, 2] },
  ENJOYER: { saving: [0, 0], spending: [2, 2], investment: [0, 1], asset: [0, 1], income: [1, 2], debt: [0, 1] },
  DEBT: { saving: [0, 0], spending: [1, 2], investment: [0, 0], asset: [0, 0], income: [0, 1], debt: [3, 3] },
};

const ADJECTIVES = [
  '적금하는', '여행 가는', '가계부 쓰는', '커피 내리는', '산책하는', '책 읽는', '요리하는', '캠핑 가는',
  '노래하는', '달리는', '저금통 든', '계획 세우는', '낮잠 자는', '춤추는', '그림 그리는', '자전거 타는',
  '별 보는', '빵 굽는', '꽃 심는', '사진 찍는', '영화 보는', '등산하는', '뜨개질하는', '차 마시는',
];
const ANIMALS = [
  '다람쥐', '수달', '고슴도치', '펭귄', '여우', '코알라', '판다', '고래', '부엉이', '토끼', '거북이', '햄스터',
  '알파카', '사슴', '물개', '참새', '너구리', '미어캣', '돌고래', '오리', '카피바라', '두더지', '치타', '올빼미',
];

/** [분위(0~1), 값] 구간 선형 보간 */
function interpolate(points: [number, number][], u: number): number {
  for (let i = 1; i < points.length; i++) {
    const [u0, v0] = points[i - 1];
    const [u1, v1] = points[i];
    if (u <= u1) return v0 + ((u - u0) / (u1 - u0)) * (v1 - v0);
  }
  return points[points.length - 1][1];
}

// 연소득(만원) 분위 함수 — 소득 구간(§9.3) 경계가 40·75분위 근처에 오도록 잡았다.
const INCOME_CURVE: [number, number][] = [[0, 1800], [0.15, 2400], [0.4, 3600], [0.75, 5000], [0.92, 7000], [1, 12000]];
// 재산 = (나이 − 20) × 550만 × 배수
const ASSET_CURVE: [number, number][] = [[0, 0.08], [0.4, 0.6], [0.75, 1.5], [1, 5]];
const QUANTILE_BANDS: [number, number][] = [[0, 0.4], [0.4, 0.75], [0.75, 1]];

// 레벨별 원천 비율 범위 (§3 기준 안쪽)
const SAVING_RATE: [number, number][] = [[0.0, 0.095], [0.105, 0.295], [0.305, 0.5]];
const SPENDING_RATE: [number, number][] = [[0.3, 0.495], [0.505, 0.745], [0.755, 0.95]];
const INVEST_RATIO: [number, number][] = [[0, 0], [0.02, 0.095], [0.105, 0.245], [0.255, 0.445], [0.455, 0.7]];
const DSR: [number, number][] = [[0, 0], [0.03, 0.195], [0.205, 0.395], [0.405, 0.6]];

const AGE_GROUPS = [29, 34, 39, 45];
const ageGroupOf = (age: number) => AGE_GROUPS.findIndex((max) => age <= max);

function makeHelpers(rng: Rng) {
  const uniform = (lo: number, hi: number) => lo + rng() * (hi - lo);
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  function weighted<T extends string>(weights: Record<T, number>): T {
    const entries = Object.entries(weights) as [T, number][];
    let r = rng() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [key, w] of entries) if ((r -= w) < 0) return key;
    return entries[entries.length - 1][0];
  }
  return { uniform, int, weighted };
}

export function generateCustomers(total: number = SEED.total, seed: string = SEED.seed): Customer[] {
  const rng: Rng = seedrandom(seed);
  const { uniform, int, weighted } = makeHelpers(rng);

  /** 타깃 원형 범위 안에서 뽑되, noiseProb 확률로 범위 밖 ±1 */
  function targetLevel(archetype: Archetype, key: AxisKey, nLevels: number): number {
    const [lo, hi] = ARCHETYPE_RANGE[archetype][key];
    if (rng() < SEED.noiseProb) {
      const outside = [lo - 1, hi + 1].filter((v) => v >= 0 && v < nLevels);
      if (outside.length > 0) return outside[int(0, outside.length - 1)];
    }
    return int(lo, hi);
  }

  /** 수치 정합성: 소비 + 저축 + 투자 + 상환/12 ≤ 월소득 × budgetCap 을 만족하는 비율 조합 */
  function sampleRates(t: Levels) {
    const cap = SEED.budgetCap - 0.02; // 정수 반올림 여유
    const fits = (s: number, c: number, r: number, d: number) => s + c + r * (1 - c) + d <= cap;
    for (let attempt = 0; attempt < 200; attempt++) {
      const s = uniform(...SAVING_RATE[t.saving]);
      const c = uniform(...SPENDING_RATE[t.spending]);
      const r = uniform(...INVEST_RATIO[t.investment]);
      const d = uniform(...DSR[t.debt]);
      if (fits(s, c, r, d)) return { s, c, r, d };
    }
    // 타깃 조합이 예산 안에 들어갈 수 없으면(예: 높은 저축 + 과부담 상환) 각 범위 하한에서 시작해
    // 소비 → 저축 순으로 줄인다. 레벨은 어차피 원천 수치에서 다시 계산한다.
    let s = SAVING_RATE[t.saving][0];
    const r = INVEST_RATIO[t.investment][0];
    const d = DSR[t.debt][0];
    let c = SPENDING_RATE[t.spending][0];
    while (!fits(s, c, r, d) && c > 0.3) c = Math.max(0.3, c - 0.01);
    while (!fits(s, c, r, d) && s > 0) s = Math.max(0, s - 0.01);
    return { s, c, r, d };
  }

  const drafts = Array.from({ length: total }, (_, i) => {
    const gender = i % 2 === 0 ? ('M' as const) : ('F' as const);
    const region = weighted(REGION_WEIGHTS);
    const age = int(SEED.ageMin, SEED.ageMax);
    const target = weighted(SEED.personaShare);
    const t = Object.fromEntries(AXES.map((a) => [a.key, targetLevel(target, a.key, a.nLevels)])) as Levels;

    const annualIncome = Math.round(interpolate(INCOME_CURVE, uniform(...QUANTILE_BANDS[t.income])));
    const monthlyIncome = Math.round(annualIncome / 12);
    const { s, c, r, d } = sampleRates(t);
    const monthlySpending = Math.round(monthlyIncome * c);
    const monthlySaving = Math.round(monthlyIncome * s);
    const monthlyInvestment = t.investment === 0 ? 0 : Math.max(1, Math.round((monthlyIncome - monthlySpending) * r));
    const annualRepayment = t.debt === 0 ? 0 : Math.max(1, Math.round(annualIncome * d));
    const totalDebt = t.debt === 0 ? 0 : Math.round(annualRepayment * uniform(3, 12));
    const totalAsset = Math.round((age - 20) * 550 * interpolate(ASSET_CURVE, uniform(...QUANTILE_BANDS[t.asset])));

    return {
      id: `C${String(i + 1).padStart(6, '0')}`,
      nickname: `${ADJECTIVES[int(0, ADJECTIVES.length - 1)]} ${ANIMALS[int(0, ANIMALS.length - 1)]}`,
      gender,
      region,
      age,
      incomeBand: incomeBandOf(annualIncome),
      annualIncome,
      monthlyIncome,
      monthlySpending,
      monthlySaving,
      monthlyInvestment,
      totalAsset,
      totalDebt,
      annualRepayment,
    };
  });

  // 분위수 기반 축: 소득은 전체 분포, 재산은 동일 연령대 안에서 다시 계산한다.
  const incomePct = percentileRanks(drafts.map((d) => d.annualIncome));
  const assetPct = new Array<number>(drafts.length);
  AGE_GROUPS.forEach((_, group) => {
    const idx = drafts.map((d, i) => (ageGroupOf(d.age) === group ? i : -1)).filter((i) => i >= 0);
    const ranks = percentileRanks(idx.map((i) => drafts[i].totalAsset));
    idx.forEach((i, k) => (assetPct[i] = ranks[k]));
  });

  // 원천 수치로부터 레벨·재무 상태를 다시 계산한 값이 정답 (타깃과 달라도 됨)
  const personaWeights = Object.fromEntries(PERSONAS.map((p) => [p.code, p.count]));
  return drafts.map((d, i) => {
    const levels: Levels = { ...flowLevels(d), asset: quantileLevel(assetPct[i]), income: quantileLevel(incomePct[i]) };
    const ratios: Ratios = { ...flowRatios(d), asset: roundPercent(assetPct[i]), income: roundPercent(incomePct[i]) };
    const assetQuintile = Math.min(5, Math.floor(assetPct[i] / 20) + 1);
    return {
      ...d,
      levels,
      ratios,
      persona: weighted(personaWeights) as Customer['persona'],
      finance: financeStatus(incomePct[i], `${assetQuintile}분위`),
    };
  });
}
