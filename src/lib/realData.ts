import { peerPositions, percentileRanks, quantileLevel, roundPercent, type Levels, type Ratios } from './axes';
import { LEVEL_THRESHOLDS, PEER_AGE_RANGE } from './config';
import type { PersonaRecord } from './personaData';
import type { Customer, Gender } from './types';

// 실데이터(integrated_feature_df)의 한 행 → Customer 변환. CSV 문자열과 MySQL 조회 결과(숫자·null) 모두 받는다.
export type RawRow = Record<string, string | number | null | undefined>;

export interface Thresholds {
  savingRate: readonly number[];
  spendingRate: readonly number[];
  investmentRatio: readonly number[];
  dsr: readonly number[];
}

const REGION: Record<string, string> = {
  서울특별시: '서울', 경기도: '경기', 인천광역시: '인천', 부산광역시: '부산', 대구광역시: '대구', 대전광역시: '대전',
  울산광역시: '울산', 세종특별자치시: '세종', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남',
  전북특별자치도: '전북', 전남광주통합특별시: '광주', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주',
};
const BAND: Record<string, number> = { LOW: 1, LOW_MID: 2, MID: 3, HIGH_MID: 4, HIGH: 5 };

const bucket = (v: number, bounds: readonly number[]) => bounds.reduce((n, b) => n + (v >= b ? 1 : 0), 0);
const num = (v: string | number | null | undefined) => (v === undefined || v === null || v === '' ? NaN : Number(v));
const str = (v: string | number | null | undefined) => (v === undefined || v === null ? '' : String(v));

/**
 * 재산(원). 원본의 total_asset 은 부동산 + 주식 + 현금 + 예·적금 + 투자 예수금인데, 현금 잔액이 절반 가까이 음수로 들어 있다
 * (대출·마이너스 통장이 없는 사람도). 현금이 음수일 수는 없으므로 0 으로 보고 다시 합산한다.
 */
const assetOf = (r: RawRow) => num(r.total_asset) - Math.min(0, num(r.cash_balance) || 0);

/** 또래 = 본인 나이 ± PEER_AGE_RANGE 세 (성별 무관). 나이 → 그 또래에 속하는 행 번호 */
function peerIndex(ages: number[], include?: boolean[]): Map<number, number[]> {
  const byAge = new Map<number, number[]>();
  ages.forEach((a, i) => {
    if (include && !include[i]) return;
    const list = byAge.get(a);
    if (list) list.push(i);
    else byAge.set(a, [i]);
  });
  const peers = new Map<number, number[]>();
  for (const age of byAge.keys()) {
    const idx: number[] = [];
    for (let a = age - PEER_AGE_RANGE; a <= age + PEER_AGE_RANGE; a += 1) idx.push(...(byAge.get(a) ?? []));
    peers.set(age, idx);
  }
  return peers;
}

/**
 * 또래 안 분위수(또래 중 자기보다 값이 작은 사람의 비율 × 100).
 * include 가 false 인 행은 비교군에서도 빠지고 결과는 NaN (예: 투자 비율은 투자자끼리만 비교).
 */
function peerPercentiles(ages: number[], values: number[], include?: boolean[]): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  for (const [age, idx] of peerIndex(ages, include)) {
    const ranks = percentileRanks(idx.map((i) => values[i]));
    idx.forEach((i, k) => {
      if (ages[i] === age) out[i] = ranks[k];
    });
  }
  return out;
}

/**
 * 비율 경계값(예: 저축률 8%, 15%)이 전체 고객에서 몇 분위에 해당하는지로 바꾼다.
 * 이 분위를 또래 안 분위수에 적용하면 "전체의 하위 1/3" 이 아니라 "또래의 하위 1/3" 이 낮음이 된다.
 */
function quantileBounds(values: number[], bounds: readonly number[], include?: boolean[]): number[] {
  const pool = include ? values.filter((_, i) => include[i]) : values;
  return bounds.map((b) => (pool.filter((v) => v < b).length / Math.max(1, pool.length)) * 100);
}

/**
 * @param personas 고객 ID(customer_id) → 페르소나·대표 특징·재무 상태. 없는 고객이 있으면 오류를 던진다.
 *   페르소나는 레벨로 계산하지 않고 이 매핑 결과를 그대로 쓴다(personaData.ts).
 */
