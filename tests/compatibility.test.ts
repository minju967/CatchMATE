import { describe, expect, it } from 'vitest';
import { axisHarmony, computeCompatibility, debtHarmony, financeHarmony, gradeLabel, habitHarmony, lifeScore, type MatchProfile } from '@/lib/compatibility';
import { SCORE_WEIGHTS } from '@/lib/config';
import { generateCustomers } from '@/lib/generate';

const me: MatchProfile = { region: '서울', age: 31, levels: { saving: 1, spending: 1, investment: 2, asset: 1, income: 1, debt: 1 } };
const partner: MatchProfile = { region: '경기', age: 35, levels: { saving: 2, spending: 0, investment: 1, asset: 2, income: 1, debt: 0 } };

describe('영역별 점수', () => {
  it('가중치 합은 1', () => {
    expect(SCORE_WEIGHTS.habit + SCORE_WEIGHTS.finance + SCORE_WEIGHTS.debt + SCORE_WEIGHTS.life).toBeCloseTo(1);
  });

  it('습관 조화도 규칙', () => {
    expect(axisHarmony('saving', 0, 2, 3)).toBe(0);
    expect(axisHarmony('debt', 0, 1, 4)).toBeCloseTo((2 / 3) * (1 - 0.5 * (0.5 / 3))); // 유사도 × 부담 보정
    expect(axisHarmony('investment', 1, 2, 5)).toBe(1); // 1단계 차이까지 만점
    expect(axisHarmony('investment', 0, 0, 5)).toBe(1);
    expect(axisHarmony('investment', 0, 1, 5)).toBe(0.75); // 미투자 vs 소극은 만점이 아니다
    expect(axisHarmony('investment', 0, 2, 5)).toBe(0.5);
    expect(axisHarmony('investment', 0, 4, 5)).toBe(0);
    expect(axisHarmony('asset', 0, 2, 3)).toBe(0.5); // 완만한 유사도
    expect(habitHarmony(me.levels, me.levels)).toBe(100);
    expect(financeHarmony(me.levels, me.levels)).toBe(100);
    expect(debtHarmony(me.levels, me.levels)).toBeCloseTo(100 * (1 - 0.5 / 3)); // 부채 1단계(저부담)끼리: 유사도 100에 부담 감점
  });

  it('영역은 자기 축만 본다', () => {
    const other = { ...me.levels, debt: 3, asset: 0 };
    expect(habitHarmony(me.levels, other)).toBe(100);
    expect(financeHarmony(me.levels, other)).toBe(87.5); // 재산 1단계 차이 0.75, 소득 동일 1.0의 평균
    expect(debtHarmony(me.levels, other)).toBeCloseTo(100 * (1 - 2 / 3) * (1 - 0.5 * (2 / 3)));
  });

  it('부채: 둘 다 무부채와 둘 다 과부담을 구분한다', () => {
    const debt = (a: number, b: number) => debtHarmony({ ...me.levels, debt: a }, { ...me.levels, debt: b });
    expect(debt(0, 0)).toBe(100);
    expect(debt(3, 3)).toBe(50);
    expect(debt(0, 0)).toBeGreaterThan(debt(1, 1));
    expect(debt(1, 1)).toBeGreaterThan(debt(2, 2));
    expect(debt(2, 2)).toBeGreaterThan(debt(3, 3));
    expect(debt(0, 3)).toBe(0);
  });

  it('생활 조건: 지역과 나이 차 점수의 평균', () => {
    expect(lifeScore({ region: '서울', age: 30 }, { region: '서울', age: 33 })).toBe(100);
    expect(lifeScore({ region: '서울', age: 30 }, { region: '인천', age: 36 })).toBe(70);
    expect(lifeScore({ region: '서울', age: 30 }, { region: '부산', age: 37 })).toBe(40);
    expect(lifeScore(me, partner)).toBe(70);
  });
});

describe('궁합 총점', () => {
  it('0~100 정수이고 하위 점수의 가중합', () => {
    const r = computeCompatibility(me, partner);
    for (const v of [r.total, r.habit, r.finance, r.debt, r.life]) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(r.total).toBe(Math.round(
      SCORE_WEIGHTS.habit * r.habit + SCORE_WEIGHTS.finance * r.finance + SCORE_WEIGHTS.debt * r.debt + SCORE_WEIGHTS.life * r.life,
    ));
    expect(r.label).toBe(gradeLabel(r.total));
    expect(r.axisCompare).toHaveLength(6);
  });

  it('같은 입력이면 항상 같은 점수 (결정적)', () => {
    expect(computeCompatibility(me, partner)).toEqual(computeCompatibility(me, partner));
  });

  it('생성된 고객 어느 쌍에서도 0~100 정수', () => {
    const customers = generateCustomers(300, 'compat-test');
    for (let i = 0; i < customers.length - 1; i++) {
      const { total } = computeCompatibility(customers[i], customers[i + 1]);
      expect(Number.isInteger(total)).toBe(true);
      expect(total).toBeGreaterThanOrEqual(0);
      expect(total).toBeLessThanOrEqual(100);
    }
  });

  it('등급 라벨 경계', () => {
    expect(gradeLabel(100)).toBe('천생연분 재테크 메이트');
    expect(gradeLabel(90)).toBe('천생연분 재테크 메이트');
    expect(gradeLabel(89)).toBe('함께 돈 모으기 좋은 사이');
    expect(gradeLabel(70)).toBe('서로 배우며 맞춰가는 사이');
    expect(gradeLabel(60)).toBe('대화가 필요한 사이');
    expect(gradeLabel(59)).toBe('다른 매력으로 채워가는 사이');
    expect(gradeLabel(0)).toBe('다른 매력으로 채워가는 사이');
  });
});
