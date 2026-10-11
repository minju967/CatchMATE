// 지역·권역(§9.2)과 소득 구간(§9.3)

export const REGIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const;

export type Region = (typeof REGIONS)[number];

export const ZONES: Record<string, Region[]> = {
  수도권: ['서울', '경기', '인천'],
  충청권: ['대전', '세종', '충북', '충남'],
  호남권: ['광주', '전북', '전남'],
  영남권: ['부산', '대구', '울산', '경북', '경남'],
  강원: ['강원'],
  제주: ['제주'],
};

const ZONE_OF = Object.fromEntries(
  Object.entries(ZONES).flatMap(([zone, regions]) => regions.map((r) => [r, zone])),
) as Record<string, string>;

export function zoneOf(region: string): string {
  return ZONE_OF[region] ?? region;
}

export function sameZone(a: string, b: string): boolean {
  return zoneOf(a) === zoneOf(b);
}

/** 대략 인구 비례 생성 가중치 (수도권 약 50%) */
export const REGION_WEIGHTS: Record<Region, number> = {
  서울: 18.4, 경기: 26.2, 인천: 5.8, 부산: 6.4, 대구: 4.6, 광주: 2.8, 대전: 2.8, 울산: 2.1, 세종: 0.8,
  강원: 3.0, 충북: 3.1, 충남: 4.1, 전북: 3.4, 전남: 3.5, 경북: 5.0, 경남: 6.3, 제주: 1.3,
};

export const INCOME_BANDS = [
  { band: 1, label: '2,400만 원 미만', min: 0 },
  { band: 2, label: '2,400~3,600만 원', min: 2400 },
  { band: 3, label: '3,600~5,000만 원', min: 3600 },
  { band: 4, label: '5,000~7,000만 원', min: 5000 },
  { band: 5, label: '7,000만 원 이상', min: 7000 },
] as const;

/** 연소득(만원) → 소득 구간 1~5 */
export function incomeBandOf(annualIncome: number): number {
  let band = 1;
  for (const b of INCOME_BANDS) if (annualIncome >= b.min) band = b.band;
  return band;
}

export function incomeBandLabel(band: number): string {
  return INCOME_BANDS.find((b) => b.band === band)?.label ?? '';
}
