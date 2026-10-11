import seedrandom from 'seedrandom';
import { describe, expect, it } from 'vitest';
import { PARTNER_AGE_WINDOW, partnerRegionOk } from '@/lib/config';
import { generateCustomers } from '@/lib/generate';
import { computePreference } from '@/lib/preference';
import { pickVirtualMe, recommendPartners } from '@/lib/recommend';
import type { Customer } from '@/lib/types';

const base = generateCustomers(1)[0];
let seq = 0;
const make = (over: Partial<Customer>): Customer => {
  seq += 1;
  return { ...base, id: `T${seq}`, nickname: `닉${seq}`, persona: 'P15', incomeBand: 3, region: '서울', ...over };
};
const many = (n: number, over: Partial<Customer>) => Array.from({ length: n }, () => make(over));
const preference = computePreference({ Q1: 'B', Q2: 'B', Q3: 'B', Q5: 'B', Q6: 'B', Q8: 'B', Q10: 'B' });
const windowOf = (g: 'M' | 'F') => ({ ...PARTNER_AGE_WINDOW[g], relaxExtra: PARTNER_AGE_WINDOW.relaxExtra });
const rule = { regionRule: partnerRegionOk };

describe('지역 규칙', () => {
  it('서울↔경기는 서로 허용, 그 외는 같은 지역만', () => {
    expect(partnerRegionOk('서울', '경기')).toBe(true);
    expect(partnerRegionOk('경기', '서울')).toBe(true);
    expect(partnerRegionOk('서울', '인천')).toBe(false);
    expect(partnerRegionOk('부산', '경남')).toBe(false);
    expect(partnerRegionOk('부산', '부산')).toBe(true);
  });

  it('소규모 지역(세종·울산·제주)은 인근 지역도 허용 (단방향)', () => {
    expect(partnerRegionOk('세종', '대전')).toBe(true);
    expect(partnerRegionOk('울산', '부산')).toBe(true);
    expect(partnerRegionOk('제주', '광주')).toBe(true);
    expect(partnerRegionOk('대전', '세종')).toBe(false);
    expect(partnerRegionOk('세종', '서울')).toBe(false);
  });
});

describe('상대 추천 규칙', () => {
  const ages = Array.from({ length: 21 }, (_, i) => 20 + i);

  it.each([
    ['F', 30, -1, 4],
    ['M', 30, -4, 3],
  ] as const)('나이 가이드: 사용자 %s %i세 → 상대는 %i ~ +%i살', (gender, age, lo, hi) => {
    const me = make({ gender, age, region: '서울' });
    const other = gender === 'F' ? 'M' : 'F';
    const pool = ages.flatMap((a) => many(3, { gender: other, age: a, region: '서울' }));
    const picked = recommendPartners(pool, { ...preference, userGender: gender, virtualMe: me, ageWindow: windowOf(gender), ...rule }, seedrandom('a'));
    expect(picked).toHaveLength(3);
    for (const { customer } of picked) {
      expect(customer.age - age).toBeGreaterThanOrEqual(lo);
      expect(customer.age - age).toBeLessThanOrEqual(hi);
    }
  });

  it('후보가 모자라면 나이 창이 양쪽으로 1살만 넓어진다', () => {
    const me = make({ gender: 'F', age: 30, region: '서울' });
    // 정확한 창(29~34)에는 3명 미만, 넓힌 창(28~35)에는 충분
    const pool = [...many(2, { gender: 'M', age: 31 }), ...many(5, { gender: 'M', age: 35 }), ...many(5, { gender: 'M', age: 36 }), ...many(5, { gender: 'M', age: 27 })];
    const picked = recommendPartners(pool, { ...preference, userGender: 'F', virtualMe: me, ageWindow: windowOf('F'), ...rule }, seedrandom('b'));
    for (const { customer } of picked) {
      expect(customer.age).toBeGreaterThanOrEqual(28);
      expect(customer.age).toBeLessThanOrEqual(35);
    }
  });

  it('항상 다른 성별, 서울 사용자에게 경기 후보는 허용·인천은 제외', () => {
    const me = make({ gender: 'F', age: 30, region: '서울' });
    const pool = [...many(6, { gender: 'M', age: 31, region: '경기' }), ...many(6, { gender: 'M', age: 31, region: '인천' }), ...many(6, { gender: 'F', age: 31, region: '서울' })];
    const picked = recommendPartners(pool, { ...preference, userGender: 'F', virtualMe: me, ageWindow: windowOf('F'), ...rule }, seedrandom('c'));
    for (const { customer } of picked) {
      expect(customer.gender).toBe('M');
      expect(customer.region).toBe('경기');
    }
  });

  it('소규모 지역: 같은 지역이 충분하면 같은 지역만', () => {
    const me = make({ gender: 'F', age: 30, region: '세종' });
    const pool = [...many(12, { gender: 'M', age: 31, region: '세종' }), ...many(12, { gender: 'M', age: 31, region: '대전' })];
    const picked = recommendPartners(pool, { ...preference, userGender: 'F', virtualMe: me, ageWindow: windowOf('F'), ...rule, preferSameRegion: true }, seedrandom('d'));
    for (const { customer } of picked) expect(customer.region).toBe('세종');
  });

  it('소규모 지역: 같은 지역이 모자라면 인근 지역까지, 인근이 아닌 곳은 제외', () => {
    const me = make({ gender: 'F', age: 30, region: '세종' });
    const pool = [...many(2, { gender: 'M', age: 31, region: '세종' }), ...many(12, { gender: 'M', age: 31, region: '충남' }), ...many(12, { gender: 'M', age: 31, region: '서울' })];
    const picked = recommendPartners(pool, { ...preference, userGender: 'F', virtualMe: me, ageWindow: windowOf('F'), ...rule, preferSameRegion: true }, seedrandom('e'));
    expect(picked).toHaveLength(3);
    for (const { customer } of picked) expect(['세종', '충남']).toContain(customer.region);
  });
});

