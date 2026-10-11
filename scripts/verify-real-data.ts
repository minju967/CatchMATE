import fs from 'node:fs';
import seedrandom from 'seedrandom';
import { AXES } from '@/lib/axes';
import { isSmallRegion, NEIGHBOR_REGIONS, PARTNER_AGE_WINDOW, partnerRegionOk } from '@/lib/config';
import { computeCompatibility } from '@/lib/compatibility';
import { FINANCE_TYPES } from '@/lib/finance';
import { PERSONAS } from '@/lib/personas';
import { loadPersonaRecords } from '@/lib/personaData';
import type { AnswerStep } from '@/lib/evidence';
import { computePreference } from '@/lib/preference';
import { nextQuestion } from '@/lib/survey';
import { pickVirtualMe, recommendPartners } from '@/lib/recommend';
import { toCustomers } from '@/lib/realData';
import type { Customer } from '@/lib/types';

// 실데이터 CSV 로 추천 로직이 돌아가는지만 확인한다. DB·파일에 아무것도 쓰지 않는다.
// 사용: npx tsx scripts/verify-real-data.ts [csv경로]   (페르소나는 data/persona/customer_persona.csv 에서 읽는다)

const DEFAULT_CSV = 'projects/mini-project/feature_df/data/integrated_feature_df.csv';
// 윈도우(C:/)와 WSL(/mnt/c/) 어느 쪽에서 실행해도 찾도록 한다.
const CSV = process.argv.slice(2).find((a) => !a.startsWith('--')) ?? [`C:/${DEFAULT_CSV}`, `/mnt/c/${DEFAULT_CSV}`].find((p) => fs.existsSync(p)) ?? `C:/${DEFAULT_CSV}`;

function parseCsv(path: string) {
  const [head, ...lines] = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  return lines.map((l) => {
    const f = l.split(',');
    if (f.length !== cols.length) throw new Error(`컬럼 수 불일치(${f.length}/${cols.length}): ${l.slice(0, 60)}`);
    return Object.fromEntries(cols.map((c, i) => [c, f[i]])) as Record<string, string>;
  });
}

const dist = (items: string[]) => {
  const m: Record<string, number> = {};
  for (const x of items) m[x] = (m[x] ?? 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  ');
};
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];

// ── 적재 변환 ──
const rows = parseCsv(CSV);
const all = toCustomers(rows, loadPersonaRecords());
console.log(`고객 ${all.length}명 (M ${all.filter((c) => c.gender === 'M').length} / F ${all.filter((c) => c.gender === 'F').length}), 한국나이 ${Math.min(...all.map((c) => c.age))}~${Math.max(...all.map((c) => c.age))}`);
console.log('중복 id:', all.length - new Set(all.map((c) => c.id)).size);
console.log('\n[페르소나 분포 (16종)]');
console.log(dist(all.map((c) => PERSONAS.find((p) => p.code === c.persona)!.name)));
console.log('\n[재무 상태 분포]');
console.log(dist(all.map((c) => FINANCE_TYPES.find((f) => f.code === c.finance)!.name)));
for (const a of AXES) console.log(`축 ${a.key}:`, dist(all.map((c) => a.labels[c.levels[a.key]])));
console.log('지역:', dist(all.map((c) => c.region)));

// ── S2 가상의 나: 성별·지역·나이·소득구간 정확 일치로 5명이 나오는 조합 비율 ──
const rng = seedrandom('real-data-check');
{
  const combos = new Map<string, Customer>();
  for (const c of all) combos.set(`${c.gender}|${c.region}|${c.age}|${c.incomeBand}`, c);
  const short: string[] = [];
  let ok = 0;
  for (const [key, c] of combos) {
    const { candidates } = pickVirtualMe(all, { gender: c.gender, region: c.region, age: c.age, incomeBand: c.incomeBand, strict: true }, rng);
    const bad = candidates.some((x) => x.gender !== c.gender || (x.region !== c.region && !NEIGHBOR_REGIONS[c.region]?.includes(x.region)) || Math.abs(x.age - c.age) > 1 || x.incomeBand !== c.incomeBand);
    if (bad) throw new Error(`가상의 나 규칙 위반: ${key}`);
    if (candidates.length >= 5) ok += 1;
    else short.push(`${key}=${candidates.length}`);
  }
  console.log(`\n[가상의 나 5명 추출 가능 조합] ${ok}/${combos.size} (성별·소득 정확 일치, 같은 지역 나이 정확→±1, 소규모 지역은 인근 지역까지)`);
  if (short.length) console.log('부족 조합 예:', short.slice(0, 8).join(' '), `… 총 ${short.length}개`);
}

