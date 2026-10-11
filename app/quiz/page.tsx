'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import CollectLoader from '@/components/CollectLoader';
import StepShell, { ErrorNote, StepTitle } from '@/components/StepShell';
import type { PublicQuestion } from '@/data/questions';
import { postJson } from '@/lib/client';
import { QUIZ } from '@/lib/config';
import { useHydrated, useSession, type PersonaResult } from '@/store/session';

/** 마무리 화면의 로딩 애니메이션을 최소한 이만큼은 보여준다 (요청이 더 빨리 끝나도) */
const MIN_LOADING_MS = 3000;

export default function QuizPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const sessionId = useSession((s) => s.sessionId) ?? 'default';
  const virtualMe = useSession((s) => s.virtualMe);
  const questions = useSession((s) => s.questions);
  const answers = useSession((s) => s.answers);
  const addQuestion = useSession((s) => s.addQuestion);
  const setAnswer = useSession((s) => s.setAnswer);
  const setPersonaResult = useSession((s) => s.setPersonaResult);

  // 문항은 답에 따라 하나씩 정해진다. index 는 지금 보고 있는 문항의 위치.
  const [index, setIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetching = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (hydrated && !virtualMe) router.replace('/virtual');
  }, [hydrated, virtualMe, router]);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  useEffect(() => {
    if (index > 0) headingRef.current?.focus();
  }, [index]);

  const answered = Object.values(answers).filter((v) => v != null).length;
  const canFinish = answered >= QUIZ.minAnswers;

  const submit = useCallback(
    async (minMs = 0) => {
      const startedAt = Date.now();
      setSubmitting(true);
      setError(null);
      try {
        const result = await postJson<PersonaResult>('/api/persona', { answers: useSession.getState().answers });
        const wait = minMs - (Date.now() - startedAt);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        setPersonaResult(result);
        router.push('/recommend');
      } catch (e) {
        setError((e as Error).message);
        setSubmitting(false);
      }
    },
    [router, setPersonaResult],
  );

  /** 지금까지의 응답으로 다음 문항을 받아 이어 붙이고 그 문항으로 이동한다. 더 없으면 마무리한다. */
  const loadNext = useCallback(
    async (upTo: PublicQuestion[]) => {
      if (fetching.current) return;
      fetching.current = true;
      setLoadError(null);
      try {
        const { answers: latest } = useSession.getState();
        const steps = upTo.map((q) => ({ id: q.id, key: latest[q.id] ?? null }));
        const { question } = await postJson<{ question: PublicQuestion | null }>('/api/questions', { seed: sessionId, steps });
        if (question) {
          addQuestion(question);
          setIndex(upTo.length);
        } else {
          setFinished(true);
          setIndex(upTo.length);
          if (Object.values(latest).filter((v) => v != null).length >= QUIZ.minAnswers) void submit(MIN_LOADING_MS);
        }
      } catch (e) {
        setLoadError((e as Error).message || '질문을 불러오지 못했어요. 새로고침해 주세요.');
      } finally {
        fetching.current = false;
      }
    },
    [sessionId, addQuestion, submit],
  );

  // 처음이거나 새로고침 뒤: 이미 받은 문항 중 답하지 않은 첫 문항으로, 모두 답했다면 다음 문항을 받는다
  useEffect(() => {
    if (!hydrated || !virtualMe) return;
    const { questions: qs, answers: ans } = useSession.getState();
    const open = qs.findIndex((q) => !(q.id in ans));
    if (open >= 0) setIndex(open);
    else void loadNext(qs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, virtualMe]);

  function choose(q: PublicQuestion, key: string | null) {
    if (timer.current || submitting || fetching.current) return;
    setAnswer(q.id, key);
    setFinished(false);
    const at = useSession.getState().questions.findIndex((x) => x.id === q.id);
    const go = () => void loadNext(useSession.getState().questions.slice(0, at + 1));
    if (key == null) return go();
    // 고른 선택지를 잠깐 보여준 뒤 다음 문항으로
    timer.current = setTimeout(() => {
      timer.current = null;
      go();
    }, QUIZ.autoNextMs);
  }

  function back() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (index > 0) {
      setFinished(false);
      setIndex(index - 1);
    } else router.push('/virtual');
  }

  const total = QUIZ.maxAnswers;
  const q = questions[index];

  if (!q && !finished) {
    return (
      <StepShell step={3} onBack={back}>
        {loadError ? <ErrorNote message={loadError} onRetry={() => void loadNext(useSession.getState().questions)} /> : <div className="skeleton h-64 w-full" aria-label="질문을 불러오는 중" />}
      </StepShell>
    );
  }

  // 마무리 화면: 답이 모자라면 앞 문항으로 돌아가 답하게 하고, 충분하면 선호를 계산 중
  if (finished) {
    return (
      <StepShell step={3} onBack={back}>
        {canFinish ? (
          <>
            <StepTitle title="답변을 모으고 있어요" desc={`${answered}개 답변으로 어울리는 상대를 찾는 중이에요.`} />
            {error ? <ErrorNote message={error} onRetry={() => void submit(MIN_LOADING_MS)} /> : <CollectLoader label="답변을 모으는 중" />}
          </>
        ) : (
          <>
            <StepTitle
              title={`답변이 ${QUIZ.minAnswers - answered}개 더 필요해요`}
              desc={`지금까지 ${answered}개에 답했어요. ${QUIZ.minAnswers}문항에 답해야 추천을 볼 수 있어요. 건너뛴 질문에 답해 주세요.`}
            />
            <ul className="flex flex-col gap-2">
              {questions.map((x, i) =>
                answers[x.id] == null ? (
                  <li key={x.id}>
                    <button type="button" className="option justify-between gap-3" onClick={() => { setFinished(false); setIndex(i); }}>
                      <span>
                        <span className="mr-2 font-semibold text-muted">{i + 1}</span>
                        {x.title}
                      </span>
                      <span className="shrink-0 text-sm text-muted">답하기</span>
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
          </>
        )}
      </StepShell>
    );
  }

  const current = answers[q.id];
  const position = Math.min(index + 1, total);

  return (
    <StepShell step={3} onBack={back}>
      <div>
        <div className="flex items-center justify-end gap-3">
          <span className="text-[13px] text-muted">
            {position} / {total} · 답변 {answered}개
          </span>
        </div>
        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-sunken"
          role="progressbar"
          aria-label="질문 진행"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={position}
        >
          <div className="h-full rounded-full bg-muted transition-[width] duration-300" style={{ width: `${(position / total) * 100}%` }} />
        </div>
      </div>

      <div>
        <h1 ref={headingRef} tabIndex={-1} className="whitespace-pre-line text-[22px] font-bold leading-snug tracking-tight outline-none [text-wrap:balance]">
          {/* 상황 설명과 질문을 문장 단위로 줄바꿈한다 */}
          {q.text.replace(/([.?!])\s+/g, '$1\n')}
        </h1>
      </div>

      {/* 선택지는 데이터 순서 그대로, 모두 같은 모양 */}
      <div className="flex flex-col gap-2.5" role="group" aria-label="선택지">
        {q.options.map((o) => (
          <button key={o.key} type="button" className="option min-h-[56px]" aria-pressed={current === o.key} onClick={() => choose(q, o.key)}>
            {o.text}
          </button>
        ))}
      </div>

      {(error || loadError) && <ErrorNote message={(error ?? loadError)!} onRetry={() => (error ? void submit() : void loadNext(useSession.getState().questions.slice(0, index + 1)))} />}

      <div className="mt-auto flex flex-col items-center gap-1 pt-2">
        <button type="button" className="btn-text" onClick={() => choose(q, null)}>
          잘 모르겠어요 · 건너뛰기
        </button>
      </div>
    </StepShell>
  );
}
