import { assignPersona } from '@/lib/assign';
import { FINANCE_TYPES } from '@/lib/finance';
import { PERSONAS } from '@/lib/personas';
import { loadPersonaRecords, personaDataPath } from '@/lib/personaData';

// 페르소나 판정 규칙(assign.ts)이 매핑 결과와 모든 고객에서 같은지 확인하고, 분포를 요약한다.
// 사용: npm run verify   (data/persona/customer_persona.csv 가 필요하다: npm run build-persona)

const records = loadPersonaRecords();
const total = records.size;
console.log(`고객 ${total.toLocaleString('ko-KR')}명 (${personaDataPath()})`);

const problems: string[] = [];
const count = new Map<string, number>();
const financeCount = new Map<string, number>();

for (const [id, r] of records) {
  const expected = assignPersona(r.traits);
  if (expected !== r.persona) problems.push(`고객 ${id}: 규칙 ${expected} ≠ 매핑 ${r.persona}`);
  count.set(r.persona, (count.get(r.persona) ?? 0) + 1);
  financeCount.set(r.finance, (financeCount.get(r.finance) ?? 0) + 1);
}

console.log('\n[페르소나 16종]');
console.table(
  Object.fromEntries(
    PERSONAS.map((p) => {
      const n = count.get(p.code) ?? 0;
      return [`${p.code} ${p.name}`, { 인원: n, '비율(%)': Math.round((1000 * n) / total) / 10, '문서 인원': p.count, 일치: n === p.count ? 'O' : 'X' }];
    }),
  ),
);

console.log('\n[재무 상태 6종]');
console.table(
  Object.fromEntries(FINANCE_TYPES.map((f) => [f.name, { 인원: financeCount.get(f.code) ?? 0, '비율(%)': Math.round((1000 * (financeCount.get(f.code) ?? 0)) / total) / 10, 규칙: f.rule }])),
);

for (const p of PERSONAS) if ((count.get(p.code) ?? 0) !== p.count) problems.push(`${p.name}: 인원 ${count.get(p.code) ?? 0} ≠ 문서 ${p.count}`);
if (problems.length > 0) {
  console.error(`\n검증 실패 ${problems.length}건`);
  problems.slice(0, 10).forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`\n검증 통과: ${total}명 모두 규칙 결과가 매핑과 같고, 16개 인원이 문서와 일치합니다.`);
