import type { AxisKey, PrefLevels } from '@/lib/axes';
import { AXIS_KEYS } from '@/lib/axes';
import type { PreferenceInput } from '@/lib/compatibility';

/** 축 선호를 직접 지정한 PreferenceInput. 지정하지 않은 축은 선호 없음(null, 가중치 0). */
export function axisPref(levels: Partial<Record<AxisKey, number>>): PreferenceInput {
  const pref = Object.fromEntries(AXIS_KEYS.map((k) => [k, levels[k] ?? null])) as PrefLevels;
  const prefWeight = Object.fromEntries(AXIS_KEYS.map((k) => [k, levels[k] == null ? 0 : 1])) as Record<AxisKey, number>;
  return { pref, prefWeight };
}
