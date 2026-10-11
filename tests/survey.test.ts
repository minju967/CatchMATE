import { describe, expect, it } from 'vitest';
import { NO_PREFERENCE_KEY, QUESTIONS, QUESTION_BY_ID } from '@/data/questions';
import { collectEvidence, type AnswerStep } from '@/lib/evidence';
import { partnerFit } from '@/lib/fit';
import { METRICS } from '@/lib/habits';
import { computePreference, countAnswered } from '@/lib/preference';
import { personaSchema } from '@/lib/schemas';
import { nextQuestion, SURVEY } from '@/lib/survey';
import type { Customer } from '@/lib/types';

/** 설문을 끝까지 푼다. choose 가 null 을 돌려주면 건너뛴다. */
function runSurvey(seed: string, choose: (id: string, options: string[]) => string | null) {
  const steps: AnswerStep[] = [];
  for (let guard = 0; guard < 30; guard++) {
    const q = nextQuestion(seed, steps);
    if (!q) break;
    steps.push({ id: q.id, key: choose(q.id, q.options.map((o) => o.key)) });
  }
  return steps;
}

/** 선택지 번호 i (0~3)를 고르는 응답자. 없으면 상관없음. */
const pickIndex = (i: number) => (id: string) => {
  const o = QUESTION_BY_ID[id].options;
  return (o[i] ?? o[o.length - 1]).key;
};

describe('문항 은행', () => {
  it('id 가 겹치지 않고 모든 문항이 3~5개 선택지이며 마지막은 상관없음', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) {
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.options.length, q.id).toBeLessThanOrEqual(5);
      expect(q.options.at(-1)!.key, q.id).toBe(NO_PREFERENCE_KEY);
      expect(q.options.at(-1)!.effects).toEqual([]);
    }
  });

  it('여섯 지표마다 직접 증거 선택지가 2개 이상, 소비 규모는 3수준 모두 2개 이상', () => {
    const effects = QUESTIONS.flatMap((q) => q.options.flatMap((o) => o.effects));
    for (const m of METRICS) {
      const direct = effects.filter((e) => 'metric' in e && e.metric === m && e.strength === 'd');
      expect(direct.length, m).toBeGreaterThanOrEqual(2);
    }
    for (const level of ['여유', '적정', '과소비']) {
      const n = effects.filter((e) => 'metric' in e && e.metric === 'V' && e.level === level && e.strength === 'd').length;
      expect(n, level).toBeGreaterThanOrEqual(2);
    }
  });

  it('소비 규모: 여유는 소비가 낮은 쪽, 과소비는 높은 쪽 (Q25)', () => {
    expect(QUESTION_BY_ID.Q25.options[0].effects).toEqual([{ metric: 'V', level: '여유', strength: 'd' }]);
    expect(QUESTION_BY_ID.Q25.options[2].effects).toEqual([{ metric: 'V', level: '과소비', strength: 'd' }]);
  });
});

