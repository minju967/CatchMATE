'use client';

import { useRouter } from 'next/navigation';
import { IntroStage, PALETTE, WORDMARK_DONE_AT } from '@/components/F3Logo';
import { QUIZ } from '@/lib/config';
import { useSession } from '@/store/session';

// 첫 화면: 로고 무대(문장 → Fit · Finance · Find → 큐브 → CATCHMATE)가 끝나면 시작 버튼이 마지막에 나온다.
// 무대 색이 고정(블루칩 슬레이트)이라 이 화면은 다크모드에서도 밝은 배경을 쓴다.
export default function LandingPage() {
  const router = useRouter();
  const start = useSession((s) => s.start);

  // 바깥 틀의 아래 여백(모바일 pb-14 · 데스크톱 pb-2)까지 배경을 채우려고 음수 마진으로 내려 덮는다
  return (
    <main className="intro -mb-14 flex flex-1 flex-col px-6 pb-[5.5rem] pt-6" style={{ backgroundColor: PALETTE.snow, color: PALETTE.slate }}>
      <div className="intro-stage mx-auto flex w-full max-w-[480px] flex-1 items-center lg:max-w-[560px]">
        <IntroStage />
      </div>

      <div className="intro-cta mx-auto w-full max-w-[420px]" style={{ animationDelay: `${WORDMARK_DONE_AT.toFixed(2)}s` }}>
        <button
          type="button"
          className="btn w-full text-[17px] hover:opacity-90"
          style={{ backgroundColor: PALETTE.royal, color: PALETTE.snow }}
          onClick={() => {
            start();
            router.push('/me');
          }}
        >
          내 금융 궁합 테스트 시작
        </button>
        <p className="mt-3 text-center text-[13px]" style={{ color: PALETTE.royal, opacity: 0.75 }}>
          질문 {QUIZ.maxAnswers}개 · 약 3분 · 로그인 없이 진행
        </p>
      </div>
    </main>
  );
}
