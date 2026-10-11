import fs from 'node:fs';
import path from 'node:path';
import { PERSONA_DATA_COLUMNS } from '@/lib/personaData';

// data/persona 의 두 원본 CSV 를 합쳐 앱이 읽는 작은 파일(customer_persona.csv)을 만든다.
//   persona_16_20_24_customer_mapping.csv        → 주요 특징 2개·보조 특징·6지표 유형
//   integrated_feature_df_8_vs_6_traits.csv      → 또래 소득 백분위·재산 분위 (재무 상태 유형 계산용)
// 사용: npm run build-persona

const DIR = path.join(process.cwd(), 'data', 'persona');
const MAPPING = path.join(DIR, 'persona_16_20_24_customer_mapping.csv');
const TRAITS = path.join(DIR, 'integrated_feature_df_8_vs_6_traits.csv');
const OUT = path.join(DIR, 'customer_persona.csv');

function readCsv(file: string) {
  const [head, ...lines] = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  return lines.map((l) => {
    const f = l.split(',');
    if (f.length !== cols.length) throw new Error(`${path.basename(file)}: 컬럼 수 불일치(${f.length}/${cols.length}): ${l.slice(0, 60)}`);
    return Object.fromEntries(cols.map((c, i) => [c, f[i]])) as Record<string, string>;
  });
}

function main() {
  for (const f of [MAPPING, TRAITS]) if (!fs.existsSync(f)) throw new Error(`원본 파일이 없어요: ${f}`);
  const traits = new Map(readCsv(TRAITS).map((r) => [r.customer_id, r]));
  const rows = readCsv(MAPPING).map((m) => {
    const t = traits.get(m.customer_id);
    if (!t) throw new Error(`특징 CSV 에 고객 ${m.customer_id} 가 없어요.`);
    const row: Record<(typeof PERSONA_DATA_COLUMNS)[number], string> = {
      customer_id: m.customer_id,
      main1_indicator: m.main1_indicator,
      main1_type: m.main1_type,
      main2_indicator: m.main2_indicator,
      main2_type: m.main2_type,
      aux_indicator: m.aux_indicator,
      aux_type: m.aux_type,
      peer_income_percentile_peer: t.peer_income_percentile_peer,
      asset_quintile_peer: t.asset_quintile_peer,
      saving_type_peer: t.saving_type_peer,
      spend_segment_percentile_peer_new: t.spend_segment_percentile_peer_new,
      payment_segment: t.payment_segment,
      category_segment_peer: t.category_segment_peer,
      investment_intensity_type_peer: t.investment_intensity_type_peer,
      portfolio_concentration_type: t.portfolio_concentration_type,
    };
    return PERSONA_DATA_COLUMNS.map((c) => row[c]).join(',');
  });
  fs.writeFileSync(OUT, [PERSONA_DATA_COLUMNS.join(','), ...rows].join('\n') + '\n');
  console.log(`${rows.length}명 → ${path.relative(process.cwd(), OUT)}`);
}

main();
