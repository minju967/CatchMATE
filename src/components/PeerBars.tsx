import { DISPLAY_AXES, type AxisKey, type PeerPosition } from '@/lib/axes';
import { AXIS_COLORS } from './AxisBars';

/** 축 이름 앞에 붙는 금액의 기준 */
const AMOUNT_PREFIX: Record<AxisKey, string> = { saving: '월 ', spending: '월 ', investment: '월 ', asset: '', income: '월 ', debt: '' };
/** 금액이 0일 때 % 대신 적는 말 */
const ZERO_LABEL: Partial<Record<AxisKey, string>> = { investment: '미투자', debt: '무부채' };

/** 만원 → "52만 원" / "1.2억 원" */
function formatAmount(manwon: number): string {
  if (manwon >= 10000) return `${(Math.round(manwon / 1000) / 10).toLocaleString('ko-KR')}억 원`;
  return `${manwon.toLocaleString('ko-KR')}만 원`;
}

/**
 * 여섯 습관 지표의 실제 금액과 또래(같은 연령대) 대비 위치.
 * 막대 길이와 오른쪽 숫자는 또래 100명 중 이 금액보다 낮은 사람 수(%)이고, 막대가 끝나는 자리 위에 금액 말풍선을 띄운다.
 */
export default function PeerBars({ peer }: { peer: PeerPosition }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] font-semibold">
        또래 대비 <span className="font-normal text-muted">{peer.group.replace('-', '~')}세 {peer.size.toLocaleString('ko-KR')}명 중</span>
      </p>
      <dl className="grid grid-cols-[auto_1fr_auto] items-end gap-x-3 gap-y-3 text-[13px]">
        {DISPLAY_AXES.map(({ key, part }) => {
          const { amount, pct } = peer.axes[key];
          const color = AXIS_COLORS[key];
          // 투자·부채가 아예 없으면 말풍선과 % 대신 오른쪽에 그 상태만 적는다
          const none = amount <= 0 ? ZERO_LABEL[key] : undefined;
          return (
            <div key={key} className="contents">
              <dt className="flex h-4 items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} aria-hidden="true" />
                {part}
              </dt>
              <dd>
                {/* 금액 말풍선: 꼬리가 막대 끝을 가리킨다. 풍선은 자기 너비의 pct% 만큼 당겨서 양 끝에서도 칸 안에 머문다 */}
                <div className="relative h-8">
                  {!none && (
                    <>
                      <span
                        className="absolute top-0 whitespace-nowrap rounded-md bg-[color-mix(in_srgb,var(--line)_55%,var(--surface))] px-2 py-0.5 text-[12px] font-semibold leading-5 text-ink"
                        style={{ left: `${pct}%`, transform: `translateX(-${pct}%)` }}
                      >
                        {AMOUNT_PREFIX[key]}
                        {formatAmount(amount)}
                      </span>
                      <span className="absolute top-[19px] h-2 w-2 -translate-x-1/2 rotate-45 bg-[color-mix(in_srgb,var(--line)_55%,var(--surface))]" style={{ left: `clamp(8px, ${pct}%, calc(100% - 8px))` }} aria-hidden="true" />
                    </>
                  )}
                </div>
                <div className="relative h-4 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                  {pct > 0 && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, minWidth: '0.375rem', backgroundColor: color }} />}
                </div>
              </dd>
              <dd className="flex h-4 min-w-[2.75em] items-center justify-end font-bold">{none ?? `${pct}%`}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
