// 모든 가중치·임계값 상수. 실제 데이터가 확보되면 이 파일과 personas.ts 만 고치면 된다.

/** 축 가중치 (§3) */
export const AXIS_WEIGHTS = {
  saving: 1.2,
  spending: 1.0,
  investment: 1.0,
  asset: 1.0,
  income: 1.0,
  debt: 1.2,
} as const;

/** 원천 지표 → 축 레벨 경계값 (§3). 값이 경계 이상이면 다음 레벨. */
export const LEVEL_THRESHOLDS = {
  // 실데이터(integrated_feature_df.csv, 13,852명) 분위수에 맞춰 조정한 값. 기획서 초안은 [0.1, 0.3] / [0.5, 0.75] / [0.1, 0.25, 0.45] / [0.2, 0.4].
  savingRate: [0.08, 0.15],
  spendingRate: [0.6, 0.75],
  /** 0%는 미투자(0), 그 외는 아래 경계로 1~4 (투자자 사분위) */
  investmentRatio: [0.045, 0.054, 0.062],
  /** 분위수(0~100) */
  quantile: [40, 75],
  /** 부채가 있을 때 DSR 경계 → 1~3 */
  dsr: [0.15, 0.25],
} as const;

/**
 * 또래 범위: 본인 나이 ± 이 값(세), 성별 무관. 실데이터의 저축·소비·투자·재산 레벨과 카드의 "또래 대비" 위치를 이 또래 안에서 잰다.
 * 저축률·소비율·투자비율 경계값(위 LEVEL_THRESHOLDS)은 전체 고객에서의 분위로 바꾼 뒤 또래 안 분위수에 적용한다(realData.ts).
 * 추천 후보 나이(PARTNER_AGE_WINDOW)와는 별개다. 그 범위는 성별에 따라 비대칭이라 레벨 기준으로 쓰면 같은 나이·같은 값인데 성별에 따라 레벨이 달라진다.
 */
export const PEER_AGE_RANGE = 1;

/** 질문 응답 수 제한 (§5.1) */
export const QUIZ = { minAnswers: 10, maxAnswers: 10, autoNextMs: 300 } as const;

/** S2 가상의 나 추출 (§6.1) */
export const VIRTUAL_ME = {
  count: 3,
  maxRerolls: 3,
  ageStrict: 2,
  ageRelaxed: 5,
  bandRelaxed: 1,
  /** strict 모드에서 count명이 안 될 때 나이를 넓히는 폭 */
  ageStrictRelax: 1,
} as const;

/** S5 이성 후보 추천 (§6.3) */
export const RECOMMEND = {
  count: 3,
  maxRerolls: 3,
  ageStrict: 5,
  ageRelaxed: 8,
  minPool: 10,
  topN: 15,
  /** 한 화면 3명 중 같은 페르소나는 이 수까지 (다양하게 보여주기) */
  maxSamePersona: 2,
  /** 샘플링 가중치 = P ^ weightPower. 1이면 기획서 원문 그대로(P 비례). */
  weightPower: 3,
} as const;

/**
 * 상대 후보 나이 가이드 (한국 나이 기준). 사용자 성별 → 상대가 나보다 older 살 위 ~ younger 살 아래까지.
 * 후보가 모자라면 양쪽으로 relaxExtra 살씩 넓힌다. 추천 입력에 ageWindow 를 넘길 때만 적용된다.
 */
export const PARTNER_AGE_WINDOW = {
  F: { older: 4, younger: 1 },
  M: { older: 3, younger: 4 },
  relaxExtra: 1,
} as const;

/** 상대 후보 지역 규칙: 같은 그룹이면 서로 추천, 그 외는 같은 지역만 (region_merged 기준) */
export const PARTNER_REGION_GROUPS: readonly (readonly string[])[] = [['서울', '경기']];

/**
 * 소규모 지역: 후보가 모자라므로 인근 지역 사람까지 추천한다. (사용자 지역 → 추가로 허용되는 인근 지역)
 * 인근 지역은 임의 지정이므로 서비스 기준에 맞게 이 표만 고치면 된다. 제주는 육지와 맞닿은 곳이 없어 가장 가까운 광주(전남)로 뒀다.
 */
