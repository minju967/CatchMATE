'use client';

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import { DISPLAY_AXES, levelPercent, type AxisKey } from '@/lib/axes';

/** 최저 단계(절제·무부채·미투자 등)도 중심에서 떨어져 보이도록 두는 바닥값 */
const RADAR_FLOOR = 15;
const radarValue = (key: AxisKey, level: number) => RADAR_FLOOR + (levelPercent(key, level) * (100 - RADAR_FLOOR)) / 100;

export interface RadarSeries {
  name: string;
  /** 축 레벨. null 은 "상관없음"(응답 없는 축) */
  values: Record<AxisKey, number | null>;
  /** CSS 색 (var(--…) 가능) */
  color: string;
  dashed?: boolean;
}

interface TickProps {
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  payload?: { value: string };
}

/** 6축 레이더. 축마다 레벨 수가 달라 0~100 으로 정규화해서 그린다. 색과 함께 실선/점선으로도 구분한다. */
export default function RadarCompare({ a, b }: { a: RadarSeries; b?: RadarSeries }) {
  const data = DISPLAY_AXES.map((axis) => ({
    part: axis.part,
    // 응답 없는 축은 가운데(50)에 두고 축 이름 아래에 "상관없음"을 적는다
    a: a.values[axis.key] == null ? 50 : radarValue(axis.key, a.values[axis.key]!),
    b: !b || b.values[axis.key] == null ? 50 : radarValue(axis.key, b.values[axis.key]!),
  }));
  const unanswered = new Set(DISPLAY_AXES.filter((axis) => a.values[axis.key] == null).map((axis) => axis.part));

  const renderTick = ({ x = 0, y = 0, cx = 0, cy = 0, payload }: TickProps) => {
    const part = payload?.value ?? '';
    // 꼭짓점에서 바깥쪽으로 조금 밀어 도형과 겹치지 않게 한다
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const tx = x + (dx / len) * 10;
    const ty = y + (dy / len) * 10;
    return (
      <text x={tx} y={ty} textAnchor={Math.abs(dx) < 4 ? 'middle' : dx > 0 ? 'start' : 'end'} dominantBaseline="central" fontSize={13} fontWeight={600} fill="var(--ink)">
        {part}
        {unanswered.has(part) && (
          <tspan x={tx} dy="1.25em" fontSize={11} fontWeight={500} fill="var(--muted)">
            상관없음
          </tspan>
        )}
      </text>
    );
  };

  return (
    <figure className="m-0">
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="68%" margin={{ top: 16, right: 36, bottom: 16, left: 36 }}>
            <PolarGrid stroke="var(--line)" />
            <PolarAngleAxis dataKey="part" tick={renderTick} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            {b && <Radar dataKey="b" stroke={b.color} strokeWidth={2} strokeDasharray={b.dashed ? '5 4' : undefined} fill={b.color} fillOpacity={0.08} isAnimationActive={false} />}
            <Radar dataKey="a" stroke={a.color} strokeWidth={2.5} strokeDasharray={a.dashed ? '5 4' : undefined} fill={a.color} fillOpacity={0.18} isAnimationActive={false} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13px] text-muted">
        {(b ? [a, b] : [a]).map((s) => (
          <span key={s.name} className="inline-flex items-center gap-2">
            <svg width="26" height="8" aria-hidden="true">
              <line x1="1" y1="4" x2="25" y2="4" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed ? '5 4' : undefined} />
            </svg>
            {s.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
