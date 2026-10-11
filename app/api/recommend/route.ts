import { handleJson, HttpError } from '@/lib/api';
import { isSmallRegion, PARTNER_AGE_WINDOW, partnerRegionOk } from '@/lib/config';
import { getAllCustomers, getCustomerById } from '@/lib/db';
import { recommendPartners } from '@/lib/recommend';
import { recommendSchema } from '@/lib/schemas';
import { toCard } from '@/lib/types';

export const runtime = 'nodejs';

export function POST(req: Request) {
  return handleJson(req, recommendSchema, async (input) => {
    const virtualMe = await getCustomerById(input.virtualMeId);
    if (!virtualMe) throw new HttpError(404, '선택한 가상의 나를 찾을 수 없어요.');
    const picked = recommendPartners(
      await getAllCustomers(),
      {
        ...input,
        virtualMe,
        ageWindow: { ...PARTNER_AGE_WINDOW[input.userGender], relaxExtra: PARTNER_AGE_WINDOW.relaxExtra },
        regionRule: partnerRegionOk,
        preferSameRegion: isSmallRegion(virtualMe.region),
      },
      Math.random,
    );
    return { candidates: picked.map(({ customer, P }) => ({ ...toCard(customer), P })) };
  });
}
