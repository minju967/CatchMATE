import { GENDER_COLOR, personaStyle } from '@/lib/client';
import { subTag } from '@/lib/assign';
import { financeName } from '@/lib/finance';
import { incomeBandLabel } from '@/lib/regions';
import type { CustomerCard } from '@/lib/types';
import AxisBars from './AxisBars';
import PeerBars from './PeerBars';
import PersonaBadge from './PersonaBadge';

interface Props {
  card: CustomerCard;
  onSelect: () => void;
  selected?: boolean;
  /** 6축 미니 막대 표시 (가상의 나 카드) */
  showAxes?: boolean;
  /** 선호 적합도 % (추천 상대 카드) */
  fit?: number;
  /** 이름을 성별 색으로 (추천 상대 카드) */
  genderColor?: boolean;
}

export default function ProfileCard({ card, onSelect, selected = false, showAxes = false, fit, genderColor = false }: Props) {
  const tag = card.traits ? subTag(card.traits) : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={personaStyle(card.persona)}
      className={`card flex w-full flex-col text-left ${showAxes ? 'gap-4 p-5' : 'gap-3 p-4'} transition-colors hover:bg-sunken ${selected ? 'border-brand shadow-[inset_0_0_0_1px_var(--brand)]' : ''}`}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[17px] font-bold leading-snug" style={genderColor ? { color: GENDER_COLOR[card.gender] } : undefined}>
            {card.nickname}
          </p>
          <p className="mt-0.5 text-[13px] text-muted">
            {card.gender === 'M' ? '남성' : '여성'} · {card.age}세 · {card.region}
            {showAxes && ` · ${incomeBandLabel(card.incomeBand)}`}
          </p>
        </div>
        {fit != null && (
          <p className="shrink-0 text-right text-[12px] leading-tight text-muted">
            선호 적합도
            <span className="block text-[22px] font-bold leading-tight text-ink">{fit}%</span>
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <PersonaBadge code={card.persona} />
        {/* 보조 성향 태그 (또래 대비 희소한 주요 특징 2) */}
        {tag && (
          <span className="chip" title={`${tag.label} · ${tag.type}`}>
            {tag.name}
          </span>
        )}
        {/* 재무 상태 유형 태그 (소득·재산 분위 차이) */}
        {card.finance && <span className="chip">{financeName(card.finance)}</span>}
      </div>
      {showAxes &&
        // 세션에 남은 예전 카드는 또래 금액이 없어 기존 막대로 그린다
        (card.peer?.axes.debt?.amount != null ? (
          <PeerBars peer={card.peer} />
        ) : (
          <AxisBars levels={card.levels} ratios={card.ratios} />
        ))}
    </button>
  );
}

export function ProfileCardSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div className="card flex flex-col gap-3 p-4" aria-hidden="true">
      <div className="skeleton h-5 w-40" />
      <div className="skeleton h-4 w-28" />
      <div className="skeleton h-6 w-56" />
      {tall && <div className="skeleton h-28 w-full" />}
    </div>
  );
}
