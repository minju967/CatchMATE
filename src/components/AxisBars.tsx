import { AXES, levelLabel, levelPercent, type AxisKey, type Levels, type Ratios } from '@/lib/axes';

/** 습관(축)별 고유 색상. 밝은/어두운 배경 모두에서 보이는 중간 채도 */
export const AXIS_COLORS: Record<AxisKey, string> = {
  saving: '#2e9e6b',
  spending: '#e07a2f',
  investment: '#3b82d6',
  asset: '#8b5cc7',
  income: '#d4a017',
  debt: '#d64a5a',
};

/** 막대를 20%씩 나누는 구분선 위치 (20·40·60·80%, 100%는 막대 끝) */
const DIVIDERS = [20, 40, 60, 80];

/**
 * 6축 가로 막대. 축별 색상으로 실제 수치만큼 채우고, 20% 단위 눈금으로 구간을 나눈다.
 * 저축·소비·투자·부채는 월소득(투자는 가처분소득) 대비 비율, 재산·소득은 또래 안에서의 위치다.
 * 수치 대신 오른쪽에는 같은 데이터 안에서의 수준(또래 대비 라벨)만 보여준다.
 */
export default function AxisBars({ levels, ratios }: { levels: Levels; ratios?: Ratios }) {
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 text-[13px]">
        {AXES.map((axis) => {
          // 저장된 예전 카드에는 ratios 가 없을 수 있어 단계 위치로 대신한다
          const raw = ratios?.[axis.key] ?? levelPercent(axis.key, levels[axis.key]);
          const pct = Math.max(0, Math.min(100, raw));
          const color = AXIS_COLORS[axis.key];
          return (
            <div key={axis.key} className="contents">
              <dt className="flex items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
                {axis.part}
              </dt>
              <dd className="relative h-3 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, minWidth: '0.375rem', backgroundColor: color }} />
                {DIVIDERS.map((d) => (
                  <span key={d} className="absolute inset-y-0 w-px bg-[var(--surface,#fff)] opacity-80" style={{ left: `${d}%` }} />
                ))}
              </dd>
              <dd className="min-w-[4.5em] text-right font-medium">{levelLabel(axis.key, levels[axis.key])}</dd>
            </div>
          );
        })}
      </dl>
      <p className="text-[12px] leading-snug text-muted">막대 한 칸은 20%예요. 오른쪽 글자는 또래와 비교한 수준이에요.</p>
    </div>
  );
}
