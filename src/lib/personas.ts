// 금융 습관 페르소나 16종 (data/persona/persona_v2_summary.md, v2).
// 이름은 가칭이다. 이름·설명을 바꾸려면 이 파일의 PERSONAS 만 고치면 된다.
// 페르소나 = 고객의 주요 특징 1(또래 대비 희소한 카테고리)이 속한 그룹. 판정 규칙은 assign.ts 에 있다.

export type PersonaCode =
  | 'P01' | 'P02' | 'P03' | 'P04' | 'P05' | 'P06' | 'P07' | 'P08'
  | 'P09' | 'P10' | 'P11' | 'P12' | 'P13' | 'P14' | 'P15' | 'P16';

/** 화면 색·아이콘을 고르는 분류 (페르소나 16종을 다섯 갈래로 묶는다) */
export type PersonaTone = 'SAVER' | 'PLANNER' | 'GROWER' | 'ENJOYER' | 'NEUTRAL';

export interface Persona {
  code: PersonaCode;
  /** 서비스에 표시하는 이름(가칭) */
  name: string;
  /** 분류 그룹 이름 (주요 특징 1 → 그룹, assign.ts 의 GROUP_BY_MAIN1 값) */
  group: string;
  /** 그룹의 핵심 구분 */
  summary: string;
  tone: PersonaTone;
  /** 13,852명 기준 고객 수. 목업 데이터의 비율에만 쓴다. */
  count: number;
  /** globals.css 의 CSS 변수 이름 (페르소나마다 하나, 라이트/다크 값이 따로 정의됨) */
  colorVar: string;
}

type Def = [code: PersonaCode, name: string, group: string, tone: PersonaTone, count: number, summary: string];

const DEFS: Def[] = [
  ['P01', '지갑 잠금 전문가', '지출 브레이크형', 'SAVER', 2391, '소비 규모가 또래보다 낮은 여유형'],
  ['P02', '월급 삭제 마법사', '지출 가속 페달형', 'ENJOYER', 2262, '소비 규모가 또래보다 큰 과소비형'],
  ['P03', '결제 밸런스 장인', '결제 수단 균형형', 'PLANNER', 1917, '카드와 현금을 균형 있게 쓰는 결제 습관'],
  ['P04', '배움에 진심인 사람', '배움에 진심형', 'NEUTRAL', 1743, '교육 지출 비중이 높은 소비 구성'],
  ['P05', '취향 탐험가', '취향은 기타에형', 'ENJOYER', 1328, '기타 카테고리 지출 비중이 높은 소비 구성'],
  ['P06', '현금 결제 원칙주의자', '현금이 편한 사람형', 'PLANNER', 1018, '현금 결제 중심의 소비 방식'],
  ['P07', '문화생활 수호자', '문화생활 우선형', 'ENJOYER', 681, '문화 지출 비중이 높은 소비 구성'],
  ['P08', '맛있는 인생 설계자', '먹는 즐거움형', 'ENJOYER', 603, '식비 지출 비중이 높은 소비 구성'],
  ['P09', '계란 분산 전문가', '계란은 여러 바구니형', 'GROWER', 566, '분산 투자 중심의 포트폴리오'],
  ['P10', '티끌 모아 금고왕', '티끌 모아 큰돈형', 'SAVER', 401, '알뜰형 저축 성향'],
  ['P11', '투자 가속 엔진', '꾸준한 투자 실천형', 'GROWER', 235, '투자 적극형·보통형'],
  ['P12', '투자 신중파', '신중한 투자 관망형', 'GROWER', 229, '투자 소극형'],
  ['P13', '생활비 방어대장', '생활에 충실형', 'PLANNER', 212, '생활비 지출 비중이 높은 소비 구성'],
  ['P14', '오늘을 즐기는 지갑', '오늘도 소비 우선형', 'ENJOYER', 131, '소비형 저축 성향'],
  ['P15', '적당함의 달인', '중간 속도 소비형', 'PLANNER', 74, '소비 규모가 또래 수준인 적정형'],
  ['P16', '포트폴리오 중용파', '선택과 집중 투자형', 'GROWER', 61, '포트폴리오 집중도가 중간형인 투자'],
];

export const PERSONAS: Persona[] = DEFS.map(([code, name, group, tone, count, summary]) => ({
  code,
  name,
  group,
  summary,
  tone,
  count,
  colorVar: `--p-${code.slice(1)}`,
}));

export const PERSONA_BY_CODE = Object.fromEntries(PERSONAS.map((p) => [p.code, p])) as Record<PersonaCode, Persona>;
export const PERSONA_BY_GROUP = Object.fromEntries(PERSONAS.map((p) => [p.group, p])) as Record<string, Persona>;
export const PERSONA_CODES = PERSONAS.map((p) => p.code);

export function personaName(code: PersonaCode): string {
  return PERSONA_BY_CODE[code].name;
}
