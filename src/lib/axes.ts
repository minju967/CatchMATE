import { AXIS_WEIGHTS, LEVEL_THRESHOLDS } from './config';

export type AxisKey = 'saving' | 'spending' | 'investment' | 'asset' | 'income' | 'debt';

export interface AxisDef {
  key: AxisKey;
  part: string;
  labels: string[];
  nLevels: number;
  weight: number;
}

function axis(key: AxisKey, part: string, labels: string[]): AxisDef {
  return { key, part, labels, nLevels: labels.length, weight: AXIS_WEIGHTS[key] };
}

/** 3 × 3 × 5 × 3 × 3 × 4 = 1,620 조합 */
export const AXES: AxisDef[] = [
  axis('saving', '저축', ['낮음', '보통', '높음']),
  axis('spending', '소비', ['절제', '적정', '여유']),
  axis('investment', '투자', ['미투자', '소극', '보통', '적극', '매우 적극']),
  axis('asset', '재산', ['하위', '중위', '상위']),
  axis('income', '소득', ['하위', '중위', '상위']),
  axis('debt', '부채', ['무부채', '저부담', '관리형', '과부담']),
];

export const AXIS_KEYS = AXES.map((a) => a.key);
export const AXIS_BY_KEY = Object.fromEntries(AXES.map((a) => [a.key, a])) as Record<AxisKey, AxisDef>;

/** 화면에 보여주는 순서: 버는 돈 → 가진 돈 → 모으는 돈 → 쓰는 돈 → 빚. 계산은 순서와 무관하다. */
export const DISPLAY_AXIS_KEYS: AxisKey[] = ['income', 'asset', 'saving', 'investment', 'spending', 'debt'];
export const DISPLAY_AXES: AxisDef[] = DISPLAY_AXIS_KEYS.map((k) => AXIS_BY_KEY[k]);

/** 고객은 정수, 선호 벡터는 실수 또는 null(응답 없음) */
export type Levels = Record<AxisKey, number>;
export type PrefLevels = Record<AxisKey, number | null>;

/**
 * 축별 실제 수치(%, 0~100). 카드 표시 전용이며 매칭 계산은 레벨을 쓴다.
 * 저축률·소비율(월소득 대비), 투자 비율(가처분소득 대비), 부채는 DSR(연소득 대비 연 상환액),
 * 재산·소득은 또래(본인 나이 ±1세) 안 분위수.
 */
export type Ratios = Record<AxisKey, number>;

/** 한 축의 실제 금액과 또래(본인 나이 ±1세) 안 위치 */
export interface PeerAxis {
  /** 만원. 저축·소비·투자·소득은 월 금액, 재산·부채는 총액 */
  amount: number;
  /** 백분위: 또래 중 이 금액보다 낮은 사람의 비율 (0~100 정수) */
  pct: number;
}

export interface PeerPosition {
  /** 또래 나이 범위 라벨 (예: "30-32") */
  group: string;
  size: number;
  axes: Record<AxisKey, PeerAxis>;
}

/** 같은 또래의 축별 금액 목록 → 각 사람의 금액과 또래 안 백분위 (입력과 같은 순서) */
export function peerPositions(group: string, amounts: Record<AxisKey, number>[]): PeerPosition[] {
  const keys = Object.keys(amounts[0] ?? {}) as AxisKey[];
  const ranks = keys.map((key) => percentileRanks(amounts.map((a) => a[key])));
  return amounts.map((a, i) => ({
    group,
    size: amounts.length,
    axes: Object.fromEntries(keys.map((key, k) => [key, { amount: a[key], pct: Math.round(ranks[k][i]) }])) as Record<AxisKey, PeerAxis>,
  }));
}

const pct1 = (v: number) => Math.round(Math.max(0, Math.min(100, v * 100)) * 10) / 10;

/** 분위수가 필요 없는 4개 축의 실제 비율(%) */
export function flowRatios(raw: RawFinance): Pick<Ratios, 'saving' | 'spending' | 'investment' | 'debt'> {
  return {
    saving: pct1(raw.monthlySaving / raw.monthlyIncome),
    spending: pct1(raw.monthlySpending / raw.monthlyIncome),
    investment: pct1(investmentRatio(raw)),
    debt: pct1(raw.annualRepayment / raw.annualIncome),
  };
}

export const roundPercent = (v: number) => Math.round(Math.max(0, Math.min(100, v)) * 10) / 10;

export function levelLabel(key: AxisKey, level: number): string {
  const def = AXIS_BY_KEY[key];
  return def.labels[Math.max(0, Math.min(def.nLevels - 1, Math.round(level)))];
}

/** 레이더·막대용 0~100 정규화 */
export function levelPercent(key: AxisKey, level: number): number {
  return (level / (AXIS_BY_KEY[key].nLevels - 1)) * 100;
}

// ── 원천 지표 → 레벨 ──────────────────────────────────────────────

/** 경계 배열에서 value 가 넘어선 경계 수 = 레벨 */
function bucket(value: number, bounds: readonly number[]): number {
  let lv = 0;
  for (const b of bounds) if (value >= b) lv += 1;
  return lv;
}

export interface RawFinance {
  monthlyIncome: number;
  monthlySpending: number;
  monthlySaving: number;
  monthlyInvestment: number;
  annualIncome: number;
  totalDebt: number;
  annualRepayment: number;
}

/** 가처분소득 = 월소득 − 월소비 (README "구현 결정 사항" 참고) */
export function investmentRatio(raw: Pick<RawFinance, 'monthlyIncome' | 'monthlySpending' | 'monthlyInvestment'>): number {
  if (raw.monthlyInvestment <= 0) return 0;
  const disposable = Math.max(1, raw.monthlyIncome - raw.monthlySpending);
  return raw.monthlyInvestment / disposable;
}

/** 분위수가 필요 없는 4개 축 레벨 */
export function flowLevels(raw: RawFinance): Pick<Levels, 'saving' | 'spending' | 'investment' | 'debt'> {
  const inv = investmentRatio(raw);
  const hasDebt = raw.totalDebt > 0 || raw.annualRepayment > 0;
  return {
    saving: bucket(raw.monthlySaving / raw.monthlyIncome, LEVEL_THRESHOLDS.savingRate),
    spending: bucket(raw.monthlySpending / raw.monthlyIncome, LEVEL_THRESHOLDS.spendingRate),
    investment: inv <= 0 ? 0 : 1 + bucket(inv, LEVEL_THRESHOLDS.investmentRatio),
    debt: hasDebt ? 1 + bucket(raw.annualRepayment / raw.annualIncome, LEVEL_THRESHOLDS.dsr) : 0,
  };
}

/** 분위수(0~100) → 재산·소득 레벨 */
export function quantileLevel(percentile: number): number {
  return bucket(percentile, LEVEL_THRESHOLDS.quantile);
}

/** values 안에서 각 값의 분위수(자기보다 작은 값의 비율 × 100) */
export function percentileRanks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return values.map((v) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    return (lo / sorted.length) * 100;
  });
}
