'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import PersonaBadge from '@/components/PersonaBadge';
import RadarCompare from '@/components/RadarCompare';
import ScoreGauge from '@/components/ScoreGauge';
import StepShell, { ErrorNote } from '@/components/StepShell';
import type { PublicQuestion } from '@/data/questions';
import { AXES, DISPLAY_AXIS_KEYS, levelLabel } from '@/lib/axes';
import { GENDER_COLOR, personaStyle, postJson } from '@/lib/client';
import { gradeColor, type Compatibility } from '@/lib/compatibility';
import { SCORE_WEIGHTS } from '@/lib/config';
import { financeName } from '@/lib/finance';
import { METRIC_LABEL, METRICS, TYPE_OF_LEVEL } from '@/lib/habits';
import { personaName } from '@/lib/personas';
import type { ReasonInput, ReasonResponse } from '@/lib/schemas';
import type { CustomerCard } from '@/lib/types';
import { useHydrated, useSession } from '@/store/session';

// 항목별 막대 색: 밝은·어두운 배경 모두에서 서로 구분되는 네 가지 (색각 이상 구분 검사 통과)
const pctOf = (w: number) => `${Math.round(w * 100)}%`;
const SUB_SCORES = [
  { key: 'habit', name: '금융 습관', weight: pctOf(SCORE_WEIGHTS.habit), color: '#7a4fc4' },
  { key: 'finance', name: '재무 상태', weight: pctOf(SCORE_WEIGHTS.finance), color: '#2f6fcf' },
  { key: 'debt', name: '부채 상태', weight: pctOf(SCORE_WEIGHTS.debt), color: '#c9772b' },
  { key: 'life', name: '생활 조건', weight: pctOf(SCORE_WEIGHTS.life), color: '#1f8f6a' },
] as const;

/** LLM 에는 수치 원본 대신 라벨만 보낸다 (§8.2) */
function describe(card: CustomerCard): ReasonInput['me'] {
  return {
    nickname: card.nickname,
    age: card.age,
    region: card.region,
    persona: personaName(card.persona),
    axes: Object.fromEntries(AXES.map((a) => [a.part, levelLabel(a.key, card.levels[a.key])])),
    habits: Object.fromEntries(METRICS.flatMap((m) => (card.habits?.[m] ? [[METRIC_LABEL[m], TYPE_OF_LEVEL[m][card.habits[m]!] ?? card.habits[m]!]] : []))),
  };
}

function buildReasonInput(
  me: CustomerCard,
  partner: CustomerCard,
  answers: Record<string, string | null>,
  questions: PublicQuestion[],
  compat: Compatibility,
): ReasonInput {
  return {
    me: describe(me),
    partner: describe(partner),
    preference: {
      answers: questions.flatMap((q) => {
        const option = q.options.find((o) => o.key === answers[q.id]);
        return option ? [{ q: q.title, choice: option.text }] : [];
      }),
    },
    scores: { total: compat.total, label: compat.label, habit: compat.habit, finance: compat.finance, debt: compat.debt, life: compat.life },
  };
}

