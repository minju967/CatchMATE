import { z } from 'zod';
import { QUESTION_BY_ID } from '@/data/questions';
import { AXIS_KEYS } from './axes';
import { QUIZ } from './config';
import { PERSONA_CODES } from './personas';
import { countAnswered } from './preference';
import { SURVEY } from './survey';
import { REGIONS } from './regions';

// API 입력 검증 (§10)

const gender = z.enum(['M', 'F']);
const customerId = z.string().regex(/^(C\d{6}|R\d{1,9})$/) // C: 목업, R: 실데이터(customer_id);
const excludeIds = z.array(customerId).max(200).optional();

const axisShape = <T extends z.ZodTypeAny>(value: T) =>
  z.object(Object.fromEntries(AXIS_KEYS.map((k) => [k, value])) as Record<(typeof AXIS_KEYS)[number], T>);

const preferenceShape = {
  pref: axisShape(z.number().min(0).max(4).nullable()),
  prefWeight: axisShape(z.number().min(0).max(20)),
};

const metric = z.enum(['S', 'V', 'C', 'P', 'I', 'D']);
const short = z.string().max(20);

/** 설문 응답에서 만든 금융 습관 선호 (preference.ts 의 HabitPreference) */
const habitsShape = z
  .object({
    levels: z.record(z.string().max(1), short),
    strength: z.record(z.string().max(1), z.number().min(0).max(100)),
    domain: z.enum(['저축', '소비', '투자']).nullable(),
    main: metric.nullable(),
    persona: z.enum(PERSONA_CODES as [(typeof PERSONA_CODES)[number], ...(typeof PERSONA_CODES)[number][]]).nullable(),
  })
  .optional();

export const virtualMeSchema = z.object({
  gender,
  region: z.enum(REGIONS),
  age: z.number().int().min(19).max(60),
  incomeBand: z.number().int().min(1).max(5),
  excludeIds,
});

export const personaSchema = z.object({
  answers: z
    .record(z.string(), z.string().nullable())
    .superRefine((answers, ctx) => {
      if (Object.keys(answers).length > SURVEY.cap) return ctx.addIssue({ code: 'custom', message: `문항은 최대 ${SURVEY.cap}개까지 보낼 수 있어요.` });
      for (const [qid, key] of Object.entries(answers)) {
        const q = QUESTION_BY_ID[qid];
        if (!q) return ctx.addIssue({ code: 'custom', message: `알 수 없는 문항: ${qid}` });
        if (key == null) continue;
        if (!q.options.some((o) => o.key === key)) return ctx.addIssue({ code: 'custom', message: `${qid}에 없는 선택지: ${key}` });
      }
      const answered = countAnswered(answers);
      if (answered < QUIZ.minAnswers) ctx.addIssue({ code: 'custom', message: `최소 ${QUIZ.minAnswers}문항에 답해야 합니다.` });
      if (answered > QUIZ.maxAnswers) ctx.addIssue({ code: 'custom', message: `최대 ${QUIZ.maxAnswers}문항까지 답할 수 있습니다.` });
    }),
});

export const nextQuestionSchema = z.object({
  seed: z.string().max(64),
  steps: z.array(z.object({ id: z.string().max(10), key: z.string().max(2).nullable() })).max(SURVEY.cap),
});

export const recommendSchema = z.object({
  userGender: gender,
  virtualMeId: customerId,
  ...preferenceShape,
  habits: habitsShape,
  excludeIds,
});

export const compatibilitySchema = z.object({
  virtualMeId: customerId,
  partnerId: customerId,
});

// §8.2 — 수치 원본 대신 라벨만 받는다
const personSchema = z.object({
  nickname: z.string().max(40),
  age: z.number().int().min(0).max(120),
  region: z.string().max(10),
  persona: z.string().max(20),
  axes: z.record(z.string().max(10), z.string().max(10)),
  /** 금융 습관 6지표(저축 성향·소비 규모 …) → 유형 이름. 값이 없는 지표는 빠진다. */
  habits: z.record(z.string().max(10), z.string().max(10)).optional(),
});

export const reasonInputSchema = z.object({
  me: personSchema,
  partner: personSchema,
  preference: z.object({
    answers: z.array(z.object({ q: z.string().max(60), choice: z.string().max(200) })).max(QUIZ.maxAnswers),
  }),
  scores: z.object({
    total: z.number().int().min(0).max(100),
    label: z.string().max(40),
    habit: z.number().int().min(0).max(100),
    finance: z.number().int().min(0).max(100),
    debt: z.number().int().min(0).max(100),
    life: z.number().int().min(0).max(100),
  }),
});

export type ReasonInput = z.infer<typeof reasonInputSchema>;

export const reasonSchema = z.object({
  headline: z.string().min(1),
  reasons: z.array(z.string().min(1)).min(1).max(5),
  watch_out: z.string().min(1),
  date_tip: z.string().min(1),
});

export type Reason = z.infer<typeof reasonSchema>;
export type ReasonResponse = Reason & { source: 'llm' | 'fallback' };
