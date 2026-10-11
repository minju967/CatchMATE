'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import ProfileCard, { ProfileCardSkeleton } from '@/components/ProfileCard';
import StepShell, { ErrorNote, StepTitle } from '@/components/StepShell';
import { postJson } from '@/lib/client';
import { RECOMMEND } from '@/lib/config';
import { useHydrated, useSession, type PartnerCard } from '@/store/session';

export default function RecommendPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { profile, virtualMe, personaResult, partners, partner } = useSession();
  const setPartners = useSession((s) => s.setPartners);
  const choosePartner = useSession((s) => s.choosePartner);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  // "다른 후보 보기"는 유료 플랜 기능이라 새로 뽑지 않고 안내만 띄운다
  const [showPaid, setShowPaid] = useState(false);

  // Esc 로 안내 닫기
  useEffect(() => {
    if (!showPaid) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowPaid(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showPaid]);

  const load = useCallback(
    async (isReroll: boolean) => {
      const s = useSession.getState();
      if (!s.profile || !s.virtualMe || !s.personaResult || busy.current) return;
      busy.current = true;
      setLoading(true);
      setError(null);
      try {
        const { pref, prefWeight, habits } = s.personaResult;
        const data = await postJson<{ candidates: PartnerCard[] }>('/api/recommend', {
          userGender: s.profile.gender,
          virtualMeId: s.virtualMe.id,
          pref,
          prefWeight,
          habits,
          excludeIds: s.partnerSeenIds,
        });
        setPartners(data.candidates, isReroll);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        busy.current = false;
        setLoading(false);
      }
    },
    [setPartners],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!profile) router.replace('/me');
    else if (!virtualMe) router.replace('/virtual');
    else if (!personaResult) router.replace('/quiz');
    else if (useSession.getState().partners.length === 0) void load(false);
  }, [hydrated, profile, virtualMe, personaResult, router, load]);

  return (
    <StepShell step={4} onBack={() => router.push('/quiz')}>
      <StepTitle title="이상형에 가까운 세 사람이에요" desc={'내 답변과 실제 습관이 가까운 순서예요.\n궁합을 보고 싶은 한 사람을 골라주세요.'} />

      {error && <ErrorNote message={error} onRetry={() => void load(false)} />}

      <div className="flex flex-col gap-3" aria-busy={loading}>
        {loading || (!error && partners.length === 0)
          ? Array.from({ length: RECOMMEND.count }, (_, i) => <ProfileCardSkeleton key={i} />)
          : partners.map((card) => (
              <ProfileCard
                key={card.id}
                card={card}
                fit={card.P}
                genderColor
                selected={partner?.id === card.id}
                onSelect={() => {
                  choosePartner(card);
                  router.push('/match');
                }}
              />
            ))}
      </div>

      <div className="flex justify-center">
        <button type="button" className="btn-text" disabled={loading} onClick={() => setShowPaid(true)}>
          다른 후보 보기
        </button>
      </div>

      {showPaid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5" onClick={() => setShowPaid(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="paid-title" className="card w-full max-w-[420px] p-5" onClick={(e) => e.stopPropagation()}>
            <h2 id="paid-title" className="text-lg font-bold">
              유료 플랜에서 사용 가능합니다.
            </h2>
            <div className="mt-5">
              <button type="button" className="btn-primary w-full" autoFocus onClick={() => setShowPaid(false)}>
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </StepShell>
  );
}