export default function MatchPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { virtualMe, personaResult, partner, answers, questions } = useSession();
  const start = useSession((s) => s.start);
  const cacheReason = useSession((s) => s.cacheReason);

  const [compat, setCompat] = useState<Compatibility | null>(null);
  const [reason, setReason] = useState<ReasonResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const reasonFor = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!virtualMe || !personaResult) router.replace('/');
    else if (!partner) router.replace('/recommend');
  }, [hydrated, virtualMe, personaResult, partner, router]);

  const loadCompat = useCallback(async () => {
    if (!virtualMe || !partner) return;
    setError(null);
    try {
      setCompat(await postJson<Compatibility>('/api/compatibility', { virtualMeId: virtualMe.id, partnerId: partner.id }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [virtualMe, partner]);

  useEffect(() => {
    void loadCompat();
  }, [loadCompat]);

  const loadReason = useCallback(async () => {
    if (!compat || !questions || !virtualMe || !partner || !personaResult) return;
    setReasonError(null);
    try {
      const key = `${virtualMe.id}:${partner.id}`;
      const cached = useSession.getState().reasons[key];
      if (cached) {
        setReason(cached);
        return;
      }
      const result = await postJson<ReasonResponse>('/api/reason', buildReasonInput(virtualMe, partner, answers, questions, compat));
      setReason(result);
      // AI 가 쓴 글만 저장한다. 폴백은 호출 비용이 없고, 저장하면 나중에 키를 넣어도 폴백이 계속 보인다.
      if (result.source === 'llm') cacheReason(key, result);
    } catch (e) {
      setReasonError((e as Error).message);
    }
  }, [compat, questions, virtualMe, partner, personaResult, answers, cacheReason]);

  // 점수가 나오면 추천 이유를 한 번만 요청한다 (개발 모드의 이중 실행에도 LLM 호출은 1회)
  useEffect(() => {
    if (!compat || !questions || !partner) return;
    if (reasonFor.current === partner.id) return;
    reasonFor.current = partner.id;
    void loadReason();
  }, [compat, questions, partner, loadReason]);

  if (!virtualMe || !partner || !personaResult) {
    return (
      <StepShell step={5} onBack={() => router.push('/recommend')}>
        <div className="skeleton h-96 w-full" aria-label="궁합을 불러오는 중" />
      </StepShell>
    );
  }

  return (
    <StepShell step={5} onBack={() => router.push('/recommend')}>
      <div style={personaStyle(partner.persona)} className="flex flex-col gap-6">
        <div className="text-center">
          <p className="text-sm font-semibold text-muted">
            {/* 이름은 성별 색으로: 여성 핑크 · 남성 블루 (/me 의 선택 색과 같은 토큰) */}
            <span className="text-[22px] font-extrabold" style={{ color: GENDER_COLOR[virtualMe.gender] }}>{virtualMe.nickname}</span> × <span className="text-[22px] font-extrabold" style={{ color: GENDER_COLOR[partner.gender] }}>{partner.nickname}</span>
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <PersonaBadge code={virtualMe.persona} />
            <PersonaBadge code={partner.persona} />
          </div>
          <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
            <span className="chip">{financeName(virtualMe.finance)}</span>
            <span className="chip">{financeName(partner.finance)}</span>
          </div>
        </div>

        {error && <ErrorNote message={error} onRetry={() => void loadCompat()} />}

        {!compat && !error && <div className="skeleton mx-auto h-[208px] w-[208px] !rounded-full" aria-label="점수를 계산하는 중" />}

        {compat && (
          <>
            <div>
              <ScoreGauge score={compat.total} label={compat.label} color={gradeColor(compat.total)} />
              <h1 className="mt-4 text-center text-[26px] font-extrabold leading-tight tracking-tight [text-wrap:balance]">{compat.label}</h1>
            </div>

            <section aria-labelledby="sub-heading">
              <h2 id="sub-heading" className="text-[15px] font-bold">
                점수는 이렇게 나왔어요
              </h2>
              {/* 한 줄에 항목 이름(왼쪽) · 막대 · 점수 */}
              <dl className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-3 text-[14px]">
                {SUB_SCORES.map((s) => (
                  <div key={s.key} className="contents">
                    <dt className="leading-tight">
                      <span className="block font-medium">{s.name}</span>
                      <span className="block text-[12px] text-muted">반영 {s.weight}</span>
                    </dt>
                    <dd className="h-3 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                      <div className="h-full rounded-full" style={{ width: `${compat[s.key]}%`, backgroundColor: s.color }} />
                    </dd>
                    <dd className="min-w-[2.75em] text-right font-bold">{compat[s.key]}점</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="radar-heading">
              <h2 id="radar-heading" className="text-[15px] font-bold">
                두 사람의 금융습관 겹쳐 보기
              </h2>
              <div className="card mt-3 p-2">
                <RadarCompare
                  a={{ name: `나 · ${virtualMe.nickname}`, values: virtualMe.levels, color: 'var(--ink)', dashed: true }}
                  b={{ name: `상대 · ${partner.nickname}`, values: partner.levels, color: 'var(--p)' }}
                />
              </div>
              <details className="group mt-3">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-[14px] font-medium text-muted [&::-webkit-details-marker]:hidden">
                  자세히 보기
                  <span aria-hidden="true" className="transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-[14px]">
                    <thead>
                      <tr className="border-b border-line text-[12px] text-muted">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          항목
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          나
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          상대
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...compat.axisCompare].sort((x, y) => DISPLAY_AXIS_KEYS.indexOf(x.key) - DISPLAY_AXIS_KEYS.indexOf(y.key)).map((row) => (
                        <tr key={row.key} className="border-b border-line last:border-0">
                          <th scope="row" className="py-2 pr-3 font-medium text-muted">
                            {row.part}
                          </th>
                          <td className="py-2 pr-3">{row.meLabel}</td>
                          <td className="py-2">{row.partnerLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>

            <section aria-labelledby="reason-heading" aria-busy={!reason && !reasonError}>
              <h2 id="reason-heading" className="text-[15px] font-bold">
                이 사람을 추천하는 이유
              </h2>
              {reasonError && (
                <div className="mt-3">
                  <ErrorNote message={reasonError} onRetry={() => void loadReason()} />
                </div>
              )}
              {!reason && !reasonError && (
                <div className="card mt-3 flex flex-col gap-3 p-4" aria-label="추천 이유를 쓰는 중">
                  <div className="skeleton h-6 w-3/4" />
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-11/12" />
                  <div className="skeleton h-4 w-4/5" />
                </div>
              )}
              {reason && (
                <div className="bg-persona-tint border-persona-soft mt-3 rounded-card border p-4">
                  <p className="text-[19px] font-bold leading-snug [text-wrap:balance]">{reason.headline}</p>
                  <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-relaxed">
                    {reason.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <dl className="mt-4 flex flex-col gap-2.5">
                    {[
                      { label: '서로 맞춰가면 좋을 점', text: reason.watch_out },
                      { label: '어울리는 데이트', text: reason.date_tip },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[14px] border border-line bg-surface px-4 py-3">
                        <dt className="text-[13px] font-bold" style={{ color: 'var(--p)' }}>
                          {item.label}
                        </dt>
                        <dd className="mt-1 text-[16px] font-semibold leading-snug [text-wrap:balance]">{item.text}</dd>
                      </div>
                    ))}
                  </dl>
                  {reason.source !== 'llm' && <p className="mt-4 text-[12px] text-muted">점수와 유형을 바탕으로 자동 작성한 글이에요.</p>}
                </div>
              )}
            </section>
          </>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <button type="button" className="btn-primary w-full" onClick={() => router.push('/recommend')}>
            다른 후보 보기
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => {
              start();
              router.push('/');
            }}
          >
            다시 하기
          </button>
        </div>
      </div>
    </StepShell>
  );
}
