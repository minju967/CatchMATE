import { personaStyle } from '@/lib/client';
import { PERSONA_BY_CODE, type PersonaCode, type PersonaTone } from '@/lib/personas';

// 이모지 대신 단색 SVG 아이콘 (stroke = currentColor). 페르소나 16종을 다섯 갈래(tone)로 묶어 아이콘을 쓴다.
const ICON_PATHS: Record<PersonaTone, JSX.Element> = {
  // 쌓인 동전
  SAVER: (
    <>
      <ellipse cx="12" cy="6.5" rx="7" ry="3" />
      <path d="M5 6.5v5.5c0 1.7 3.1 3 7 3s7-1.3 7-3V6.5" />
      <path d="M5 12v5.5c0 1.7 3.1 3 7 3s7-1.3 7-3V12" />
    </>
  ),
  // 나침반
  PLANNER: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  // 우상향 그래프
  GROWER: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  // 반짝임
  ENJOYER: (
    <>
      <path d="M11 3l1.9 5.6 5.6 1.9-5.6 1.9L11 18l-1.9-5.6-5.6-1.9 5.6-1.9z" />
      <path d="M19 16v4M17 18h4" />
    </>
  ),
  // 깃발을 향해 오르는 산
  NEUTRAL: (
    <>
      <path d="M2.5 20l6.5-10 4 6 2-3 6.5 7z" />
      <path d="M9 10V4l4 1.5L9 7" />
    </>
  ),
};

export function PersonaIcon({ code, size = 20 }: { code: PersonaCode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICON_PATHS[PERSONA_BY_CODE[code].tone]}
    </svg>
  );
}

export default function PersonaBadge({ code }: { code: PersonaCode }) {
  return (
    <span
      style={personaStyle(code)}
      className="bg-persona-tint border-persona-soft inline-flex items-center gap-1.5 rounded-full border py-1 pl-2 pr-2.5 text-[13px] font-semibold text-persona"
    >
      <PersonaIcon code={code} size={15} />
      {PERSONA_BY_CODE[code].name}
    </span>
  );
}
