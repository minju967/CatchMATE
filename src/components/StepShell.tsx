'use client';

import type { ReactNode } from 'react';

const TOTAL_STEPS = 5;

interface Props {
  /** 1~5 */
  step: number;
  onBack: () => void;
  /** 헤더 오른쪽 (예: 질문 화면의 "추천 보기") */
  action?: ReactNode;
  /** 데스크톱(lg)에서 넓게(1120px) 펼치는 화면. 아니면 640px 한 줄 */
  wide?: boolean;
  children: ReactNode;
}

export default function StepShell({ step, onBack, action, wide, children }: Props) {
  const width = wide ? 'max-w-[640px] lg:max-w-[1120px]' : 'max-w-[640px]';
  return (
    <>
      <header className="sticky top-0 z-10 bg-surface/95 px-4 pb-3 pt-3 backdrop-blur">
        <div className={`mx-auto w-full ${width}`}>
          <div className="flex min-h-[44px] items-center justify-between gap-2">
            <button type="button" onClick={onBack} className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-sunken" aria-label="이전 단계로">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <p className="text-sm font-semibold text-muted">
              <span className="text-ink">{step}</span> / {TOTAL_STEPS}
            </p>
            <div className="flex min-w-[44px] justify-end">{action}</div>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-label="전체 진행 단계" aria-valuemin={1} aria-valuemax={TOTAL_STEPS} aria-valuenow={step}>
            <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
          </div>
        </div>
      </header>
      <main className={`mx-auto flex w-full flex-1 flex-col gap-5 px-5 pb-8 pt-4 ${width}`}>{children}</main>
    </>
  );
}

export function StepTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight [text-wrap:balance]">{title}</h1>
      {desc && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-muted">{desc}</p>}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-start gap-2 p-4 text-sm">
      <p className="font-medium">{message}</p>
      {onRetry && (
        <button type="button" className="btn-text -ml-3" onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
