'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import StepShell, { StepTitle } from '@/components/StepShell';
import { isSmallRegion, NEIGHBOR_REGIONS } from '@/lib/config';
import { INCOME_BANDS, REGIONS } from '@/lib/regions';
import type { Gender } from '@/lib/types';
import { useHydrated, useSession } from '@/store/session';

const AGES = Array.from({ length: 15 }, (_, i) => 25 + i);

export default function MePage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const profile = useSession((s) => s.profile);
  const setProfile = useSession((s) => s.setProfile);

  const [gender, setGender] = useState<Gender | null>(null);
  const [region, setRegion] = useState('');
  const [age, setAge] = useState('');
  const [incomeBand, setIncomeBand] = useState<number | null>(null);
  const [showNearby, setShowNearby] = useState(false);

  // 뒤로 돌아왔을 때 이전 입력을 채워 둔다
  useEffect(() => {
    if (!hydrated || !profile) return;
    setGender(profile.gender);
    setRegion(profile.region);
    setAge(AGES.includes(profile.age) ? String(profile.age) : '');
    setIncomeBand(profile.incomeBand);
  }, [hydrated, profile]);

  const complete = gender != null && region !== '' && age !== '' && incomeBand != null;

  function goNext() {
    if (!complete) return;
    const next = { gender, region, age: Number(age), incomeBand };
    const unchanged = profile && (Object.keys(next) as (keyof typeof next)[]).every((k) => profile[k] === next[k]);
    if (!unchanged) setProfile(next);
    router.push('/virtual');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!complete) return;
    // 소규모 지역은 인근 지역 사람까지 추천한다는 안내를 먼저 보여준다
    if (isSmallRegion(region)) setShowNearby(true);
    else goNext();
  }

  // Esc 로 안내 닫기
  useEffect(() => {
    if (!showNearby) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowNearby(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showNearby]);

  return (
    <StepShell step={1} onBack={() => router.push('/')}>
      <StepTitle title="먼저 나에 대해 알려주세요" desc="비슷한 조건의 가상 인물을 찾는 데만 써요. 어디에도 저장하지 않아요." />
      <form onSubmit={submit} data-gender={gender ?? undefined} className="flex flex-1 flex-col gap-6">
        <fieldset>
          <legend className="field-label">성별</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="성별">
            {(
              [
                ['F', '여성'],
                ['M', '남성'],
              ] as const
            ).map(([value, label]) => (
              <button key={value} type="button" role="radio" aria-checked={gender === value} className="option option-fill justify-center font-semibold" onClick={() => setGender(value)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="region" className="field-label">
              지역
            </label>
            <select id="region" value={region} onChange={(e) => setRegion(e.target.value)} className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-base">
              <option value="" disabled>
                선택
              </option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="age" className="field-label">
              나이
            </label>
            <select id="age" value={age} onChange={(e) => setAge(e.target.value)} className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-base">
              <option value="" disabled>
                선택
              </option>
              {AGES.map((a) => (
                <option key={a} value={a}>
                  {a}세
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="field-label">연소득</legend>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="연소득">
            {INCOME_BANDS.map((b) => (
              <button key={b.band} type="button" role="radio" aria-checked={incomeBand === b.band} className="option option-fill" onClick={() => setIncomeBand(b.band)}>
                {b.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-auto pt-2">
          <button type="submit" className="btn-primary w-full" disabled={!complete}>
            다음
          </button>
        </div>
      </form>

      {showNearby && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5" onClick={() => setShowNearby(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nearby-title"
            aria-describedby="nearby-desc"
            className="card w-full max-w-[420px] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="nearby-title" className="text-lg font-bold">
              {region}은(는) 인근 지역까지 함께 찾아요
            </h2>
            <p id="nearby-desc" className="mt-2 text-[15px] leading-relaxed text-muted">
              {region} 지역은 인원이 적어서, 같은 지역에서 후보가 모자라면 인근 지역({(NEIGHBOR_REGIONS[region] ?? []).join(', ')}) 사람까지 추천해 드려요. 같은 지역 사람이 충분하면 먼저 보여드려요.
            </p>
            <div className="mt-5 flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setShowNearby(false)}>
                취소
              </button>
              <button type="button" className="btn-primary flex-1" autoFocus onClick={goNext}>
                확인하고 계속
              </button>
            </div>
          </div>
        </div>
      )}
    </StepShell>
  );
}
