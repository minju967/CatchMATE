import { NEIGHBOR_REGIONS, RECOMMEND, VIRTUAL_ME } from './config';
import { partnerFit, type FitInput } from './fit';
import { sameZone } from './regions';
import type { Customer, Gender, Rng } from './types';

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── S2 가상의 나 (§6.1) ──────────────────────────────────────────────────

export interface VirtualMeInput {
  gender: Gender;
  region: string;
  age: number;
  incomeBand: number;
  excludeIds?: string[];
  /** 나이·지역·성별·소득구간을 모두 정확히 일치시키고 완화하지 않는다. 모자라면 모자란 대로 돌려준다. */
  strict?: boolean;
}

type Stage = (c: Customer, input: VirtualMeInput) => boolean;

const ageWithin = (n: number): Stage => (c, i) => Math.abs(c.age - i.age) <= n;
const bandWithin = (n: number): Stage => (c, i) => Math.abs(c.incomeBand - i.incomeBand) <= n;
const regionSame: Stage = (c, i) => c.region === i.region;
const regionZone: Stage = (c, i) => sameZone(c.region, i.region);

// 단계가 올라갈수록 조건이 하나씩 풀린다. 성별은 끝까지 유지.
const VIRTUAL_STAGES: Stage[][] = [
  [regionSame, ageWithin(VIRTUAL_ME.ageStrict), bandWithin(0)], // 1차
  [regionZone, ageWithin(VIRTUAL_ME.ageStrict), bandWithin(0)], // 2차: 같은 권역
  [regionZone, ageWithin(VIRTUAL_ME.ageRelaxed), bandWithin(0)], // 3차: 나이 ±5
  [regionZone, ageWithin(VIRTUAL_ME.ageRelaxed), bandWithin(VIRTUAL_ME.bandRelaxed)], // 4차: 소득 구간 ±1
  [ageWithin(VIRTUAL_ME.ageRelaxed), bandWithin(VIRTUAL_ME.bandRelaxed)], // 5차: 지역 조건 제거
];

/** 풀에서 need 명을 뽑되, 이미 뽑힌 페르소나와 겹치지 않는 사람을 먼저 고른다. 닉네임이 같은 사람은 한 화면에 함께 내지 않는다. */
function pickDiverse(pool: Customer[], picked: Customer[], need: number, rng: Rng): Customer[] {
  const shuffled = shuffle(pool, rng);
  const personas = new Set(picked.map((c) => c.persona));
  const names = new Set(picked.map((c) => c.nickname));
  const out: Customer[] = [];
  for (const requireNewPersona of [true, false]) {
    for (const c of shuffled) {
      if (out.length >= need) break;
      if (names.has(c.nickname) || (requireNewPersona && personas.has(c.persona))) continue;
      personas.add(c.persona);
      names.add(c.nickname);
      out.push(c);
    }
  }
  return out;
}

export function pickVirtualMe(all: Customer[], input: VirtualMeInput, rng: Rng): { candidates: Customer[]; relaxedLevel: number } {
  const exclude = new Set(input.excludeIds ?? []);
  const base = all.filter((c) => c.gender === input.gender && !exclude.has(c.id));
  const picked: Customer[] = [];
  let relaxedLevel = 0;
  // strict: 성별·소득구간은 끝까지 정확히 일치. 지역·나이는 같은 지역 정확 일치 → 같은 지역 ±1 →
  // (소규모 지역만) 인근 지역 정확 일치 → 인근 지역 ±1. 그래도 모자라면 모자란 대로.
  const near = NEIGHBOR_REGIONS[input.region];
  const regionNear: Stage = (c, i) => c.region === i.region || !!near?.includes(c.region);
  const stages = input.strict
    ? [
        [regionSame, ageWithin(0), bandWithin(0)],
        [regionSame, ageWithin(VIRTUAL_ME.ageStrictRelax), bandWithin(0)],
        ...(near
          ? [
              [regionNear, ageWithin(0), bandWithin(0)],
              [regionNear, ageWithin(VIRTUAL_ME.ageStrictRelax), bandWithin(0)],
            ]
          : []),
      ]
    : VIRTUAL_STAGES;

  // 엄격한 단계에서 찾은 사람을 먼저 채우고, 모자란 만큼만 다음 단계에서 보충한다.
  for (let stage = 0; stage < stages.length && picked.length < VIRTUAL_ME.count; stage++) {
    const pool = base.filter((c) => !picked.includes(c) && stages[stage].every((test) => test(c, input)));
    if (pool.length === 0) continue;
    picked.push(...pickDiverse(pool, picked, VIRTUAL_ME.count - picked.length, rng));
    relaxedLevel = stage;
  }

  // 기획서의 완화 단계로도 모자라면(입력 나이가 데이터 범위 밖인 경우 등) 나이가 가까운 순으로 채운다.
  if (!input.strict && picked.length < VIRTUAL_ME.count) {
    const rest = base.filter((c) => !picked.includes(c)).sort((a, b) => Math.abs(a.age - input.age) - Math.abs(b.age - input.age));
    picked.push(...rest.slice(0, VIRTUAL_ME.count - picked.length));
    relaxedLevel = VIRTUAL_STAGES.length;
  }

  return { candidates: picked, relaxedLevel };
}

// ── S5 이성 후보 (§6.3) ──────────────────────────────────────────────────

