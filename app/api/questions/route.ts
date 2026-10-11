import { publicQuestion } from '@/data/questions';
import { handleJson } from '@/lib/api';
import { nextQuestionSchema } from '@/lib/schemas';
import { nextQuestion } from '@/lib/survey';

export const runtime = 'nodejs';

// 적응형 출제: seed(세션 ID)와 지금까지의 응답(순서대로)으로 다음 문항을 돌려준다. 끝났으면 question 이 null.
// 같은 seed·같은 응답이면 같은 문항이라 새로고침해도 이어서 풀 수 있고, 서버는 상태를 저장하지 않는다.
export function POST(req: Request) {
  return handleJson(req, nextQuestionSchema, ({ seed, steps }) => {
    const question = nextQuestion(seed || 'default', steps);
    return { question: question ? publicQuestion(question) : null };
  });
}