export const NEIGHBOR_REGIONS: Readonly<Record<string, readonly string[]>> = {
  세종: ['대전', '충남', '충북'],
  울산: ['부산', '경남', '경북'],
  제주: ['광주'],
};

export const isSmallRegion = (region: string): boolean => region in NEIGHBOR_REGIONS;

export function partnerRegionOk(me: string, candidate: string): boolean {
  if (me === candidate) return true;
  if (NEIGHBOR_REGIONS[me]?.includes(candidate)) return true;
  return PARTNER_REGION_GROUPS.some((g) => g.includes(me) && g.includes(candidate));
}

/**
 * 추천 적합도(fit.ts): 설문 응답에 맞는 후보를 고른다. 응답이 없는 부분은 빼고 나머지 비중을 키운다.
 * mainBoost = 가장 중시하는 지표에 더하는 가중치, personaShare = 선호 페르소나 일치가 습관 적합도에서 차지하는 몫.
 */
export const PARTNER_FIT = { habit: 0.5, finance: 0.25, debt: 0.25, mainBoost: 3, personaShare: 0.3, tieBreak: 2 } as const;
// tieBreak = 동점 해소용 감점 폭(점). 저축·소비·투자 선호 거리가 멀수록 최대 이만큼 깎아, 같은 점수의 후보가 갈리게 한다.

/**
 * 궁합 총점 가중치 (§7): 금융 습관(저축·소비·투자) · 재무 상태(재산·소득) · 부채 상태 · 생활 조건(지역·나이).
 * 이상형(선호 적합도)은 추천 후보 선정(fit.ts)에만 쓰고 궁합 점수에는 넣지 않는다. 가중치는 초안이다.
 */
export const SCORE_WEIGHTS = { habit: 0.4, finance: 0.2, debt: 0.25, life: 0.15 } as const;

/** 부채 상태: 두 사람의 평균 부담이 최대(둘 다 과부담)일 때 유사도 점수에서 깎는 비율 */
export const DEBT_BURDEN_PENALTY = 0.5;

/** 생활 조건 (§7.4) */
export const LIFE = {
  region: { same: 100, sameZone: 70, other: 40 },
  age: [
    { maxDiff: 3, score: 100 },
    { maxDiff: 6, score: 70 },
  ],
  ageOther: 40,
} as const;

/** 등급 라벨 (§7.5) — min 이상이면 해당 라벨 */
export const GRADES = [
  // color: 점수 게이지 색 (globals.css 의 --grade-* 토큰). 점수가 높을수록 차가운 색 → 따뜻한 색
  { min: 90, label: '천생연분 재테크 메이트', color: 'var(--grade-90)' },
  { min: 80, label: '함께 돈 모으기 좋은 사이', color: 'var(--grade-80)' },
  { min: 70, label: '서로 배우며 맞춰가는 사이', color: 'var(--grade-70)' },
  { min: 60, label: '대화가 필요한 사이', color: 'var(--grade-60)' },
  { min: 0, label: '다른 매력으로 채워가는 사이', color: 'var(--grade-0)' },
] as const;

/** 목업 데이터 생성 (§9.4) */
export const SEED = {
  seed: 'F3',
  total: 3000,
  ageMin: 23,
  ageMax: 45,
  noiseProb: 0.15,
  /** 목업 고객의 원형 비율. 원형은 레벨을 뽑는 데만 쓰고(generate.ts), 페르소나 16종과는 무관하다. */
  personaShare: { SAVER: 0.22, PLANNER: 0.3, GROWER: 0.18, ENJOYER: 0.2, DEBT: 0.1 },
  /** 소비 + 저축 + 투자 + 상환/12 ≤ 월소득 × budgetCap */
  budgetCap: 1.05,
} as const;

/** LLM (§8) */
export const LLM = {
  defaultModel: 'claude-sonnet-5-5',
  timeoutMs: 15_000,
  maxTokens: 4000,
  /** 프롬프트에 넣는 선호 답변 수 (무작위) */
  sampleAnswers: 3,
} as const;
