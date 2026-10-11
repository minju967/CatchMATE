import path from 'node:path';
import mysql from 'mysql2/promise';
import { loadPersonaRecords, PersonaDataError } from './personaData';
import { toCustomers, type RawRow } from './realData';
import type { Customer } from './types';

// 앱은 MySQL 의 실데이터 테이블(DB_TABLE)을 읽고, 고객별 페르소나·대표 특징·재무 상태는 data/persona/customer_persona.csv 에서 붙인다.
// 아래 SQLite 쪽(DB_PATH·SCHEMA_SQL·customerToRow)은 목업 seed 스크립트와 테스트용이다.

export const DB_PATH = path.join(process.cwd(), 'data', 'f3.db');

export const SCHEMA_SQL = `
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  gender TEXT NOT NULL,
  region TEXT NOT NULL,
  age INTEGER NOT NULL,
  income_band INTEGER NOT NULL,
  annual_income INTEGER NOT NULL,
  monthly_income INTEGER NOT NULL,
  monthly_spending INTEGER NOT NULL,
  monthly_saving INTEGER NOT NULL,
  monthly_investment INTEGER NOT NULL,
  total_asset INTEGER NOT NULL,
  total_debt INTEGER NOT NULL,
  annual_repayment INTEGER NOT NULL,
  lv_saving INTEGER NOT NULL,
  lv_spending INTEGER NOT NULL,
  lv_investment INTEGER NOT NULL,
  lv_asset INTEGER NOT NULL,
  lv_income INTEGER NOT NULL,
  lv_debt INTEGER NOT NULL,
  persona TEXT NOT NULL,
  finance TEXT NOT NULL
);
CREATE INDEX idx_customers_me ON customers (gender, region, age, income_band);
CREATE INDEX idx_customers_partner ON customers (gender, age);
`;

type Row = Record<string, string | number | null>;

export function customerToRow(c: Customer): Row {
  return {
    id: c.id,
    nickname: c.nickname,
    gender: c.gender,
    region: c.region,
    age: c.age,
    income_band: c.incomeBand,
    annual_income: c.annualIncome,
    monthly_income: c.monthlyIncome,
    monthly_spending: c.monthlySpending,
    monthly_saving: c.monthlySaving,
    monthly_investment: c.monthlyInvestment,
    total_asset: c.totalAsset,
    total_debt: c.totalDebt,
    annual_repayment: c.annualRepayment,
    lv_saving: c.levels.saving,
    lv_spending: c.levels.spending,
    lv_investment: c.levels.investment,
    lv_asset: c.levels.asset,
    lv_income: c.levels.income,
    lv_debt: c.levels.debt,
    persona: c.persona,
    finance: c.finance,
  };
}

export class DbNotReadyError extends Error {
  constructor() {
    super('데이터베이스에 연결할 수 없어요. .env.local 의 DB_* 설정과 `npm run load-csv` 적재 여부를 확인하세요.');
  }
}

// 1.4만 행이라 한 번 읽어 메모리에 두고 매칭한다. 테이블을 다시 적재했다면 TTL 이 지난 뒤 반영된다.
const CACHE_TTL_MS = 10 * 60 * 1000;
interface Loaded {
  at: number;
  all: Customer[];
  byId: Map<string, Customer>;
}
let cache: Loaded | null = null;
let loading: Promise<Loaded> | null = null;

async function fetchRows(): Promise<RawRow[]> {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_TABLE = 'customers_real' } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME || !/^[A-Za-z0-9_]+$/.test(DB_TABLE)) throw new DbNotReadyError();
  const conn = await mysql.createConnection({ host: DB_HOST, port: Number(DB_PORT) || 3306, user: DB_USER, password: DB_PASSWORD, database: DB_NAME, charset: 'utf8mb4', connectTimeout: 5000 });
  try {
    const [rows] = await conn.query(`SELECT * FROM \`${DB_TABLE}\` ORDER BY customer_id`);
    return rows as RawRow[];
  } finally {
    await conn.end();
  }
}

async function load(): Promise<Loaded> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;
  loading ??= fetchRows()
    .then((rows) => {
      const all = toCustomers(rows, loadPersonaRecords());
      return (cache = { at: Date.now(), all, byId: new Map(all.map((c) => [c.id, c])) });
    })
    .catch((e) => {
      console.error(e);
      // 페르소나 데이터 문제는 원인을 그대로 알려준다 (DB 접속 문제로 오해하지 않게)
      if (e instanceof PersonaDataError) throw e;
      throw e instanceof DbNotReadyError ? e : new DbNotReadyError();
    })
    .finally(() => (loading = null));
  return loading;
}

export async function getAllCustomers(): Promise<Customer[]> {
  return (await load()).all;
}

export async function getCustomerById(id: string): Promise<Customer | undefined> {
  return (await load()).byId.get(id);
}
