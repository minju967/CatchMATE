import { FINANCE_TYPES } from '@/lib/finance';
import { getAllCustomers } from '@/lib/db';
import { PERSONAS } from '@/lib/personas';

// 페르소나·재무 상태 분포 점검표. DB 를 읽기만 하고 아무것도 쓰지 않는다.
// 사용: npm run audit   (규칙이나 경계값을 바꾸기 전후로 돌려 비교한다)

const pct = (n: number, total: number) => (total === 0 ? 0 : Math.round((1000 * n) / total) / 10);
const head = (title: string) => console.log(`\n━━ ${title} ━━`);

async function main() {
  const all = await getAllCustomers();
  console.log(`고객 ${all.length.toLocaleString('ko-KR')}명 기준`);

  head('1. 페르소나 분포 (24종)');
  console.table(Object.fromEntries(PERSONAS.map((p) => [p.name, { 인원: all.filter((c) => c.persona === p.code).length, '비율(%)': pct(all.filter((c) => c.persona === p.code).length, all.length) }])));

  head('2. 재무 상태 분포 (6종)');
  console.table(Object.fromEntries(FINANCE_TYPES.map((f) => [f.name, { 인원: all.filter((c) => c.finance === f.code).length, '비율(%)': pct(all.filter((c) => c.finance === f.code).length, all.length) }])));

  head('3. 페르소나 × 재무 상태 (인원)');
  console.table(
    Object.fromEntries(
      PERSONAS.map((p) => [p.name, Object.fromEntries(FINANCE_TYPES.map((f) => [f.name, all.filter((c) => c.persona === p.code && c.finance === f.code).length]))]),
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
