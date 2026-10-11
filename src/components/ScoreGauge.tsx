/** 큰 원형 게이지 (총점 0~100). color 는 점수 구간색 — 숫자는 글자색 그대로 두고 고리만 칠한다. */
export default function ScoreGauge({ score, label, color = 'var(--p)' }: { score: number; label: string; color?: string }) {
  const r = 84;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto h-[208px] w-[208px]" role="img" aria-label={`궁합 점수 ${score}점, ${label}`}>
      <svg viewBox="0 0 208 208" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="104" cy="104" r={r} fill="none" stroke="var(--sunken)" strokeWidth="14" />
        <circle
          cx="104"
          cy="104"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[13px] font-medium text-muted">궁합 점수</p>
        <p className="text-[64px] font-extrabold leading-none tracking-tight">{score}</p>
        <p className="mt-1 text-[13px] text-muted">100점 만점</p>
      </div>
    </div>
  );
}
