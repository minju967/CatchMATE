import type { CSSProperties } from 'react';
import { PERSONA_BY_CODE, type PersonaCode } from './personas';

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
  return data as T;
}

/** 하위 요소가 `persona` 색 유틸리티를 쓸 수 있게 --p 를 지정한다 */
export function personaStyle(code: PersonaCode): CSSProperties {
  return { '--p': `var(${PERSONA_BY_CODE[code].colorVar})` } as CSSProperties;
}

/** 이름에 쓰는 성별 색: 여성 핑크 · 남성 블루 (globals.css 의 --g-* 토큰) */
export const GENDER_COLOR = { F: 'var(--g-female)', M: 'var(--g-male)' } as const;
