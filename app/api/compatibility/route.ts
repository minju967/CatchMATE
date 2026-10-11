import { handleJson, HttpError } from '@/lib/api';
import { computeCompatibility } from '@/lib/compatibility';
import { getCustomerById } from '@/lib/db';
import { compatibilitySchema } from '@/lib/schemas';

export const runtime = 'nodejs';

export function POST(req: Request) {
  return handleJson(req, compatibilitySchema, async ({ virtualMeId, partnerId }) => {
    const me = await getCustomerById(virtualMeId);
    const partner = await getCustomerById(partnerId);
    if (!me || !partner) throw new HttpError(404, '선택한 프로필을 찾을 수 없어요.');
    return computeCompatibility(me, partner);
  });
}
