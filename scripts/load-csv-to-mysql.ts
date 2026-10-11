import fs from 'node:fs';
import mysql from 'mysql2/promise';

// 실데이터 CSV 를 MySQL 의 새 테이블로 적재한다. 컬럼은 CSV 헤더 그대로, 타입은 값을 훑어 추론한다.
// 사용: npm run load-csv [-- --dry-run] [-- --replace]
//   --dry-run  DB 에 접속하지 않고 만들어질 CREATE TABLE 만 출력
//   --replace  같은 이름의 테이블이 있으면 지우고 다시 만든다 (없으면 기존 테이블이 있을 때 중단)

const DEFAULT_CSV = 'projects/mini-project/feature_df/data/integrated_feature_df.csv';
// 윈도우(C:/)와 WSL(/mnt/c/) 어느 쪽에서 실행해도 찾도록 한다.
const CSV = process.env.CSV_PATH || [`C:/${DEFAULT_CSV}`, `/mnt/c/${DEFAULT_CSV}`].find((p) => fs.existsSync(p)) || `C:/${DEFAULT_CSV}`;
const TABLE = process.env.DB_TABLE || 'customers_real';
const DRY = process.argv.includes('--dry-run');
const REPLACE = process.argv.includes('--replace');
const BATCH = 500;

if (!/^[A-Za-z0-9_]+$/.test(TABLE)) throw new Error(`DB_TABLE 은 영문·숫자·_ 만 가능합니다: ${TABLE}`);

function parseCsv(path: string) {
  const [head, ...lines] = fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  const rows = lines.map((l) => {
    const f = l.split(',');
    if (f.length !== cols.length) throw new Error(`컬럼 수 불일치(${f.length}/${cols.length}): ${l.slice(0, 60)}`);
    return f;
  });
  return { cols, rows };
}

const INT = /^-?\d+$/;
const NUM = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;

function inferType(values: string[], isKey: boolean): string {
  const filled = values.filter((v) => v !== '');
  if (filled.length && filled.every((v) => INT.test(v))) {
    const big = filled.some((v) => Math.abs(Number(v)) > 2_000_000_000);
    return big ? 'BIGINT' : 'INT';
  }
  if (filled.length && filled.every((v) => NUM.test(v))) return 'DOUBLE';
  const max = Math.max(1, ...filled.map((v) => v.length));
  if (max > 255) return 'TEXT';
  return `VARCHAR(${isKey ? 64 : Math.min(255, Math.ceil((max * 2) / 10) * 10)})`;
}

const { cols, rows } = parseCsv(CSV);
const keyIdx = cols.indexOf('customer_id');
const types = cols.map((c, i) => inferType(rows.map((r) => r[i]), i === keyIdx));
const ddl =
  `CREATE TABLE \`${TABLE}\` (\n` +
  cols.map((c, i) => `  \`${c}\` ${types[i]}${i === keyIdx ? ' NOT NULL' : ' NULL'}`).join(',\n') +
  (keyIdx >= 0 ? `,\n  PRIMARY KEY (\`customer_id\`)` : '') +
  `\n) DEFAULT CHARSET=utf8mb4`;

console.log(`CSV: ${CSV}  (${rows.length}행 × ${cols.length}컬럼) → 테이블 ${TABLE}`);
if (DRY) {
  console.log(ddl);
  process.exit(0);
}

async function main() {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) throw new Error('.env.local 에 DB_HOST / DB_USER / DB_PASSWORD / DB_NAME 을 채우세요.');
  const conn = await mysql.createConnection({ host: DB_HOST, port: Number(DB_PORT) || 3306, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, charset: 'utf8mb4', ...(process.env.DB_SSL === 'true' ? { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } } : {}) });
  try {
    const [exists] = await conn.query('SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ?', [DB_NAME, TABLE]);
    if ((exists as unknown[]).length) {
      if (!REPLACE) throw new Error(`테이블 ${TABLE} 이(가) 이미 있습니다. 덮어쓰려면 --replace 를 붙이세요.`);
      await conn.query(`DROP TABLE \`${TABLE}\``);
    }
    await conn.query(ddl);
    const insertSql = `INSERT INTO \`${TABLE}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES ?`;
    await conn.beginTransaction();
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH).map((r) => r.map((v) => (v === '' ? null : v)));
      await conn.query(insertSql, [chunk]);
    }
    await conn.commit();
    const [[{ n }]] = (await conn.query(`SELECT COUNT(*) AS n FROM \`${TABLE}\``)) as unknown as [[{ n: number }]];
    console.log(`완료: ${TABLE} ${n}행 적재`);
  } catch (e) {
    await conn.rollback().catch(() => {});
    throw e;
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