describe('nextQuestion — 적응형 출제', () => {
  it('항상 Q35 로 시작하고, 같은 seed·응답이면 같은 문항', () => {
    expect(nextQuestion('s', [])!.id).toBe('Q35');
    const a = runSurvey('s', pickIndex(0)).map((s) => s.id);
    const b = runSurvey('s', pickIndex(0)).map((s) => s.id);
    expect(a).toEqual(b);
  });

  it('모두 답하면 정확히 10문항에서 끝나고 재무·부채가 1문항씩 들어 있다', () => {
    for (let i = 0; i < 100; i++) {
      for (const pick of [pickIndex(0), pickIndex(1), pickIndex(2), pickIndex(3)]) {
        const steps = runSurvey(`seed-${i}`, pick);
        expect(steps).toHaveLength(SURVEY.target);
        const roles = steps.map((s) => QUESTION_BY_ID[s.id].role);
        expect(roles.filter((r) => r === 'finance')).toHaveLength(1);
        expect(roles.filter((r) => r === 'debt')).toHaveLength(1);
        expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length);
      }
    }
  });

  it('소비를 고르면 Q37A, 투자를 고르면 Q37B, 저축·상관없음이면 Q37 을 묻지 않는다', () => {
    const second = (key: string) => nextQuestion('x', [{ id: 'Q35', key }])!.id;
    expect(second('B')).toBe('Q37A');
    expect(second('C')).toBe('Q37B');
    expect(['Q37A', 'Q37B']).not.toContain(second('A'));
    expect(['Q37A', 'Q37B']).not.toContain(second(NO_PREFERENCE_KEY));
  });

  it('중요도 문항에 답한 수만큼 습관 문항이 줄어든다 (소비 선택 시 습관 6개, 저축 선택 시 7개)', () => {
    const habits = (first: string) => {
      const steps = runSurvey('k', (id) => (id === 'Q35' ? first : pickIndex(0)(id)));
      return steps.filter((s) => QUESTION_BY_ID[s.id].role === 'habit').length;
    };
    expect(habits('B')).toBe(6);
    expect(habits('A')).toBe(7);
  });

  it('건너뛴 문항은 세지 않고 다른 문항으로 채우며, 최대 14문항에서 멈춘다', () => {
    const steps = runSurvey('skip', (id, opts) => (id === 'Q35' ? 'B' : id.startsWith('Q3') || id === 'Q04' ? null : opts[0]));
    expect(steps.length).toBeLessThanOrEqual(SURVEY.cap);
    expect(steps.filter((s) => s.key != null)).toHaveLength(SURVEY.target);
    expect(runSurvey('allskip', () => null).length).toBe(SURVEY.cap);
  });

  it('가장 중시하는 지표(Q37)의 직접 증거 문항을 먼저 낸다', () => {
    // 소비 → 결제 수단(P)을 가장 중시: 첫 습관 문항은 P 의 직접 증거 문항이어야 한다
    const steps: AnswerStep[] = [
      { id: 'Q35', key: 'B' },
      { id: 'Q37A', key: 'C' },
    ];
    for (let i = 0; i < 30; i++) {
      const q = nextQuestion(`f${i}`, steps)!;
      const direct = q.options.some((o) => o.effects.some((e) => 'metric' in e && e.metric === 'P' && e.strength === 'd'));
      expect(direct, q.id).toBe(true);
    }
  });
});

describe('computePreference', () => {
  it('답이 없으면 선호도 없다', () => {
    const p = computePreference({});
    expect(p.answeredCount).toBe(0);
    expect(p.habits.persona).toBeNull();
    expect(Object.values(p.pref).every((v) => v == null)).toBe(true);
  });

  it('가장 중시하는 지표와 수준으로 선호 페르소나가 정해진다', () => {
    // 소비 → 결제 수단(P) 중시, Q07 에서 현금 선택 → 현금 결제 원칙주의자(P06)
    const p = computePreference({ Q35: 'B', Q37A: 'C', Q07: 'A' });
    expect(p.habits.domain).toBe('소비');
    expect(p.habits.main).toBe('P');
    expect(p.habits.levels.P).toBe('현금');
    expect(p.habits.persona).toBe('P06');
  });

  it('다수형(카드·계획·집중)은 선호 페르소나를 정하지 못해 다음으로 중시하는 지표로 넘어간다', () => {
    // 소비 영역에서 카드(다수형)와 과소비를 선택 → 월급 삭제 마법사(P02)
    const p = computePreference({ Q35: 'B', Q07: 'C', Q25: 'C' });
    expect(p.habits.levels.P).toBe('카드');
    expect(p.habits.main).toBe('V');
    expect(p.habits.persona).toBe('P02');
  });

  it('상관없음과 건너뛴 문항은 선호에 영향을 주지 않는다', () => {
    const noisy = computePreference({ Q25: 'A', Q26: null, Q27: 'N' });
    expect(noisy.habits).toEqual(computePreference({ Q25: 'A' }).habits);
    expect(noisy.answeredCount).toBe(2);
  });

  it('재무·부채 문항은 소득·재산·부채 축 선호가 된다', () => {
    const p = computePreference({ Q17: 'D', Q20: 'A' });
    expect(p.pref.income).toBe(2);
    expect(p.pref.debt).toBe(0);
    expect(p.pref.asset).toBeNull();
  });

  it('습관 선호는 저축·소비·투자 축 선호로도 옮겨진다 (소비 여유 = 절제)', () => {
    const p = computePreference({ Q25: 'A', Q27: 'A', Q34: 'C' });
    expect(p.pref.spending).toBe(0);
    expect(p.pref.saving).toBe(2);
    expect(p.pref.investment).toBe(3);
  });

  it('evidence 의 answered 는 상관없음은 세고 건너뛴 문항은 세지 않는다', () => {
    expect(collectEvidence([{ id: 'Q25', key: 'N' }, { id: 'Q26', key: null }]).answered).toBe(1);
    expect(countAnswered({ Q25: 'A', Q26: null })).toBe(1);
  });
});

