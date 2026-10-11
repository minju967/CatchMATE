import seedrandom from 'seedrandom';
import { describe, expect, it } from 'vitest';
import { flowLevels } from '@/lib/axes';
import { SEED } from '@/lib/config';
import { customerToRow } from '@/lib/db';
import { FINANCE_TYPES } from '@/lib/finance';
import { generateCustomers } from '@/lib/generate';
import { PERSONA_CODES } from '@/lib/personas';
import { computePreference } from '@/lib/preference';
import { pickVirtualMe, recommendPartners } from '@/lib/recommend';
import { reasonFallback } from '@/lib/reasonFallback';
import { sampleAnswers } from '@/lib/llm';
import { toCard } from '@/lib/types';

const customers = generateCustomers();
// 소비 규모를 가장 중시(적정 선호) + 알뜰한 저축, 소득 또래 수준, 저부담 부채
const preference = computePreference({ Q35: 'B', Q37A: 'A', Q06: 'A', Q27: 'A', Q17: 'B', Q20: 'B' });

describe('목업 데이터', () => {
  it('시드가 같으면 같은 데이터', () => {
    expect(generateCustomers(200)).toEqual(generateCustomers(200));
  });

  it('3,000명, 성별 50:50, 24개 페르소나가 모두 존재하고 재무 상태가 채워진다', () => {
    expect(customers).toHaveLength(3000);
    expect(customers.filter((c) => c.gender === 'M')).toHaveLength(1500);
    for (const code of PERSONA_CODES) expect(customers.some((c) => c.persona === code)).toBe(true);
    for (const c of customers) expect(FINANCE_TYPES.map((f) => f.code)).toContain(c.finance);
  });

  it('수치 정합성: 소비 + 저축 + 투자 + 상환/12 ≤ 월소득 × 1.05', () => {
    for (const c of customers) {
      const out = c.monthlySpending + c.monthlySaving + c.monthlyInvestment + c.annualRepayment / 12;
      expect(out).toBeLessThanOrEqual(c.monthlyIncome * SEED.budgetCap + 0.5);
    }
  });

  it('저장된 레벨은 원천 수치에서 다시 계산한 값', () => {
    for (const c of customers) expect(c.levels).toMatchObject(flowLevels(c));
  });
});

describe('S2 가상의 나', () => {
  it('조건이 드문 입력에서도 같은 성별 3명을 중복 없이 뽑는다', () => {
    const rng = seedrandom('s2');
    for (const input of [
      { gender: 'F' as const, region: '세종', age: 45, incomeBand: 1 },
      { gender: 'M' as const, region: '제주', age: 23, incomeBand: 5 },
      { gender: 'M' as const, region: '서울', age: 55, incomeBand: 3 },
    ]) {
      const { candidates } = pickVirtualMe(customers, input, rng);
      expect(candidates).toHaveLength(3);
      expect(new Set(candidates.map((c) => c.id)).size).toBe(3);
      expect(candidates.every((c) => c.gender === input.gender)).toBe(true);
    }
  });

  it('조건에 맞는 사람이 충분하면 완화하지 않고, 다시 뽑기는 이미 본 사람을 뺀다', () => {
    const rng = seedrandom('s2-reroll');
    const input = { gender: 'F' as const, region: '경기', age: 32, incomeBand: 3 };
    const first = pickVirtualMe(customers, input, rng);
    expect(first.relaxedLevel).toBe(0);
    expect(first.candidates.every((c) => c.region === '경기' && Math.abs(c.age - 32) <= 2 && c.incomeBand === 3)).toBe(true);
    const seen = first.candidates.map((c) => c.id);
    const second = pickVirtualMe(customers, { ...input, excludeIds: seen }, rng);
    expect(second.candidates.some((c) => seen.includes(c.id))).toBe(false);
  });
});

describe('S5 이성 후보', () => {
  it('항상 다른 성별 3명, 중복 없음, 적합도 내림차순', () => {
    for (let i = 0; i < 60; i++) {
      const rng = seedrandom(`s5-${i}`);
      const virtualMe = customers[i * 37];
      const picked = recommendPartners(customers, { ...preference, userGender: virtualMe.gender, virtualMe }, rng);
      expect(picked).toHaveLength(3);
      expect(new Set(picked.map((p) => p.customer.id)).size).toBe(3);
      expect(picked.every((p) => p.customer.gender !== virtualMe.gender)).toBe(true);
      expect(picked[0].P).toBeGreaterThanOrEqual(picked[1].P);
      expect(picked[1].P).toBeGreaterThanOrEqual(picked[2].P);
    }
  });

  it('후보가 충분하면 나이 ±5 안에서 뽑고(페르소나는 따지지 않는다), 본 후보는 제외한다', () => {
    const rng = seedrandom('s5-pool');
    const virtualMe = customers.find((c) => c.gender === 'M' && c.age === 32)!;
    const input = { ...preference, userGender: 'M' as const, virtualMe };
    const first = recommendPartners(customers, input, rng);
    expect(first.every((p) => Math.abs(p.customer.age - 32) <= 5)).toBe(true);
    const seen = first.map((p) => p.customer.id);
    const second = recommendPartners(customers, { ...input, excludeIds: seen }, rng);
    expect(second.some((p) => seen.includes(p.customer.id))).toBe(false);
  });
});