describe('가상의 나 (strict)', () => {
  const input = { gender: 'F' as const, age: 30, incomeBand: 3 };

  it('성별·소득 정확 일치, 같은 지역 나이 정확 일치 → 모자라면 ±1', () => {
    const pool = [...many(2, { gender: 'F', age: 30, region: '서울' }), ...many(4, { gender: 'F', age: 31, region: '서울' }), ...many(4, { gender: 'F', age: 32, region: '서울' }), ...many(4, { gender: 'F', age: 30, region: '경기' }), ...many(4, { gender: 'M', age: 30, region: '서울' }), ...many(4, { gender: 'F', age: 30, region: '서울', incomeBand: 4 })];
    const { candidates } = pickVirtualMe(pool, { ...input, region: '서울', strict: true }, seedrandom('f'));
    expect(candidates).toHaveLength(3);
    expect(candidates.filter((c) => c.age === 30)).toHaveLength(2);
    for (const c of candidates) {
      expect(c.region).toBe('서울');
      expect(c.gender).toBe('F');
      expect(c.incomeBand).toBe(3);
      expect(Math.abs(c.age - 30)).toBeLessThanOrEqual(1);
    }
  });

  it('일반 지역은 모자라도 다른 지역으로 넓히지 않는다', () => {
    const pool = [...many(2, { gender: 'F', age: 30, region: '부산' }), ...many(10, { gender: 'F', age: 30, region: '경남' })];
    const { candidates } = pickVirtualMe(pool, { ...input, region: '부산', strict: true }, seedrandom('g'));
    expect(candidates).toHaveLength(2);
  });

  it('소규모 지역은 같은 지역을 먼저 채우고 인근 지역으로 보충', () => {
    const pool = [...many(2, { gender: 'F', age: 30, region: '세종' }), ...many(10, { gender: 'F', age: 30, region: '대전' }), ...many(10, { gender: 'F', age: 30, region: '서울' })];
    const { candidates } = pickVirtualMe(pool, { ...input, region: '세종', strict: true }, seedrandom('h'));
    expect(candidates).toHaveLength(3);
    expect(candidates.filter((c) => c.region === '세종')).toHaveLength(2);
    for (const c of candidates) expect(['세종', '대전']).toContain(c.region);
  });
});
