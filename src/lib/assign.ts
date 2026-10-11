import { PERSONA_BY_GROUP, type PersonaCode } from './personas';

// 금융 습관 페르소나 판정 (v2, data/persona/persona_v2_summary.md).
// 고객의 대표 특징(주요 특징 1·2, 보조 특징)은 또래 대비 희소성으로 미리 뽑아 두고(data/persona 매핑),
// 여기서는 주요 특징 1 하나로 16개 페르소나를 정한다. 실제 13,852명 전원에서 같은 결과인지 tests/assign.test.ts 가 확인한다.
// 주요 특징 2는 페르소나를 쪼개지 않고, 후보 카드에 보조 성향 태그로만 보여 준다(subTag).

/** 특징을 뽑는 6개 지표 */
export type TraitIndicator =
  | 'saving_type_peer'
  | 'spend_segment_percentile_peer_new'
  | 'category_segment_peer'
  | 'payment_segment'
  | 'investment_intensity_type_peer'
  | 'portfolio_concentration_type';

export interface Trait {
  indicator: TraitIndicator;
  /** 지표의 실제 유형 (예: '과소비형', '현금중심형') */
  type: string;
}

/** 고객 한 명의 대표 특징 */
export interface Traits {
  main1: Trait;
  main2: Trait;
  aux: Trait;
}

export const TRAIT_INDICATORS: Record<TraitIndicator, { label: string; domain: '저축' | '소비' | '투자' }> = {
  saving_type_peer: { label: '저축 성향', domain: '저축' },
  spend_segment_percentile_peer_new: { label: '소비 규모', domain: '소비' },
  category_segment_peer: { label: '소비 구성', domain: '소비' },
  payment_segment: { label: '소비 방식', domain: '소비' },
  investment_intensity_type_peer: { label: '투자 적극성', domain: '투자' },
  portfolio_concentration_type: { label: '포트폴리오 집중도', domain: '투자' },
};

export const isTraitIndicator = (v: string): v is TraitIndicator => v in TRAIT_INDICATORS;

const traitKey = (t: Trait) => `${t.indicator}|${t.type}`;

/** 주요 특징 1 → 16개 그룹. 투자 적극성의 적극형·보통형은 한 그룹이다. */
const GROUP_BY_MAIN1: Record<string, string> = {
  'spend_segment_percentile_peer_new|여유형': '지출 브레이크형',
  'spend_segment_percentile_peer_new|과소비형': '지출 가속 페달형',
  'spend_segment_percentile_peer_new|적정형': '중간 속도 소비형',
  'payment_segment|균형형': '결제 수단 균형형',
  'payment_segment|현금중심형': '현금이 편한 사람형',
  'category_segment_peer|교육형': '배움에 진심형',
  'category_segment_peer|기타형': '취향은 기타에형',
  'category_segment_peer|문화형': '문화생활 우선형',
  'category_segment_peer|식비형': '먹는 즐거움형',
  'category_segment_peer|생활비형': '생활에 충실형',
  'portfolio_concentration_type|분산형': '계란은 여러 바구니형',
  'portfolio_concentration_type|중간형': '선택과 집중 투자형',
  'saving_type_peer|알뜰형': '티끌 모아 큰돈형',
  'saving_type_peer|소비형': '오늘도 소비 우선형',
  'investment_intensity_type_peer|적극형': '꾸준한 투자 실천형',
  'investment_intensity_type_peer|보통형': '꾸준한 투자 실천형',
  'investment_intensity_type_peer|소극형': '신중한 투자 관망형',
};

/** 주요 특징 1 → 그룹 이름. 규칙에 없는 특징(계획형·카드중심형·집중형 등 다수형)이면 undefined. */
export function groupOf(main1: Trait): string | undefined {
  return GROUP_BY_MAIN1[traitKey(main1)];
}

/** 주요 특징 1로 페르소나를 정한다. 규칙에 없는 특징이면 null. */
export function assignPersona({ main1 }: { main1: Trait }): PersonaCode | null {
  const group = groupOf(main1);
  return group ? PERSONA_BY_GROUP[group].code : null;
}

/** 대부분의 사람이 해당돼서 특징으로 쓰지 않는 유형 */
const MAJORITY_TYPES = new Set(['계획형', '카드중심형', '집중형']);

/** 보조 성향 태그 이름 (특징이 될 수 있는 17개 유형). 이름만 바꾸려면 여기만 고친다. */
const TAG_NAMES: Record<string, string> = {
  'saving_type_peer|알뜰형': '저금통 지킴이',
  'saving_type_peer|소비형': '쓰는 맛이 있는 사람',
  'spend_segment_percentile_peer_new|여유형': '알뜰살뜰 절제파',
  'spend_segment_percentile_peer_new|적정형': '적당히 쓰는 사람',
  'spend_segment_percentile_peer_new|과소비형': '통 크게 쓰는 사람',
  'payment_segment|현금중심형': '통장 잔고 지킴이',
  'payment_segment|균형형': '결제 수단 밸런서',
  'category_segment_peer|식비형': '맛집 탐험가',
  'category_segment_peer|문화형': '공연·여행 수집가',
  'category_segment_peer|교육형': '자기계발 러버',
  'category_segment_peer|생활비형': '집밥·생활템 챙김이',
  'category_segment_peer|기타형': '나만의 덕질러',
  'investment_intensity_type_peer|소극형': '안전제일 투자자',
  'investment_intensity_type_peer|보통형': '적금 옆 투자 한 스푼',
  'investment_intensity_type_peer|적극형': '수익률 사냥꾼',
  'portfolio_concentration_type|분산형': '분산투자 장인',
  'portfolio_concentration_type|중간형': '적당히 골라 담기',
};

/** 후보 카드에 보여 주는 보조 성향 태그: 주요 특징 2, 다수형이면 보조 특징. 없으면 null. name 은 화면에 쓰는 재미있는 이름. */
export function subTag(traits: Traits): { name: string; label: string; type: string } | null {
  const t = [traits.main2, traits.aux].find((x) => !MAJORITY_TYPES.has(x.type));
  if (!t) return null;
  const type = t.type;
  return { name: TAG_NAMES[traitKey(t)] ?? type, label: TRAIT_INDICATORS[t.indicator].label, type };
}