export function toCustomers(rows: RawRow[], personas: Map<string, PersonaRecord>, th: Thresholds = LEVEL_THRESHOLDS): Customer[] {
  // 추천이 비슷한 나이끼리 이뤄지므로 저축·소비·투자·재산 레벨은 전체 고객이 아니라 또래 안 위치로 정한다.
  // (소득은 원본 peer_income_percentile 이 이미 같은 또래 기준이고, 부채는 DSR 절대 수준 그대로 쓴다.)
  const ages = rows.map((r) => Number(r.korea_age));
  const savingRate = rows.map((r) => num(r.saving_rate_pct) / 100);
  const spendingRate = rows.map((r) => num(r.spend_to_income_ratio));
  const invRatios = rows.map((r) => num(r.investment_disposable_income_ratio));
  const investedAll = rows.map((r, i) => num(r.is_stock_investor) === 1 && invRatios[i] > 0);

  const savingPct = peerPercentiles(ages, savingRate);
  const spendingPct = peerPercentiles(ages, spendingRate);
  const investmentPct = peerPercentiles(ages, invRatios, investedAll);
  // 재산은 마이너스 현금을 0 으로 본 값(assetOf)의 또래 안 분위수
  const assetPct = peerPercentiles(ages, rows.map(assetOf));

  const savingBounds = quantileBounds(savingRate, th.savingRate);
  const spendingBounds = quantileBounds(spendingRate, th.spendingRate);
  const investmentBounds = quantileBounds(invRatios, th.investmentRatio, investedAll);

  const customers = rows.map((r, i): Customer => {
    const invRatio = invRatios[i];
    const invested = investedAll[i];
    const hasDebt = num(r.total_financial_debt) > 0 || num(r.annual_debt_service) > 0;
    const levels: Levels = {
      saving: bucket(savingPct[i], savingBounds),
      spending: bucket(spendingPct[i], spendingBounds),
      investment: invested ? 1 + bucket(investmentPct[i], investmentBounds) : 0,
      asset: quantileLevel(assetPct[i]),
      income: quantileLevel(num(r.peer_income_percentile)),
      debt: hasDebt ? 1 + bucket(num(r.dsr_income), th.dsr) : 0,
    };
    const ratios: Ratios = {
      saving: roundPercent(num(r.saving_rate_pct)),
      spending: roundPercent(num(r.spend_to_income_ratio) * 100),
      investment: invested ? roundPercent(invRatio * 100) : 0,
      asset: roundPercent(assetPct[i]),
      income: roundPercent(num(r.peer_income_percentile)),
      debt: hasDebt ? roundPercent(num(r.dsr_income) * 100) : 0,
    };
    const record = personas.get(str(r.customer_id));
    if (!record) throw new Error(`고객 ${str(r.customer_id)} 의 페르소나 매핑이 없어요. data/persona 를 확인하세요.`);
    const won = (v: string | number | null | undefined) => Math.round(num(v) / 10000) || 0; // 원 → 만원
    const region = str(r.region_merged);
    return {
      id: `R${r.customer_id}`,
      nickname: str(r.name),
      gender: str(r.gender) as Gender,
      region: REGION[region] ?? region,
      age: Number(r.korea_age),
      incomeBand: BAND[str(r.income_band)],
      annualIncome: won(r.disposable_annual_income),
      monthlyIncome: won(r.disposable_monthly_income),
      monthlySpending: won(r.avg_monthly_total_spend),
      monthlySaving: won(r.avg_monthly_saving),
      monthlyInvestment: invested ? Math.round(num(r.investment_12m) / 12 / 10000) || 0 : 0,
      totalAsset: won(assetOf(r)),
      totalDebt: won(r.total_financial_debt),
      annualRepayment: won(r.annual_debt_service),
      levels,
      ratios,
      persona: record.persona,
      traits: record.traits,
      habits: record.habits,
      finance: record.finance,
    };
  });

  // 또래(본인 나이 ± PEER_AGE_RANGE 세) 안에서 축별 금액이 몇 번째쯤인지
  for (const [age, idx] of peerIndex(ages)) {
    const peerAges = idx.map((i) => ages[i]);
    const positions = peerPositions(
      `${Math.min(...peerAges)}-${Math.max(...peerAges)}`,
      idx.map((i) => {
        const c = customers[i];
        return { saving: c.monthlySaving, spending: c.monthlySpending, investment: c.monthlyInvestment, asset: c.totalAsset, income: c.monthlyIncome, debt: c.totalDebt };
      }),
    );
    idx.forEach((i, k) => {
      if (ages[i] === age) customers[i].peer = positions[k];
    });
  }
  return customers;
}