export interface RecommendInput extends FitInput {
  userGender: Gender;
  virtualMe: Pick<Customer, 'id' | 'age' | 'nickname' | 'region'>;
  excludeIds?: string[];
  /** 비대칭 나이 가이드. 없으면 기존 ±ageStrict/±ageRelaxed 대칭 규칙. */
  ageWindow?: { older: number; younger: number; relaxExtra: number };
  /** 있으면 지역 규칙을 하드 필터로 적용 (me.region, 후보.region) */
  regionRule?: (meRegion: string, candidateRegion: string) => boolean;
  /** 소규모 지역 사용자: 같은 지역 풀이 충분하면 같은 지역만, 모자랄 때만 regionRule 이 허용하는 인근 지역까지 */
  preferSameRegion?: boolean;
}

export interface Recommended {
  customer: Customer;
  /** 선호 적합도 0~100 정수 */
  P: number;
}

export function recommendPartners(all: Customer[], input: RecommendInput, rng: Rng): Recommended[] {
  const regionOk = input.regionRule;
  const others = all.filter(
    (c) =>
      c.gender !== input.userGender &&
      c.id !== input.virtualMe.id &&
      (!regionOk || regionOk(input.virtualMe.region, c.region)),
  );
  const w = input.ageWindow;
  const inAge = (c: Customer, relaxed: boolean) => {
    const diff = c.age - input.virtualMe.age;
    if (!w) return Math.abs(diff) <= (relaxed ? RECOMMEND.ageRelaxed : RECOMMEND.ageStrict);
    const extra = relaxed ? w.relaxExtra : 0;
    return diff >= -(w.younger + extra) && diff <= w.older + extra;
  };

  /** 후보군 → 풀. 페르소나로는 거르지 않고, 나이 조건만 단계적으로 푼다. */
  const buildPool = (candidates: Customer[]): Customer[] => {
    let p = candidates.filter((c) => inAge(c, false));
    if (p.length < RECOMMEND.minPool) p = candidates.filter((c) => inAge(c, true));
    // 나이 가이드(w)는 하드 규칙이라 완화된 나이 창 밖으로는 나가지 않는다.
    if (!w && p.length < RECOMMEND.count) p = candidates;
    return p;
  };

  // 소규모 지역: 같은 지역 후보로 풀이 충분하면 그것만 쓰고, 모자랄 때만 인근 지역까지 넓힌다.
  let pool = buildPool(others);
  if (input.preferSameRegion) {
    const same = buildPool(others.filter((c) => c.region === input.virtualMe.region));
    if (same.length >= RECOMMEND.minPool) pool = same;
  }

  // "다른 후보 보기": 이미 본 후보는 빼되, 남은 인원이 모자라면 다시 포함한다.
  const exclude = new Set(input.excludeIds ?? []);
  const fresh = pool.filter((c) => !exclude.has(c.id));
  if (fresh.length >= RECOMMEND.count) pool = fresh;

  const ranked = pool
    .map((customer) => ({ customer, fit: partnerFit(input, customer) }))
    .sort((a, b) => b.fit - a.fit || a.customer.id.localeCompare(b.customer.id));
  const scored = ranked.slice(0, RECOMMEND.topN);

  // 적합도를 가중치로 한 비복원 랜덤 샘플. 닉네임이 같은 사람(나 포함)은 한 화면에 함께 내지 않는다.
  const picked: typeof scored = [];
  const names = new Set([input.virtualMe.nickname]);
  const personaCount = new Map<string, number>();
  const capped = (s: (typeof scored)[number]) => (personaCount.get(s.customer.persona) ?? 0) >= RECOMMEND.maxSamePersona;
  let remaining = scored.filter((s) => !names.has(s.customer.nickname));
  if (remaining.length < RECOMMEND.count) remaining = [...scored];
  while (picked.length < RECOMMEND.count && remaining.length > 0) {
    const weights = remaining.map((s) => Math.max(s.fit, 1) ** RECOMMEND.weightPower);
    let r = rng() * weights.reduce((a, b) => a + b, 0);
    let idx = weights.findIndex((w) => (r -= w) < 0);
    if (idx < 0) idx = remaining.length - 1;
    const [chosen] = remaining.splice(idx, 1);
    picked.push(chosen);
    names.add(chosen.customer.nickname);
    const distinct = remaining.filter((s) => !names.has(s.customer.nickname));
    if (distinct.length >= RECOMMEND.count - picked.length) remaining = distinct;

    // 한 화면에 같은 페르소나는 maxSamePersona 명까지. 상위 topN 안에서 채울 수 없으면 그 밖에서 적합도 높은 순으로 보충한다.
    personaCount.set(chosen.customer.persona, (personaCount.get(chosen.customer.persona) ?? 0) + 1);
    const need = RECOMMEND.count - picked.length;
    if (need > 0) {
      let allowed = remaining.filter((s) => !capped(s));
      if (allowed.length < need) {
        const used = new Set([...picked, ...remaining].map((s) => s.customer.id));
        const extra = ranked.filter((s) => !used.has(s.customer.id) && !capped(s) && !names.has(s.customer.nickname));
        allowed = [...allowed, ...extra.slice(0, need - allowed.length)];
      }
      if (allowed.length >= need) remaining = allowed;
    }
  }

  return picked.sort((a, b) => b.fit - a.fit).map((s) => ({ customer: s.customer, P: Math.round(s.fit) }));
}
