import fs from 'node:fs';
import path from 'node:path';
import { assignPersona, isTraitIndicator, type Trait, type TraitIndicator, type Traits } from './assign';
import { financeStatus, type FinanceCode } from './finance';
import { habitLevelsOf, METRIC_INDICATOR, type HabitLevels } from './habits';
import type { PersonaCode } from './personas';

// 서버 전용. 고객별 대표 특징·재무 상태를 data/persona/customer_persona.csv 에서 읽고, 페르소나는 주요 특징 1로 정한다(assign.ts).
// 그 파일은 scripts/build-persona-data.ts 가 매핑 결과(persona_16_20_24_customer_mapping.csv)와 특징 CSV 에서 만든다.

export const PERSONA_DATA_COLUMNS = [
  'customer_id',
  'main1_indicator',
  'main1_type',
  'main2_indicator',
  'main2_type',
  'aux_indicator',
  'aux_type',
  'peer_income_percentile_peer',
  'asset_quintile_peer',
  // 금융 습관 6지표의 실제 유형 (설문 선호와 맞춰 보는 용도)
  'saving_type_peer',
  'spend_segment_percentile_peer_new',
  'payment_segment',
  'category_segment_peer',
  'investment_intensity_type_peer',
  'portfolio_concentration_type',
] as const;

export interface PersonaRecord {
  persona: PersonaCode;
  traits: Traits;
  habits: HabitLevels;
  finance: FinanceCode;
}

export class PersonaDataError extends Error {}

export const personaDataPath = () => process.env.PERSONA_CSV || path.join(process.cwd(), 'data', 'persona', 'customer_persona.csv');

function toTrait(indicator: string, type: string, where: string): Trait {
  if (!isTraitIndicator(indicator) || !type) throw new PersonaDataError(`${where}: 알 수 없는 특징 "${indicator}=${type}"`);
  return { indicator, type };
}

/** CSV 본문 → 고객 ID 별 레코드. 값에 쉼표나 따옴표가 없다는 전제(적재 스크립트와 같다). */
export function parsePersonaCsv(text: string): Map<string, PersonaRecord> {
  const [head, ...lines] = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const cols = head.split(',');
  for (const c of PERSONA_DATA_COLUMNS) if (!cols.includes(c)) throw new PersonaDataError(`페르소나 데이터에 "${c}" 컬럼이 없어요.`);
  const at = Object.fromEntries(PERSONA_DATA_COLUMNS.map((c) => [c, cols.indexOf(c)])) as Record<(typeof PERSONA_DATA_COLUMNS)[number], number>;

  const out = new Map<string, PersonaRecord>();
  for (const line of lines) {
    const f = line.split(',');
    if (f.length !== cols.length) throw new PersonaDataError(`컬럼 수 불일치(${f.length}/${cols.length}): ${line.slice(0, 60)}`);
    const id = f[at.customer_id];
    const main1 = toTrait(f[at.main1_indicator], f[at.main1_type], `고객 ${id} 주요 특징 1`);
    const persona = assignPersona({ main1 });
    if (!persona) throw new PersonaDataError(`고객 ${id}: 페르소나를 정할 수 없는 주요 특징 1 "${main1.indicator}=${main1.type}"`);
    out.set(id, {
      persona,
      traits: {
        main1,
        main2: toTrait(f[at.main2_indicator], f[at.main2_type], `고객 ${id} 주요 특징 2`),
        aux: toTrait(f[at.aux_indicator], f[at.aux_type], `고객 ${id} 보조 특징`),
      },
      habits: habitLevelsOf(Object.fromEntries(Object.values(METRIC_INDICATOR).map((i) => [i, f[at[i]]])) as Record<TraitIndicator, string>),
      finance: financeStatus(Number(f[at.peer_income_percentile_peer]), f[at.asset_quintile_peer]),
    });
  }
  return out;
}

export function loadPersonaRecords(file = personaDataPath()): Map<string, PersonaRecord> {
  if (!fs.existsSync(file)) {
    throw new PersonaDataError(`페르소나 데이터 파일이 없어요: ${file}. \`npm run build-persona\` 로 만드세요.`);
  }
  return parsePersonaCsv(fs.readFileSync(file, 'utf8'));
}
