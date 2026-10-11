// 재무 상태 유형 — 소득 분위와 재산 분위(모두 또래 대비 5분위)의 차이로 정한다.
// 금융 습관 페르소나와는 별개이며, 추천 후보 카드에 태그로 보여준다.

export type FinanceCode = 'INCOME_FAR' | 'INCOME_NEAR' | 'ALIGNED' | 'ASSET_NEAR' | 'ASSET_FAR' | 'CASH_CHECK';

export interface FinanceType {
  code: FinanceCode;
  name: string;
  /** 판정 조건(문서용) */
  rule: string;
}

export const FINANCE_TYPES: FinanceType[] = [
  { code: 'INCOME_FAR', name: '소득 쭉쭉형', rule: '소득 분위 − 재산 분위 ≥ +2' },
  { code: 'INCOME_NEAR', name: '소득 쑥쑥형', rule: '소득 분위 − 재산 분위 = +1' },
  { code: 'ALIGNED', name: '나란히형', rule: '소득 분위 = 재산 분위' },
  { code: 'ASSET_NEAR', name: '자산 쑥쑥형', rule: '소득 분위 − 재산 분위 = −1' },
  { code: 'ASSET_FAR', name: '자산 쭉쭉형', rule: '소득 분위 − 재산 분위 ≤ −2' },
  { code: 'CASH_CHECK', name: '잔고 점검형', rule: '재산 분위가 "무자산"(총재산이 마이너스)' },
];

export const FINANCE_BY_CODE = Object.fromEntries(FINANCE_TYPES.map((f) => [f.code, f])) as Record<FinanceCode, FinanceType>;

export const financeName = (code: FinanceCode): string => FINANCE_BY_CODE[code].name;

/** 또래 소득 백분위(0~100) → 소득 5분위(1~5). 100 은 5분위에 넣는다. */
export const incomeQuintile = (percentile: number): number => Math.min(5, Math.floor(percentile / 20) + 1);

/** 재산 분위 원본 값('1분위'~'5분위', '무자산') → 1~5. 무자산이면 null. */
export function assetQuintileOf(label: string): number | null {
  if (label === '무자산') return null;
  const m = /^([1-5])분위$/.exec(label.trim());
  if (!m) throw new Error(`알 수 없는 재산 분위 값: "${label}"`);
  return Number(m[1]);
}

/** 소득 백분위와 재산 분위 값으로 재무 상태 유형을 정한다 */
export function financeStatus(incomePercentile: number, assetQuintileLabel: string): FinanceCode {
  if (!Number.isFinite(incomePercentile)) throw new Error(`소득 백분위가 숫자가 아니에요: ${incomePercentile}`);
  const asset = assetQuintileOf(assetQuintileLabel);
  if (asset === null) return 'CASH_CHECK';
  const gap = incomeQuintile(incomePercentile) - asset;
  if (gap >= 2) return 'INCOME_FAR';
  if (gap === 1) return 'INCOME_NEAR';
  if (gap === 0) return 'ALIGNED';
  if (gap === -1) return 'ASSET_NEAR';
  return 'ASSET_FAR';
}
