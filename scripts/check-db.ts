import { getAllCustomers } from '@/lib/db';

// MySQL 테이블을 앱과 같은 경로로 읽어 변환 결과를 요약한다. 사용: npm run check-db
async function main() {
const all = await getAllCustomers();
const dist = (xs: string[]) => Object.entries(xs.reduce<Record<string, number>>((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {})).map(([k, v]) => `${k}:${v}`).join('  ');
console.log(`고객 ${all.length}명, 예시 id ${all[0]?.id}`);
console.log('성별:', dist(all.map((c) => c.gender)));
console.log('페르소나:', dist(all.map((c) => c.persona)));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
