import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assignPersona, groupOf, subTag, TRAIT_INDICATORS, type Trait } from '@/lib/assign';
import { PERSONAS, PERSONA_BY_CODE, PERSONA_BY_GROUP, PERSONA_CODES } from '@/lib/personas';
import { loadPersonaRecords, parsePersonaCsv, personaDataPath } from '@/lib/personaData';

const spend = (type: string): Trait => ({ indicator: 'spend_segment_percentile_peer_new', type });
const payment = (type: string): Trait => ({ indicator: 'payment_segment', type });
const category = (type: string): Trait => ({ indicator: 'category_segment_peer', type });
const saving = (type: string): Trait => ({ indicator: 'saving_type_peer', type });
const invest = (type: string): Trait => ({ indicator: 'investment_intensity_type_peer', type });
const portfolio = (type: string): Trait => ({ indicator: 'portfolio_concentration_type', type });

describe('페르소나 정의', () => {
  it('16종이고 코드·그룹 이름이 겹치지 않으며 고객 수 합이 13,852', () => {
    expect(PERSONAS).toHaveLength(16);
    expect(new Set(PERSONA_CODES).size).toBe(16);
    expect(new Set(PERSONAS.map((p) => p.group)).size).toBe(16);
    expect(PERSONAS.reduce((s, p) => s + p.count, 0)).toBe(13852);
    for (const p of PERSONAS) expect(PERSONA_BY_GROUP[p.group]).toBe(p);
  });

  it('특징 지표 6개에 라벨과 영역이 있다', () => {
    expect(Object.keys(TRAIT_INDICATORS)).toHaveLength(6);
  });
});

describe('assignPersona — 주요 특징 1 → 16종', () => {
  it('17개 특징이 16개 페르소나로 정해진다', () => {
    expect(assignPersona({ main1: spend('여유형') })).toBe('P01');
    expect(assignPersona({ main1: spend('과소비형') })).toBe('P02');
    expect(assignPersona({ main1: payment('균형형') })).toBe('P03');
    expect(assignPersona({ main1: category('교육형') })).toBe('P04');
    expect(assignPersona({ main1: category('기타형') })).toBe('P05');
    expect(assignPersona({ main1: payment('현금중심형') })).toBe('P06');
    expect(assignPersona({ main1: category('문화형') })).toBe('P07');
    expect(assignPersona({ main1: category('식비형') })).toBe('P08');
    expect(assignPersona({ main1: portfolio('분산형') })).toBe('P09');
    expect(assignPersona({ main1: saving('알뜰형') })).toBe('P10');
    expect(assignPersona({ main1: invest('소극형') })).toBe('P12');
    expect(assignPersona({ main1: category('생활비형') })).toBe('P13');
    expect(assignPersona({ main1: saving('소비형') })).toBe('P14');
    expect(assignPersona({ main1: spend('적정형') })).toBe('P15');
    expect(assignPersona({ main1: portfolio('중간형') })).toBe('P16');
  });

  it('투자 적극성의 적극형과 보통형은 같은 페르소나(투자 가속 엔진)', () => {
    expect(assignPersona({ main1: invest('적극형') })).toBe('P11');
    expect(assignPersona({ main1: invest('보통형') })).toBe('P11');
  });

  it('다수형(계획형·카드중심형·집중형)은 주요 특징이 될 수 없어 null', () => {
    expect(assignPersona({ main1: saving('계획형') })).toBeNull();
    expect(assignPersona({ main1: payment('카드중심형') })).toBeNull();
    expect(assignPersona({ main1: portfolio('집중형') })).toBeNull();
    expect(groupOf(saving('계획형'))).toBeUndefined();
  });

  it('지표까지 맞아야 한다 (같은 유형 이름이어도 지표가 다르면 규칙에 없음)', () => {
    expect(assignPersona({ main1: category('여유형') })).toBeNull();
  });

  it('그룹 이름이 페르소나와 일치한다', () => {
    expect(groupOf(invest('적극형'))).toBe(PERSONA_BY_CODE.P11.group);
    expect(groupOf(spend('여유형'))).toBe(PERSONA_BY_CODE.P01.group);
  });
});

