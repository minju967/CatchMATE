import { handleJson } from '@/lib/api';
import { getAllCustomers } from '@/lib/db';
import { pickVirtualMe } from '@/lib/recommend';
import { virtualMeSchema } from '@/lib/schemas';
import { toCard } from '@/lib/types';

export const runtime = 'nodejs';

export function POST(req: Request) {
  return handleJson(req, virtualMeSchema, async (input) => {
    // 성별·소득 구간 정확 일치, 지역·나이는 같은 지역 → (소규모 지역만) 인근 지역 순으로 찾는다.
    const { candidates, relaxedLevel } = pickVirtualMe(await getAllCustomers(), { ...input, strict: true }, Math.random);
    return { candidates: candidates.map((c) => toCard(c)), relaxedLevel };
  });
}