describe('personaSchema', () => {
  const answers = (n: number) => Object.fromEntries(runSurvey('v', pickIndex(0)).slice(0, n).map((s) => [s.id, s.key]));

  it('10문항에 모두 답해야 결과로 넘어갈 수 있다', () => {
    expect(personaSchema.safeParse({ answers: answers(5) }).success).toBe(false);
    expect(personaSchema.safeParse({ answers: answers(9) }).success).toBe(false);
    expect(personaSchema.safeParse({ answers: answers(10) }).success).toBe(true);
  });

  it('없는 문항이나 선택지는 거부한다', () => {
    expect(personaSchema.safeParse({ answers: { ...answers(10), Q99: 'A' } }).success).toBe(false);
    expect(personaSchema.safeParse({ answers: { ...answers(10), Q25: 'Z' } }).success).toBe(false);
  });
});

describe('partnerFit — 설문에 맞는 후보', () => {
  const levels = { saving: 1, spending: 1, investment: 0, asset: 1, income: 1, debt: 1 };
  const cust = (over: Partial<Customer>) => ({ levels, persona: 'P15', ...over }) as Customer;
  const pref = computePreference({ Q35: 'B', Q37A: 'C', Q07: 'A', Q25: 'A', Q17: 'D', Q20: 'A' });

  it('선호하는 습관·재무·부채에 맞는 후보가 더 높다', () => {
    const good = cust({ persona: 'P06', habits: { P: '현금', V: '여유' }, levels: { ...levels, income: 2, debt: 0 } });
    const bad = cust({ persona: 'P02', habits: { P: '카드', V: '과소비' }, levels: { ...levels, income: 0, debt: 3 } });
    expect(partnerFit(pref, good)).toBeGreaterThan(partnerFit(pref, bad));
    expect(partnerFit(pref, good)).toBeGreaterThan(90);
  });

  it('응답이 없으면 중립값 50, 습관 데이터가 없는 후보는 페르소나와 축으로만 본다', () => {
    const empty = computePreference({});
    expect(partnerFit({ pref: empty.pref, prefWeight: empty.prefWeight }, cust({}))).toBe(50);
    const noHabits = cust({ persona: 'P06', levels: { ...levels, income: 2, debt: 0 } });
    expect(partnerFit(pref, noHabits)).toBeGreaterThan(90);
  });

  it('소비 규모는 이웃 수준이면 부분 점수', () => {
    const only = computePreference({ Q35: 'B', Q37A: 'A', Q25: 'A' }); // 소비 규모를 가장 중시, 여유 선호
    const exact = partnerFit(only, cust({ persona: 'P01', habits: { V: '여유' } }));
    const near = partnerFit(only, cust({ persona: 'P15', habits: { V: '적정' } }));
    const far = partnerFit(only, cust({ persona: 'P02', habits: { V: '과소비' } }));
    expect(exact).toBeGreaterThan(near);
    expect(near).toBeGreaterThan(far);
  });
});
