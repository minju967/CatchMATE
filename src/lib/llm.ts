import Anthropic from '@anthropic-ai/sdk';
import { LLM } from './config';
import { reasonFallback } from './reasonFallback';
import { reasonSchema, type Reason, type ReasonInput, type ReasonResponse } from './schemas';

// 서버 전용. API 키는 클라이언트로 나가지 않는다.

const SYSTEM_PROMPT = `너는 금융 습관 기반 매칭 서비스 'F3'의 궁합 해설가다.
입력된 두 사람의 금융습관 라벨, 사용자의 선호 응답, 점수만 근거로 추천 이유를 쓴다.
점수는 모두 0~100이며 높을수록 두 사람이 잘 맞는다는 뜻이다.
- total: 궁합 총점. label: 총점 등급 이름.
- habit(금융 습관): 저축·소비·투자 성향이 비슷한 정도.
- finance(재무 상태): 재산·소득 수준이 가까운 정도.
- debt(부채 상태): 빚 부담 수준이 비슷한 정도. 둘 다 부채가 없으면 높고, 둘 다 부담이 크면 낮다.
- life(생활 조건): 사는 지역과 나이대가 가까운 정도.
두 사람의 axes 는 저축·소비·투자·재산·소득·부채 수준이고, habits 는 금융 습관 6지표(저축 성향·소비 규모·소비 구성·소비 방식·투자 적극성·포트폴리오 집중도)의 유형이다. 값이 없는 지표는 생략되어 있다. 소비 규모의 "여유형"은 또래보다 소비가 적은 쪽이고 "과소비형"은 많은 쪽이다.
preference.answers 는 사용자가 고른 선호 답변 중 일부만 뽑은 것이다.
규칙:
- 한국어, 친근한 존댓말. 소개팅 앱에서 "이 분과 잘 맞을 것 같아요"라고 소개해 주는 것처럼 짧고 자연스럽게 쓴다.
- 보고서·분석 말투와 "점수가 높아요" 같은 수치 나열은 피하고, 두 사람의 닮은 점이 함께하는 모습으로 자연스럽게 그려지게 쓴다. 같은 표현을 반복하지 않는다. 문장은 짧게, 이모지는 쓰지 않는다.
- life(생활 조건) 점수와 사는 곳·나이대가 가깝다는 내용은 추천 이유에 언급하지 않는다. 금융 습관·재무 상태·부채 상태를 근거로 쓴다.
- 입력에 없는 사실·수치·금액을 지어내지 않는다. 점수는 입력값 그대로만 언급한다.
- 특정 금융상품 추천, 투자 조언, 재정 상태에 대한 평가·훈계·비하를 하지 않는다.
- 성별 고정관념, 외모·직업 추측을 하지 않는다.
- 사용자가 고른 선호 답변 중 최소 1개를 자연스럽게 인용해 연결한다.
- 반드시 아래 JSON만 출력한다.
{
  "headline": "한 줄 요약 (30자 이내)",
  "reasons": ["추천 이유 1 (60자 이내)", "추천 이유 2", "추천 이유 3"],
  "watch_out": "서로 맞춰가면 좋을 점 1가지 (60자 이내)",
  "date_tip": "두 사람의 금융 성향에 어울리는 데이트 제안 1가지 (50자 이내)"
}`;

/** 응답 텍스트에서 JSON 객체를 꺼내 검증한다. 실패하면 null. */
export function parseReason(text: string): Reason | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = reasonSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** 선호 답변 중 n개를 무작위로 뽑는다 (Fisher–Yates). 원본 순서는 유지한다. */
export function sampleAnswers<T>(answers: T[], n: number, rng: () => number = Math.random): T[] {
  const idx = answers.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).sort((a, b) => a - b).map((i) => answers[i]);
}

export async function generateReason(input: ReasonInput): Promise<ReasonResponse> {
  if (!process.env.ANTHROPIC_API_KEY) return reasonFallback(input);

  // 프롬프트에는 선호 답변 3개만 보낸다 (폴백은 전체 답변을 그대로 쓴다)
  const payload: ReasonInput = { ...input, preference: { answers: sampleAnswers(input.preference.answers, LLM.sampleAnswers) } };

  const client = new Anthropic({ maxRetries: 0 });
  const deadline = Date.now() + LLM.timeoutMs;

  // JSON 파싱에 실패하면 1회만 재시도. API 오류·거절·시간 초과는 바로 폴백.
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 1000) break;
    try {
      const response = await client.messages.create(
        {
          model: process.env.LLM_MODEL || LLM.defaultModel,
          max_tokens: LLM.maxTokens,
          system: SYSTEM_PROMPT,
          output_config: { effort: 'low' },
          messages: [{ role: 'user', content: JSON.stringify(payload) }],
        },
        { timeout: remaining },
      );
      if (response.stop_reason === 'refusal') break;
      const text = response.content.map((block) => (block.type === 'text' ? block.text : '')).join('');
      const reason = parseReason(text);
      if (reason) return { ...reason, source: 'llm' };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        console.error(`[reason] LLM 호출 실패 (${error.status ?? 'network'}): ${error.message}`);
      } else {
        console.error('[reason] LLM 호출 실패', error);
      }
      break;
    }
  }
  return reasonFallback(input);
}
