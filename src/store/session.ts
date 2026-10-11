'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { PublicQuestion } from '@/data/questions';
import type { AxisKey, PrefLevels } from '@/lib/axes';
import type { HabitPreference } from '@/lib/preference';
import type { ReasonResponse } from '@/lib/schemas';
import type { CustomerCard, Gender } from '@/lib/types';

export interface Profile {
  gender: Gender;
  region: string;
  age: number;
  incomeBand: number;
}

/** POST /api/persona 응답: 퀴즈 답변으로 만든 선호 프로필 */
export interface PersonaResult {
  pref: PrefLevels;
  prefWeight: Record<AxisKey, number>;
  /** 상대에게 바라는 금융 습관 (추천에 쓴다) */
  habits: HabitPreference;
  answeredCount: number;
}

export type PartnerCard = CustomerCard & { P: number };

interface SessionState {
  sessionId: string | null;
  profile: Profile | null;
  virtualCandidates: CustomerCard[];
  virtualSeenIds: string[];
  virtualRerolls: number;
  virtualMe: CustomerCard | null;
  /** 지금까지 낸 문항(적응형이라 답에 따라 달라진다). 답은 answers 에 같은 순서로 쌓인다. */
  questions: PublicQuestion[];
  answers: Record<string, string | null>;
  personaResult: PersonaResult | null;
  partners: PartnerCard[];
  partnerSeenIds: string[];
  partnerRerolls: number;
  partner: PartnerCard | null;
  /** 추천 이유 캐시: "가상의 나 id:후보 id" → AI 가 쓴 글. 새로고침해도 같은 글을 보여주고 AI 를 다시 부르지 않는다. */
  reasons: Record<string, ReasonResponse>;
}

interface SessionActions {
  start: () => void;
  setProfile: (profile: Profile) => void;
  setVirtualCandidates: (candidates: CustomerCard[], isReroll: boolean) => void;
  chooseVirtualMe: (card: CustomerCard) => void;
  /** 다음 문항을 이어 붙인다 */
  addQuestion: (question: PublicQuestion) => void;
  /** 답을 기록한다. 앞 문항의 답을 바꾸면 그 뒤에 낸 문항과 답은 지운다. */
  setAnswer: (qid: string, key: string | null) => void;
  setPersonaResult: (result: PersonaResult) => void;
  setPartners: (partners: PartnerCard[], isReroll: boolean) => void;
  choosePartner: (card: PartnerCard) => void;
  cacheReason: (key: string, reason: ReasonResponse) => void;
}

// 앞 단계가 바뀌면 그 결과에 기대던 뒷 단계 상태를 비운다.
const NO_PARTNERS = { partners: [], partnerSeenIds: [], partnerRerolls: 0, partner: null, reasons: {} };
const NO_VIRTUAL = { virtualCandidates: [], virtualSeenIds: [], virtualRerolls: 0, virtualMe: null };

const INITIAL: SessionState = {
  sessionId: null,
  profile: null,
  ...NO_VIRTUAL,
  questions: [],
  answers: {},
  personaResult: null,
  ...NO_PARTNERS,
};

export const useSession = create<SessionState & SessionActions>()(
  persist(
    (set) => ({
      ...INITIAL,
      start: () => set({ ...INITIAL, sessionId: crypto.randomUUID() }),
      setProfile: (profile) => set({ profile, ...NO_VIRTUAL, ...NO_PARTNERS }),
      setVirtualCandidates: (candidates, isReroll) =>
        set((s) => ({
          virtualCandidates: candidates,
          virtualSeenIds: [...s.virtualSeenIds, ...candidates.map((c) => c.id)],
          virtualRerolls: s.virtualRerolls + (isReroll ? 1 : 0),
        })),
      chooseVirtualMe: (card) => set((s) => (s.virtualMe?.id === card.id ? {} : { virtualMe: card, ...NO_PARTNERS })),
      addQuestion: (question) => set((s) => (s.questions.some((q) => q.id === question.id) ? {} : { questions: [...s.questions, question] })),
      setAnswer: (qid, key) =>
        set((s) => {
          if (s.answers[qid] === key) return {};
          const at = s.questions.findIndex((q) => q.id === qid);
          if (at < 0) return {};
          const kept = s.questions.slice(0, at + 1);
          const answers: Record<string, string | null> = {};
          for (const q of kept.slice(0, at)) if (q.id in s.answers) answers[q.id] = s.answers[q.id];
          answers[qid] = key;
          return { questions: kept, answers, personaResult: null, ...NO_PARTNERS };
        }),
      setPersonaResult: (personaResult) => set({ personaResult, ...NO_PARTNERS }),
      setPartners: (partners, isReroll) =>
        set((s) => ({
          partners,
          partnerSeenIds: [...s.partnerSeenIds, ...partners.map((p) => p.id)],
          partnerRerolls: s.partnerRerolls + (isReroll ? 1 : 0),
        })),
      choosePartner: (partner) => set({ partner }),
      cacheReason: (key, reason) => set((s) => ({ reasons: { ...s.reasons, [key]: reason } })),
    }),
    {
      // 페르소나 체계가 5종에서 24종, 16종으로 바뀌고 설문이 적응형으로 바뀌어 예전 세션의 카드는 쓸 수 없다. 이름을 올려 새로 시작하게 한다.
      name: 'f3-session-v4',
      storage: createJSONStorage(() => sessionStorage),
      // 서버 렌더 결과와 어긋나지 않도록 마운트 후에 직접 복원한다 (SessionHydrator).
      skipHydration: true,
    },
  ),
);

/** 세션 복원이 끝났는지. 복원 전에는 상태가 비어 보이므로 리다이렉트 판단을 미뤄야 한다. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (useSession.persist.hasHydrated()) setHydrated(true);
    return useSession.persist.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}
