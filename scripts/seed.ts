import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import seedrandom from 'seedrandom';
import { SEED, VIRTUAL_ME } from '@/lib/config';
import { customerToRow, DB_PATH, SCHEMA_SQL } from '@/lib/db';
import { generateCustomers } from '@/lib/generate';
import { PERSONAS } from '@/lib/personas';
import { pickVirtualMe } from '@/lib/recommend';
import { INCOME_BANDS, REGIONS } from '@/lib/regions';

// 목업 고객 3,000명 생성 → data/f3.db (§9.4). 시드가 고정이라 몇 번을 돌려도 같은 데이터가 나온다.

const customers = generateCustomers();

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.rmSync(DB_PATH, { force: true });
const db = new Database(DB_PATH);
db.exec(SCHEMA_SQL);
const columns = Object.keys(customerToRow(customers[0]));
const insert = db.prepare(`INSERT INTO customers (${columns.join(', ')}) VALUES (${columns.map((c) => `@${c}`).join(', ')})`);
db.transaction(() => customers.forEach((c) => insert.run(customerToRow(c))))();
db.close();

console.log(`\n${customers.length}명 생성 → ${path.relative(process.cwd(), DB_PATH)} (seed="${SEED.seed}")`);

console.log('\n[성별 × 페르소나] (목업의 페르소나는 실데이터 비율로 무작위 배정한 값)');
console.table(
  Object.fromEntries(
    PERSONAS.map((p) => {
      const of = (g: string) => customers.filter((c) => c.persona === p.code && c.gender === g).length;
      const total = of('M') + of('F');
      return [p.name, { 남: of('M'), 여: of('F'), 합계: total, 비율: `${((100 * total) / customers.length).toFixed(1)}%` }];
    }),
  ),
);

console.log('[지역별 인원]');
console.log(REGIONS.map((r) => `${r} ${customers.filter((c) => c.region === r).length}`).join(' · '));

console.log('\n[소득 구간별 인원]');
console.log(INCOME_BANDS.map((b) => `${b.band}구간 ${customers.filter((c) => c.incomeBand === b.band).length}`).join(' · '));

// 자체 점검: 모든 (성별, 시도, 나이, 소득 구간) 입력에서 가상의 나 5명을 뽑을 수 있는지
const rng = seedrandom('self-check');
const byStage = new Array<number>(7).fill(0);
let failed = 0;
let combos = 0;
for (const gender of ['M', 'F'] as const) {
  for (const region of REGIONS) {
    for (let age = SEED.ageMin; age <= SEED.ageMax; age++) {
      for (const { band } of INCOME_BANDS) {
        combos += 1;
        const { candidates, relaxedLevel } = pickVirtualMe(customers, { gender, region, age, incomeBand: band }, rng);
        if (candidates.length < VIRTUAL_ME.count) failed += 1;
        byStage[relaxedLevel] += 1;
      }
    }
  }
}
console.log(`\n[S2 추출 자체 점검] ${combos}개 입력 조합 중 5명 미달 ${failed}건`);
console.log(
  ['1차(조건 일치)', '2차(권역 확대)', '3차(나이 ±5)', '4차(소득 ±1)', '5차(지역 제거)', '완화 단계 밖(나이 근접순)']
    .map((name, i) => `  ${name}: ${byStage[i]}`)
    .join('\n'),
);
if (failed > 0) process.exitCode = 1;
