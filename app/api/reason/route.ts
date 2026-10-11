import { handleJson } from '@/lib/api';
import { generateReason } from '@/lib/llm';
import { reasonInputSchema } from '@/lib/schemas';

export const runtime = 'nodejs';
export const maxDuration = 30;

export function POST(req: Request) {
  return handleJson(req, reasonInputSchema, (input) => generateReason(input));
}
