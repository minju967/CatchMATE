import { AXES } from './axes';
import { PERSONAS, type PersonaTone } from './personas';
import type { ReasonInput, ReasonResponse } from './schemas';

// LLM 을 쓸 수 없을 때의 규칙 기반 추천 이유 (§8.3 폴백).
// 가장 높은 하위 점수 + 가장 닮은 축 2개 + 차이가 가장 큰 축 1개로 문장을 만든다.

const SUB_SCORE_TEXT: Record<'habit' | 'finance' | 'debt', (score: number) => string> = {
  habit: (s) => `금융 습관 점수가 ${s}점으로 가장 높아요. 돈을 모으고 쓰는 리듬이 비슷해요.`,
  finance: (s) => `재무 상태 점수가 ${s}점으로 가장 높아요. 소득과 재산 수준이 가까워요.`,
  debt: (s) => `부채 상태 점수가 ${s}점으로 가장 높아요. 빚에 대한 부담 수준이 비슷해요.`,
};

// 페르소나 16종의 색·아이콘 분류(tone)별 데이트 제안
const DATE_TIPS: Record<PersonaTone, string> = {
  SAVER: '예산을 정해두고 즐기는 동네 맛집 탐방은 어때요?',
  PLANNER: '큰 일정만 정하고 떠나는 당일치기 근교 여행은 어때요?',
  GROWER: '서로의 1년 목표를 적어보는 카페 데이트는 어때요?',
  ENJOYER: '가보고 싶던 전시나 공연을 함께 보는 건 어때요?',
  NEUTRAL: '부담 없이 오래 걷는 공원 산책 데이트는 어때요?',
};

export function reasonFallback(input: ReasonInput): ReasonResponse {
  const { me, partner, preference, scores } = input;

  const best = (['habit', 'finance', 'debt'] as const).reduce((a, b) => (scores[b] > scores[a] ? b : a));

  // 라벨을 레벨 순번으로 되돌려 축별 차이를 구한다
  const diffs = AXES.flatMap((axis) => {
    const a = axis.labels.indexOf(me.axes[axis.part]);
    const b = axis.labels.indexOf(partner.axes[axis.part]);
    if (a < 0 || b < 0) return [];
    return [{ part: axis.part, meLabel: me.axes[axis.part], partnerLabel: partner.axes[axis.part], diff: Math.abs(a - b) / (axis.nLevels - 1) }];
  });
  const similar = [...diffs].sort((a, b) => a.diff - b.diff).slice(0, 2);
  const farthest = [...diffs].sort((a, b) => b.diff - a.diff)[0];

  const reasons = [SUB_SCORE_TEXT[best](scores[best])];
  if (similar.length > 0) {
    // 조사(은/는, 와/과)가 라벨에 따라 달라지지 않도록 괄호 표기를 쓴다
    reasons.push(
      '특히 가까운 습관: ' +
        similar.map((s) => (s.diff === 0 ? `${s.part}(둘 다 ${s.meLabel})` : `${s.part}(${s.meLabel} · ${s.partnerLabel})`)).join(', '),
    );
  }
  const quoted = preference.answers[0];
  reasons.push(
    quoted
      ? `'${quoted.q}' 질문에서 고른 답이 ${partner.persona}의 모습과 이어져요.`
      : '이상형 질문에서 고른 답과 닮은 모습을 가진 분이에요.',
  );

  const watch_out =
    farthest && farthest.diff > 0
      ? `${farthest.part} 성향이 서로 달라요(${farthest.meLabel} · ${farthest.partnerLabel}). 기준을 먼저 이야기해 보세요.`
      : '습관이 많이 닮은 만큼, 새로운 시도는 함께 정해 보세요.';

  const partnerTone = PERSONAS.find((p) => p.name === partner.persona)?.tone ?? 'PLANNER';

  return {
    headline: `${scores.total}점, ${scores.label}`,
    reasons,
    watch_out,
    date_tip: DATE_TIPS[partnerTone],
    source: 'fallback',
  };
}