describe('클라이언트 응답', () => {
  it('카드에는 원천 금액·지표 필드가 없다', () => {
    const allowed = ['id', 'nickname', 'gender', 'age', 'region', 'incomeBand', 'persona', 'finance', 'levels', 'ratios'];
    const card = toCard(customers[0]);
    expect(Object.keys(card).sort()).toEqual([...allowed].sort());
    const amountColumns = Object.keys(customerToRow(customers[0])).filter((k) => /income$|spending|saving$|investment$|asset|debt$|repayment/.test(k) && !k.startsWith('lv_'));
    expect(amountColumns.length).toBeGreaterThanOrEqual(8);
    expect(JSON.stringify(card)).not.toMatch(/annual|monthly|total|liquid|repayment/i);
  });
});

describe('폴백 추천 이유', () => {
  it('LLM 없이도 모든 항목이 채워진다', () => {
    const person = (persona: string, saving: string) => ({
      nickname: '적금하는 다람쥐', age: 31, region: '서울', persona,
      axes: { 저축: saving, 소비: '적정', 투자: '보통', 재산: '중위', 소득: '중위', 부채: '저부담' },
    });
    const reason = reasonFallback({
      me: person('균형 설계형', '보통'),
      partner: person('알뜰 저축형', '높음'),
      preference: { answers: [{ q: '월급날', choice: '일정 금액을 바로 떼어놓는다.' }] },
      scores: { total: 84, label: '함께 돈 모으기 좋은 사이', habit: 88, finance: 79, debt: 70, life: 60 },
    });
    expect(reason.source).toBe('fallback');
    expect(reason.headline).toContain('84');
    expect(reason.reasons).toHaveLength(3);
    expect(reason.reasons[0]).toContain('88');
    expect(reason.reasons[2]).toContain('월급날');
    expect(reason.watch_out).toContain('저축');
    expect(reason.date_tip.length).toBeGreaterThan(0);
  });
});

describe('추천 이유 입력: 선호 답변 샘플링', () => {
  it('요청한 개수만 뽑고 원본 순서를 유지한다', () => {
    const answers = Array.from({ length: 10 }, (_, i) => i);
    const picked = sampleAnswers(answers, 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    expect([...picked].sort((a, b) => a - b)).toEqual(picked);
  });

  it('답변이 적으면 있는 만큼만 돌려준다', () => {
    expect(sampleAnswers([1, 2], 3)).toEqual([1, 2]);
    expect(sampleAnswers([], 3)).toEqual([]);
  });

  it('난수에 따라 다른 조합이 나온다', () => {
    const answers = Array.from({ length: 10 }, (_, i) => i);
    const seen = new Set<string>();
    for (let k = 0; k < 30; k++) seen.add(sampleAnswers(answers, 3, Math.random).join());
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('S5 이성 후보: 같은 페르소나 제한', () => {
  it('한 화면에 같은 페르소나는 최대 2명 (다른 페르소나 후보가 있을 때)', () => {
    for (let i = 0; i < 60; i++) {
      const rng = seedrandom(`persona-cap-${i}`);
      const virtualMe = customers[i * 41];
      const opposite = customers.filter((c) => c.gender !== virtualMe.gender);
      // 상위권이 한 페르소나로 도배된 풀: 앞쪽 40명을 모두 같은 페르소나로 만든다
      const crowded = [virtualMe, ...opposite.slice(0, 40).map((c) => ({ ...c, persona: opposite[0].persona })), ...opposite.slice(40)];
      const picked = recommendPartners(crowded, { ...preference, userGender: virtualMe.gender, virtualMe }, rng);
      expect(picked).toHaveLength(3);
      const counts = new Map<string, number>();
      for (const p of picked) counts.set(p.customer.persona, (counts.get(p.customer.persona) ?? 0) + 1);
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    }
  });
});
