import { QUESTIONS, QUESTION_BY_ID, type Question, type Role } from '@/data/questions';
import { collectEvidence, type AnswerStep, type Evidence } from './evidence';
import { METRIC_DOMAIN, METRICS, type Metric } from './habits';

// 적응형 출제: 지금까지의 응답(순서대로)에서 다음 문항을 정한다. 서버는 상태를 저장하지 않는다 —
// 같은 seed·같은 응답이면 항상 같은 문항이 나온다.
//
// 순서: 중요도 Q35(가장 중시하는 영역) → 소비·투자를 골랐으면 Q37(영역 안 지표) → 금융 습관 문항 → 재무 1 → 부채 1.
// 건너뛴 문항은 세지 않고 대신 다른 문항을 낸다. 답한 문항이 SURVEY.target 개가 되면 끝이다.
// 습관 문항은 가장 중시하는 지표(없으면 중시하는 영역)의 직접 증거를 먼저 확보한다.

export const SURVEY = {
  /** 답해야 하는 문항 수 */
  target: 10,
  /** 건너뛴 문항까지 포함해 낼 수 있는 최대 문항 수 */
  cap: 14,
  /** 재무·부채 문항 수 (각각 1개) */
  reserved: 2,
} as const;

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 */
function makeRng(seed: string): () => number {
  let a = hashSeed(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 질문의 어느 선택지든 영향을 주는 지표 */
export function metricsOf(q: Question): Metric[] {
  const set = new Set<Metric>();
  for (const o of q.options) for (const e of o.effects) if ('metric' in e) set.add(e.metric);
  return METRICS.filter((m) => set.has(m));
}

const byRole = (role: Role) => QUESTIONS.filter((q) => q.role === role);

function pickHabit(candidates: Question[], ev: Evidence, rng: () => number): Question {
  let best = candidates[0];
  let bestScore = -Infinity;
  for (const q of candidates) {
    let s = 0;
    // 아직 직접 증거가 없는 지표를 다루는 문항 우선
    for (const m of metricsOf(q)) s += ev.direct[m] === 0 ? 2 : Object.keys(ev.score[m]).length ? 0.3 : 1;
    // 가장 중시하는 지표(없으면 영역)의 직접 증거를 먼저 확보한다
    for (const o of q.options) {
      for (const e of o.effects) {
        if (!('metric' in e) || e.strength !== 'd' || ev.direct[e.metric] > 0) continue;
        if (ev.focus === e.metric) s += 4;
        else if (!ev.focus && ev.domain === METRIC_DOMAIN[e.metric]) s += 1.5;
      }
    }
    s += rng() * 0.5;
    if (s > bestScore) [best, bestScore] = [q, s];
  }
  return best;
}

/** 다음 문항. 끝났으면 null. steps 는 지금까지 낸 문항과 답(건너뛴 문항은 key null)이다. */
export function nextQuestion(seed: string, steps: AnswerStep[]): Question | null {
  const known = steps.filter((s) => QUESTION_BY_ID[s.id]);
  if (known.length >= SURVEY.cap) return null;
  const ev = collectEvidence(known);
  if (ev.answered >= SURVEY.target) return null;

  const asked = new Set(known.map((s) => s.id));
  const answeredIn = (role: Role) => known.filter((s) => s.key != null && QUESTION_BY_ID[s.id].role === role).length;
  const rng = makeRng(`${seed}:${known.length}`);

  // 1) 중요도
  if (!asked.has('Q35')) return QUESTION_BY_ID.Q35;
  const within = ev.domain === '소비' ? 'Q37A' : ev.domain === '투자' ? 'Q37B' : null;
  if (within && !asked.has(within)) return QUESTION_BY_ID[within];

  // 2) 금융 습관: 중요도 문항에서 답한 만큼과 재무·부채 몫을 뺀 나머지 자리
  const habitTarget = SURVEY.target - answeredIn('importance') - SURVEY.reserved;
  if (answeredIn('habit') < habitTarget) {
    const pool = byRole('habit').filter((q) => !asked.has(q.id));
    if (pool.length > 0) return pickHabit(pool, ev, rng);
  }

  // 3) 재무 상태 → 부채 상태
  for (const role of ['finance', 'debt'] as const) {
    if (answeredIn(role) >= 1) continue;
    const pool = byRole(role).filter((q) => !asked.has(q.id));
    if (pool.length > 0) return pool[Math.floor(rng() * pool.length)];
  }
  return null;
}
