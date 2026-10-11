import { handleJson } from '@/lib/api';
import { computePreference } from '@/lib/preference';
import { personaSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

// 퀴즈 답변 → 선호 프로필(축 선호·확신 강도·태그 선호). 16종 페르소나는 또래 대비 유형으로 정해서
// 선호 벡터로는 만들 수 없으므로, "끌리는 유형"은 더 이상 계산하지 않는다.
export function POST(req: Request) {
  return handleJson(req, personaSchema, ({ answers }) => computePreference(answers));
}