// ── 추천 시뮬레이션 ──
const trials = 3000;
let violations = 0;
let dupes = 0;
const pools = new Map<string, number>(); // 사용자 성별별 엄격 풀 크기 합
const poolN = new Map<string, number>();
const Ps: number[] = [];
const totals: number[] = [];
const labelOf: string[] = [];
const emptyCases: string[] = [];
let personaTrials = 0;
let personaHits = 0;

for (let t = 0; t < trials; t++) {
  const me = all[Math.floor(rng() * all.length)];
  // 적응형 설문(10문항)을 무작위로 끝까지 풀어 선호를 계산
  const steps: AnswerStep[] = [];
  for (let q = nextQuestion(`t${t}`, steps); q; q = nextQuestion(`t${t}`, steps)) steps.push({ id: q.id, key: q.options[Math.floor(rng() * q.options.length)].key });
  const answers = Object.fromEntries(steps.map((s) => [s.id, s.key]));
  const pref = computePreference(answers);
  const window = { ...PARTNER_AGE_WINDOW[me.gender], relaxExtra: PARTNER_AGE_WINDOW.relaxExtra };

  const picked = recommendPartners(
    all,
    { ...pref, userGender: me.gender, virtualMe: me, ageWindow: window, regionRule: partnerRegionOk, preferSameRegion: isSmallRegion(me.region) },
    rng,
  );
  if (picked.length < 3) emptyCases.push(`${me.id}/${me.persona}: ${picked.length}명`);
  if (new Set(picked.map((p) => p.customer.id)).size !== picked.length) dupes += 1;
  for (const { customer: c, P } of picked) {
    const diff = c.age - me.age;
    const maxUp = window.older + window.relaxExtra;
    const maxDown = window.younger + window.relaxExtra;
    if (c.gender === me.gender || !partnerRegionOk(me.region, c.region) || diff > maxUp || diff < -maxDown) violations += 1;
    Ps.push(P);
    if (pref.habits.persona) {
      personaTrials += 1;
      if (c.persona === pref.habits.persona) personaHits += 1;
    }
    const comp = computeCompatibility(me, c);
    totals.push(comp.total);
    labelOf.push(comp.label);
  }
  // 엄격 나이 창 안에서 이성 후보가 몇 명인지
  const strict = all.filter((c) => c.gender !== me.gender && partnerRegionOk(me.region, c.region) && c.age - me.age >= -window.younger && c.age - me.age <= window.older).length;
  const key = me.gender;
  pools.set(key, (pools.get(key) ?? 0) + strict);
  poolN.set(key, (poolN.get(key) ?? 0) + 1);
}

console.log(`\n[추천 시뮬레이션 ${trials}회]`);
console.log('3명 미만 추천:', emptyCases.length, emptyCases.slice(0, 5).join(' | '));
console.log('규칙 위반(성별·지역·나이):', violations, ' 중복 후보:', dupes);
console.log('선호 적합도 P  p10/p50/p90:', pct(Ps, 10), pct(Ps, 50), pct(Ps, 90));
console.log(`추천 후보 중 선호 페르소나와 같은 비율: ${personaTrials ? ((100 * personaHits) / personaTrials).toFixed(1) : '-'}% (${personaHits}/${personaTrials}, 선호 페르소나가 정해진 경우)`);
console.log('궁합 총점      p10/p50/p90:', pct(totals, 10), pct(totals, 50), pct(totals, 90));
console.log('등급 분포:', dist(labelOf));
console.log('\n[엄격 나이창 내 이성 후보 평균 수 (사용자 성별별)]');
for (const g of ['M', 'F']) console.log(g, poolN.get(g) ? ((pools.get(g) ?? 0) / poolN.get(g)!).toFixed(0) : '-', `(n=${poolN.get(g) ?? 0})`);
