'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import ProfileCard, { ProfileCardSkeleton } from '@/components/ProfileCard';
import StepShell, { ErrorNote, StepTitle } from '@/components/StepShell';
import { postJson } from '@/lib/client';
import { VIRTUAL_ME } from '@/lib/config';
import type { CustomerCard } from '@/lib/types';
import { useHydrated, useSession } from '@/store/session';

export default function VirtualMePage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { profile, virtualCandidates, virtualRerolls, virtualMe } = useSession();
  const setVirtualCandidates = useSession((s) => s.setVirtualCandidates);
  const chooseVirtualMe = useSession((s) => s.chooseVirtualMe);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const busy = useRef(false);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  /** i번째 카드로 넘긴다 */
  const goTo = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  // 후보가 바뀌면(다시 뽑기) 첫 카드로 돌아간다
  useEffect(() => {
    track.current?.scrollTo({ left: 0 });
    setIndex(0);
  }, [virtualCandidates]);

  const load = useCallback(
    async (isReroll: boolean) => {
      const { profile: p, virtualSeenIds } = useSession.getState();
      if (!p || busy.current) return;
      busy.current = true;
      setLoading(true);
      setError(null);
      try {
        const data = await postJson<{ candidates: CustomerCard[] }>('/api/virtual-me', { ...p, excludeIds: virtualSeenIds });
        if (isReroll && data.candidates.length === 0) setNoMore(true); // 새 후보가 없으면 지금 후보를 그대로 둔다
        else setVirtualCandidates(data.candidates, isReroll);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        busy.current = false;
        setLoading(false);
        setLoaded(true);
      }
    },
    [setVirtualCandidates],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!profile) router.replace('/me');
    else {
      // 세션에 남은 후보가 없거나, 또래 금액이 없는 예전 형식이면 새로 받아온다
      const saved = useSession.getState().virtualCandidates;
      if (saved.length === 0 || saved.some((c) => c.peer?.axes.debt?.amount == null)) void load(false);
      else setLoaded(true);
    }
  }, [hydrated, profile, router, load]);

  const rerollsLeft = VIRTUAL_ME.maxRerolls - virtualRerolls;
  const count = virtualCandidates.length;
  // 조건(성별·소득 구간·지역·나이)에 맞는 사람이 필요한 인원보다 적으면 이미 전부 보여준 것이다
  const fewMatches = loaded && !loading && !error && count < VIRTUAL_ME.count;
  const showSkeleton = loading || (!error && !loaded);

  return (
    <StepShell step={2} onBack={() => router.push('/me')}>
      <StepTitle title="나와 가장 비슷한 사람을 골라주세요" desc={`입력한 조건과 비슷한 가상 인물 ${VIRTUAL_ME.count}명이에요.\n고른 사람이 이번 테스트의 '가상의 나'가 돼요.`} />

      {error && <ErrorNote message={error} onRetry={() => void load(false)} />}

      {fewMatches && (
        <div role="status" className="card p-4 text-[15px] leading-relaxed">
          {count === 0 ? (
            <>
              <p className="font-semibold">조건에 맞는 가상 인물을 찾지 못했어요.</p>
              <p className="mt-1 text-muted">나이나 소득 구간을 바꿔서 다시 찾아보세요.</p>
              <button type="button" className="btn-primary mt-3 w-full" onClick={() => router.push('/me')}>
                내 정보 다시 입력
              </button>
            </>
          ) : (
            <p>
              <span className="font-semibold">조건에 맞는 사람이 {count}명뿐이에요.</span> 같은 조건의 가상 인물을 모두 보여드렸어요.
            </p>
          )}
        </div>
      )}

      {showSkeleton ? (
        <div aria-busy="true">
          <ProfileCardSkeleton tall />
        </div>
      ) : (
        count > 0 && (
          <section aria-roledescription="carousel" aria-label="가상 인물 후보" className="flex flex-col gap-3">
            {/* 한 번에 한 장. 좌우 버튼이나 옆으로 밀기로 넘긴다 */}
            <div
              ref={track}
              onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
              className="-mx-5 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {virtualCandidates.map((card, i) => (
                <div key={card.id} className="w-full shrink-0 snap-center px-5" role="group" aria-roledescription="slide" aria-label={`${count}명 중 ${i + 1}번째`}>
                  <ProfileCard
                    card={card}
                    showAxes
                    selected={virtualMe?.id === card.id}
                    onSelect={() => {
                      chooseVirtualMe(card);
                      router.push('/quiz');
                    }}
                  />
                </div>
              ))}
            </div>
            {count > 1 && (
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="이전 사람" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-sunken disabled:opacity-30">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <p className="text-sm font-semibold text-muted" aria-live="polite">
                  <span className="text-ink">{index + 1}</span> / {count}
                </p>
                <button type="button" onClick={() => goTo(index + 1)} disabled={index >= count - 1} aria-label="다음 사람" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-sunken disabled:opacity-30">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </section>
        )
      )}

      <div className="flex justify-center">
        <button type="button" className="btn-text" disabled={loading || rerollsLeft <= 0 || fewMatches || noMore} onClick={() => void load(true)}>
          {fewMatches || noMore ? '더 보여드릴 후보가 없어요' : rerollsLeft > 0 ? `다시 뽑기 (${rerollsLeft}회 남음)` : '다시 뽑기를 모두 썼어요'}
        </button>
      </div>
    </StepShell>
  );
}
