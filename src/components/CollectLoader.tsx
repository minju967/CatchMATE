/** 답변을 모으는 동안 보여주는 로딩: 로고의 F 세 개(파랑 · 노랑 · 초록)가 차례로 통통 튄다. */
const COLORS = ['#2563eb', '#fbc51c', '#34c083'];
const SHADES = ['#1741b4', '#d99a08', '#1f9160'];

export default function CollectLoader({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex h-40 w-full items-end justify-center gap-5 pb-6">
      {COLORS.map((color, i) => (
        <div key={color} className="flex flex-col items-center">
          <svg className="collect-hop" width="36" height="50" viewBox="-1 -1 41 56" style={{ animationDelay: `${i * 0.18}s` }} aria-hidden="true">
            {[1, 2, 3, 4].map((d) => (
              <g key={d} fill={SHADES[i]}>
                <rect x={d * 0.8} y={d * 0.8} width="13" height="50" rx="6" />
                <rect x={d * 0.8} y={d * 0.8} width="35.7" height="14" rx="6" />
                <rect x={d * 0.8} y={22.5 + d * 0.8} width="32" height="14" rx="6" />
              </g>
            ))}
            <rect width="13" height="50" rx="6" fill={color} />
            <rect width="35.7" height="14" rx="6" fill={color} />
            <rect y="22.5" width="32" height="14" rx="6" fill={color} />
          </svg>
          <span className="collect-shadow mt-1 block h-1.5 w-8 rounded-full bg-ink/15" style={{ animationDelay: `${i * 0.18}s` }} />
        </div>
      ))}
    </div>
  );
}