describe('subTag — 보조 성향 태그', () => {
  it('특징이 될 수 있는 17개 유형 모두 이름이 있다', () => {
    const types: [string, string][] = [['saving_type_peer', '알뜰형'], ['saving_type_peer', '소비형'], ['spend_segment_percentile_peer_new', '여유형'], ['spend_segment_percentile_peer_new', '적정형'], ['spend_segment_percentile_peer_new', '과소비형'], ['payment_segment', '현금중심형'], ['payment_segment', '균형형'], ['category_segment_peer', '식비형'], ['category_segment_peer', '문화형'], ['category_segment_peer', '교육형'], ['category_segment_peer', '생활비형'], ['category_segment_peer', '기타형'], ['investment_intensity_type_peer', '소극형'], ['investment_intensity_type_peer', '보통형'], ['investment_intensity_type_peer', '적극형'], ['portfolio_concentration_type', '분산형'], ['portfolio_concentration_type', '중간형']];
    for (const [indicator, type] of types) {
      const tag = subTag({ main1: spend('여유형'), main2: { indicator: indicator as Trait['indicator'], type }, aux: saving('계획형') });
      expect(tag?.name, type).not.toBe(type);
    }
  });

  const traits = (main2: Trait, aux: Trait) => ({ main1: spend('여유형'), main2, aux });

  it('주요 특징 2를 쓰고 라벨을 붙인다', () => {
    expect(subTag(traits(category('식비형'), saving('소비형')))).toEqual({ name: '맛집 탐험가', label: '소비 구성', type: '식비형' });
  });

  it('주요 특징 2가 다수형이면 보조 특징으로 대체, 둘 다 다수형이면 null', () => {
    expect(subTag(traits(saving('계획형'), payment('현금중심형')))).toEqual({ name: '통장 잔고 지킴이', label: '소비 방식', type: '현금중심형' });
    expect(subTag(traits(saving('계획형'), payment('카드중심형')))).toBeNull();
  });
});

describe('실데이터와의 일치 (data/persona/customer_persona.csv)', () => {
  const file = personaDataPath();
  const exists = fs.existsSync(file);

  it.skipIf(!exists)('13,852명 모두 주요 특징 1로 페르소나가 정해진다', () => {
    const records = loadPersonaRecords(file);
    expect(records.size).toBe(13852);
    for (const r of records.values()) expect(r.persona).toBe(assignPersona(r.traits));
  });

  it.skipIf(!exists)('페르소나별 인원이 문서와 같다', () => {
    const count = new Map<string, number>();
    for (const r of loadPersonaRecords(file).values()) count.set(r.persona, (count.get(r.persona) ?? 0) + 1);
    for (const p of PERSONAS) expect(count.get(p.code), p.name).toBe(p.count);
  });
});

describe('parsePersonaCsv', () => {
  const head = 'customer_id,main1_indicator,main1_type,main2_indicator,main2_type,aux_indicator,aux_type,peer_income_percentile_peer,asset_quintile_peer,saving_type_peer,spend_segment_percentile_peer_new,payment_segment,category_segment_peer,investment_intensity_type_peer,portfolio_concentration_type';

  it('한 줄을 페르소나·특징·재무 상태로 읽는다', () => {
    const row = '18,payment_segment,균형형,investment_intensity_type_peer,보통형,category_segment_peer,문화형,35.1,2분위,계획형,적정형,균형형,문화형,보통형,집중형';
    const r = parsePersonaCsv(`${head}\n${row}\n`).get('18')!;
    expect(r.persona).toBe('P03');
    expect(r.traits.main1).toEqual({ indicator: 'payment_segment', type: '균형형' });
    expect(r.traits.aux).toEqual({ indicator: 'category_segment_peer', type: '문화형' });
    expect(r.habits).toEqual({ S: '계획', V: '적정', P: '균형', C: '문화', I: '보통', D: '집중' });
    expect(r.finance).toBe('ALIGNED'); // 소득 2분위(35.1), 재산 2분위
  });

  it('페르소나를 정할 수 없는 주요 특징이나 알 수 없는 지표는 오류', () => {
    expect(() => parsePersonaCsv(`${head}\n1,saving_type_peer,계획형,payment_segment,균형형,payment_segment,균형형,10,1분위,계획형,적정형,균형형,문화형,보통형,집중형\n`)).toThrow('페르소나를 정할 수 없는');
    expect(() => parsePersonaCsv(`${head}\n1,nope,균형형,payment_segment,균형형,payment_segment,균형형,10,1분위,계획형,적정형,균형형,문화형,보통형,집중형\n`)).toThrow('알 수 없는 특징');
  });
});
