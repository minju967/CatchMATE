import type { Traits } from './assign';
import type { Levels, PeerPosition, Ratios } from './axes';
import type { FinanceCode } from './finance';
import type { HabitLevels } from './habits';
import type { PersonaCode } from './personas';

export type Gender = 'M' | 'F';

/** DB 한 행. 금액(만원) 필드는 서버 내부 계산 전용이다. */
export interface Customer {
  id: string;
  nickname: string;
  gender: Gender;
  region: string;
  age: number;
  incomeBand: number;
  annualIncome: number;
  monthlyIncome: number;
  monthlySpending: number;
  monthlySaving: number;
  monthlyInvestment: number;
  totalAsset: number;
  totalDebt: number;
  annualRepayment: number;
  levels: Levels;
  ratios: Ratios;
  /** 축별 금액과 같은 연령대 안에서의 위치. 실데이터에서만 채운다. */
  peer?: PeerPosition;
  /** 금융 습관 페르소나 (16종) */
  persona: PersonaCode;
  /** 페르소나를 정한 대표 특징(주요 2 + 보조 1). 목업 데이터에는 없다. */
  traits?: Traits;
  /** 금융 습관 6지표의 실제 수준 (추천용, 서버 전용). 목업 데이터에는 없다. */
  habits?: HabitLevels;
  /** 재무 상태 유형 (소득·재산 분위 차이) */
  finance: FinanceCode;
}

/** 클라이언트로 내려가는 카드. 레벨·페르소나·재무 상태만 담고 원천 금액은 담지 않는다. */
export interface CustomerCard {
  id: string;
  nickname: string;
  gender: Gender;
  age: number;
  region: string;
  incomeBand: number;
  persona: PersonaCode;
  traits?: Traits;
  /** 금융 습관 6지표의 유형 이름(라벨만). 추천 이유 생성에 쓴다. 목업 데이터에는 없다. */
  habits?: HabitLevels;
  finance: FinanceCode;
  levels: Levels;
  /** 축별 실제 수치(%) — 비율만 담고 원천 금액은 담지 않는다 */
  ratios: Ratios;
  peer?: PeerPosition;
}

export function toCard(c: Customer): CustomerCard {
  return {
    id: c.id,
    nickname: c.nickname,
    gender: c.gender,
    age: c.age,
    region: c.region,
    incomeBand: c.incomeBand,
    persona: c.persona,
    ...(c.traits && { traits: c.traits }),
    ...(c.habits && { habits: c.habits }),
    finance: c.finance,
    levels: { ...c.levels },
    ratios: { ...c.ratios },
    ...(c.peer && { peer: c.peer }),
  };
}

export type Rng = () => number;
