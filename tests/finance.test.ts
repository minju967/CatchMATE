import { describe, expect, it } from 'vitest';
import { assetQuintileOf, FINANCE_TYPES, financeName, financeStatus, incomeQuintile } from '@/lib/finance';

describe('재무 상태 유형 — 소득 분위 − 재산 분위', () => {
  it('소득 백분위는 20 단위로 5분위, 100 은 5분위', () => {
    expect(incomeQuintile(0)).toBe(1);
    expect(incomeQuintile(19.99)).toBe(1);
    expect(incomeQuintile(20)).toBe(2);
    expect(incomeQuintile(79.9)).toBe(4);
    expect(incomeQuintile(80)).toBe(5);
    expect(incomeQuintile(100)).toBe(5);
  });

  it('재산 분위 라벨: 1~5분위는 숫자, 무자산은 null', () => {
    expect(assetQuintileOf('3분위')).toBe(3);
    expect(assetQuintileOf('무자산')).toBeNull();
    expect(() => assetQuintileOf('6분위')).toThrow();
    expect(() => assetQuintileOf('')).toThrow();
  });

  it('차이에 따라 다섯 유형 + 무자산', () => {
    expect(financeStatus(90, '1분위')).toBe('INCOME_FAR'); // 5 − 1 = +4
    expect(financeStatus(50, '1분위')).toBe('INCOME_FAR'); // 3 − 1 = +2
    expect(financeStatus(30, '1분위')).toBe('INCOME_NEAR'); // 2 − 1 = +1
    expect(financeStatus(30, '2분위')).toBe('ALIGNED');
    expect(financeStatus(30, '3분위')).toBe('ASSET_NEAR'); // 2 − 3 = −1
    expect(financeStatus(30, '4분위')).toBe('ASSET_FAR'); // 2 − 4 = −2
    expect(financeStatus(5, '5분위')).toBe('ASSET_FAR');
    expect(financeStatus(95, '무자산')).toBe('CASH_CHECK');
  });

  it('소득 값이 숫자가 아니면 오류', () => {
    expect(() => financeStatus(NaN, '1분위')).toThrow();
  });

  it('6종이고 이름이 겹치지 않는다', () => {
    expect(FINANCE_TYPES).toHaveLength(6);
    expect(new Set(FINANCE_TYPES.map((f) => f.name)).size).toBe(6);
    expect(financeName('CASH_CHECK')).toBe('잔고 점검형');
  });
});
