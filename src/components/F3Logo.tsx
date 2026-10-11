import type { CSSProperties } from 'react';

// CatchMATE 첫 화면 무대 — Figma "F3" 초안 iPhone 17 - 12 → 13 → 17 → 14 순서.
// 화면 색은 '블루칩 슬레이트' 팔레트, 큐브 로고만 원래 로고 색(노랑 · 파랑 · 초록 · 차콜).
//  1. "나에게 맞는 금융 파트너를 찾다" 문장이 화면 가운데에 나온다
//  2. 구절이 단어로 바뀐다: 나에게 맞는 → Fit · 금융 → Finance · 파트너를 찾다 → Find
//  3. 각 단어의 F 만 떨어져 통통통 튀며 원래 로고처럼 큐브로 합체한다 (17 - 17 화살표 메모)
//  4. CATCHMATE 글씨가 나타난다
//  (5. 시작 버튼은 page.tsx 에서 제일 마지막에)
// 좌표는 Figma 프레임 폭(402) 기준이고, 무대는 화면 폭에 맞춰 늘고 줄인다.

export const STAGE = { x: 0, y: 280, w: 402, h: 290 };

/** 블루칩 슬레이트: #0F1B2D · #1E3A8A · #60A5FA · #E0F2FE · #F8FAFF (그림자·두께는 이 색끼리 섞은 톤) */
export const PALETTE = {
  slate: '#0F1B2D',
  royal: '#1E3A8A',
  sky: '#60A5FA',
  mist: '#E0F2FE',
  snow: '#F8FAFF',
} as const;

type FKey = 'fit' | 'finance' | 'find';
type Face = 'top' | 'left' | 'right';

/**
 * 로고 색은 원래 CatchMATE 로고(F3 로고.png)를 따른다: 윗면 노랑 · 왼쪽 파랑 · 오른쪽 초록 · 짙은 차콜 몸통.
 * face = 앞면, shade = 큐브에서 튀어나온 두께. 단어(Fit · Finance · Find)의 F 도 같은 색으로 떨어진다.
 */
const F_COLORS: Record<FKey, { face: string; shade: string }> = {
  fit: { face: '#2563eb', shade: '#1741b4' }, // 파랑 (왼쪽 면)
  finance: { face: '#fbc51c', shade: '#d99a08' }, // 노랑 (윗면)
  find: { face: '#34c083', shade: '#1f9160' }, // 초록
};
/** 큐브 몸통: 원래 로고의 짙은 차콜, 면마다 밝기만 조금씩 다르게 */
const CORE = { top: '#3a3d45', left: '#25272d', right: '#2f3239' };
/** 몸통은 F 보다 작게 안쪽으로 들여 F 사이 틈으로만 보이게 한다 (원래 로고처럼) */
const CORE_SCALE = 0.84;

// ── 타임라인 (초) ──
const SENTENCE_AT = 1.2;
const SWAP_AT = 2.2; // 첫 구절이 단어로 바뀌기 시작 (문장을 읽을 시간 2.2초)
const PHRASE_OUT = 0.5; // 구절이 사라지는 시간 (globals.css .phrase-out 과 같게)
const SWAP_STEP = 1.1; // 구절이 하나씩 바뀌는 간격 — 차례가 아닌 구절은 그대로 남아 있다
/** 구절이 사라지기 시작하는 시각 / 그 자리에 단어가 나오는 시각 (구절이 다 사라진 다음) */
const swapAt = (w: { swap: number }) => SWAP_AT + w.swap * SWAP_STEP;
const wordInAt = (w: { swap: number }) => swapAt(w) + PHRASE_OUT + 0.1;
/** Finance 로 바뀔 때 '파트너를 찾다' 가 오른쪽으로 비켜서는 거리 (inance 와 겹치지 않게). Find 로 바뀔 때는 같은 거리만큼 제자리로 돌아온다 */
const PUSH_BY = 43;
/** 비켜서는 동작을 '금융' 이 바뀌기 이 시간 전에 시작해, inance 가 나타나기 전에 (0.9초 동작이) 끝나게 한다 */
const PUSH_LEAD = 0.45;
const HOP_DURATION = 2.2;
/** F 가 떨어지기 시작하는 시각: 단어 순서대로 Fit → Finance → Find (앞 F 가 자리를 잡은 뒤 다음 F 가 내려온다) */
/** F 가 떨어지기 시작하기 이 시간 전에 꼬리 글자가 다 사라진다 (F 가 움직이며 글자를 가리지 않게) */
const TAIL_GONE_BEFORE = 0.05;
const WORD_IN_DURATION = 0.6; // globals.css .word-in 과 같게
const DROP_START = SWAP_AT + 2 * SWAP_STEP + PHRASE_OUT + 0.1 + WORD_IN_DURATION + PHRASE_OUT + TAIL_GONE_BEFORE; // 마지막 단어(Find)가 다 나오면 바로 (꼬리 글자 페이드 포함)
const DROP_AT: Record<FKey, number> = { fit: DROP_START, finance: DROP_START + 0.4, find: DROP_START + 0.8 };
const LAND = 0.88; // hop 애니메이션에서 큐브 앞 자리에 닿는 지점
/** 세 F 가 큐브 자리에 정방향으로 다 모인 뒤 큐브 면으로 눕는 시간 (Fit → Finance → Find 순으로 조금씩 늦게) */
const MERGE_ORDER: FKey[] = ['fit', 'finance', 'find'];
const MERGE_AT = DROP_AT.find + HOP_DURATION * LAND + 0.2;
const MERGE_DURATION = 0.7;
const MERGE_STAGGER = 0.12;
const mergeStart = (k: FKey) => MERGE_AT + MERGE_ORDER.indexOf(k) * MERGE_STAGGER;
const mergeEnd = (k: FKey) => mergeStart(k) + MERGE_DURATION;
export const F_GATHERED_AT = mergeEnd('find');

// ── 문장 · 단어 (화면 가운데) ──
const LINE_Y = 352; // 문장 밑줄 = 단어 밑줄 (큐브 가운데보다 살짝 위)
const SENTENCE_SIZE = 28;
// 단어 F: 로고의 F 처럼 두툼하고 정사각형에 가까운 비율(폭 35.7 × 높이 50). 화면에서는 0.8배.
const FW = 35.7;
const FH = 50;
const FLAT_F = [
  { x: 0, y: 0, w: 13, h: 50 }, // 세로 기둥
  { x: 0, y: 0, w: 35.7, h: 14 }, // 위 가로
  { x: 0, y: 22.5, w: 32, h: 14 }, // 가운데 가로
];
const FLAT_F_RADIUS = 6;
/** 단어 F 의 두께(오른쪽 아래로 겹쳐 그리는 겹 수 · 간격) */
const FLAT_DEPTH = 5;
const FLAT_DEPTH_STEP = 0.8;
const WORD_SCALE = 0.8;
const WORD_F_TOP = LINE_Y - FH * WORD_SCALE;
const TAIL_SIZE = 24;
/** F 와 꼬리 글자 사이 간격 (F 의 두께가 오른쪽으로 튀어나온 만큼 포함) */
const TAIL_GAP = 6;

/**
 * ko · koX: 문장 속 구절과 그 가운데. Pretendard 600 · 28px 폭(22px 실측 97.7 / 37.1 / 116.2, 띄어쓰기 5.7 을 28/22 배한 124.3 / 47.2 / 147.9, 7.3)으로
 *   문장 전체가 화면 가운데에 오게 했다.
 * swap: 구절이 단어로 바뀌는 차례(0부터): Fit → Finance → Find.
 * x: 단어 왼쪽 끝 = F 의 왼쪽. F(폭 28.6)가 문장 속 '나' · '금' · '찾' 글자 가운데에 오도록 잡았다(글자 폭 28px 기준 23.4).
 *   꼬리 Outfit 600 · 24px 실측 폭: it 15.3 · inance 71.5 · ind 33.5.
 */
const WORDS: { key: FKey; face: Face; ko: string; koX: number; tail: string; x: number; swap: number }[] = [
  { key: 'fit', face: 'left', ko: '나에게 맞는', koX: 96.2, tail: 'it', x: 72.9, swap: 0 },
  { key: 'finance', face: 'top', ko: '금융', koX: 189.2, tail: 'inance', x: 142.5, swap: 1 },
  { key: 'find', face: 'right', ko: '파트너를 찾다', koX: 294.0, tail: 'ind', x: 262.8, swap: 2 },
];

// ── 큐브 (원래 로고: 윗면 · 왼쪽 · 오른쪽 각각 F) ──
const CUBE = { x: 201, y: 410, edge: 84 };
const S = CUBE.edge / 100;
const C = 86.6; // 100·cos30°
const FACES: Record<Face, { m: [number, number, number, number]; matrix: string; c: [number, number]; n: [number, number] }> = {
  top: { m: [0.866, -0.5, 0.866, 0.5], matrix: `matrix(0.866 -0.5 0.866 0.5 ${-C} -50)`, c: [0, -50], n: [0, -1] },
  left: { m: [0.866, 0.5, 0, 1], matrix: `matrix(0.866 0.5 0 1 ${-C} -50)`, c: [-43.3, 25], n: [-0.866, 0.5] },
  right: { m: [0.866, -0.5, 0, 1], matrix: 'matrix(0.866 -0.5 0 1 0 0)', c: [43.3, 25], n: [0.866, 0.5] },
};
/** 떨어지는 F 가 면에 닿을 때 크기: 단어 F 의 폭 · 높이를 각각 큐브 면 F 의 폭 · 높이(면의 92%)에 맞춘다 */
const FIT = 92;
/**
 * 떨어진 F 가 눕기 전에 정방향으로 모이는 자리 (큐브 가운데 높이, 가로로 나란히).
 * 왼쪽 Fit(왼쪽 면) · 가운데 Finance(윗면) · 오른쪽 Find(오른쪽 면) — 눕으며 면으로 갈 때 서로 가로지르지 않는 배치.
 * 떨어지는 동안 F 는 WORD_SCALE → GATHER_SCALE 로 커지며 앞으로 다가온다. 자리 간격은 F 폭(35.7 × 1.3)보다 넓게.
 */
const GATHER_SCALE = 1.3;
const SLOT_GAP = 78;
const SLOT: Record<FKey, { x: number; y: number }> = {
  fit: { x: CUBE.x - SLOT_GAP, y: CUBE.y },
  finance: { x: CUBE.x, y: CUBE.y },
  find: { x: CUBE.x + SLOT_GAP, y: CUBE.y },
};
/**
 * 큐브 면에 붙는 F — 원래 로고처럼 면을 거의 다 덮는 두툼한 블록.
 * 면 좌표 0~100 에 모서리가 둥근 사각형 세 개(세로 기둥 · 위 가로 · 가운데 가로)를 놓고,
 * 몸통(차콜)은 F 사이 틈(가로 사이 · 가운데 가로 아래)으로만 보이게 한다.
 */
const FACE_F_BLOCKS = [
  { x: 0, y: 0, w: 31, h: 100 }, // 세로 기둥 (면 바깥쪽 모서리를 따라)
  { x: 0, y: 0, w: 100, h: 31 }, // 위 가로
  { x: 0, y: 45, w: 90, h: 29 }, // 가운데 가로
];
const FACE_F_RADIUS = 9;
/** F 별로 세로 기둥(꼬리)을 아래로 더 늘이는 길이 (면 좌표). 파랑 F 만 살짝 길게 */
const STEM_EXTRA: Record<FKey, number> = { fit: 12, finance: 0, find: 0 };
/** F 가 면에서 튀어나온 두께 (면 좌표). 원래 로고처럼 두툼하게 */
const DEPTH = 18;
/** 앞면 광택: 왼쪽 위가 밝고 오른쪽 아래로 본래 색 */
const F_GLOSS: Record<FKey, string> = { fit: '#4d87f6', finance: '#ffdc5c', find: '#62d7a3' };

function FBlocks({ fill, stemExtra = 0 }: { fill: string; stemExtra?: number }) {
  return (
    <>
      {FACE_F_BLOCKS.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h + (i === 0 ? stemExtra : 0)} rx={FACE_F_RADIUS} fill={fill} />
      ))}
    </>
  );
}

function CubeFaceF({ k, face }: { k: FKey; face: Face }) {
  const { shade } = F_COLORS[k];
  const { matrix, n } = FACES[face];
  return (
    <>
      {/* 옆면(두께): 법선 방향으로 조금씩 밀며 겹쳐 그린다 */}
      {Array.from({ length: DEPTH }, (_, i) => (
        <g key={i} transform={`translate(${n[0] * i} ${n[1] * i}) ${matrix}`}>
          <FBlocks fill={shade} stemExtra={STEM_EXTRA[k]} />
        </g>
      ))}
      {/* 앞면 + 윗변 하이라이트 */}
      <g transform={`translate(${n[0] * DEPTH} ${n[1] * DEPTH}) ${matrix}`}>
        <FBlocks fill={`url(#gloss-${k})`} stemExtra={STEM_EXTRA[k]} />
        <path d="M12 6H88M6 14V86" stroke="#fff" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
      </g>
    </>
  );
}

/** 단어 속 F: 큐브 면의 F 와 같은 두툼한 둥근 블록에, 색 · 광택 · 두께까지 로고 그대로 */
function FlatF({ k }: { k: FKey }) {
  const { shade } = F_COLORS[k];
  const blocks = (fill: string, dx = 0) => FLAT_F.map((p, i) => <rect key={i} x={p.x + dx} y={p.y + dx} width={p.w} height={p.h} rx={FLAT_F_RADIUS} fill={fill} />);
  return (
    <g transform={`translate(${-FW / 2} ${-FH / 2})`}>
      {Array.from({ length: FLAT_DEPTH }, (_, i) => (
        <g key={i}>{blocks(shade, (FLAT_DEPTH - i) * FLAT_DEPTH_STEP)}</g>
      ))}
      {blocks(`url(#gloss-${k})`)}
      <path d="M6 3.5H30M3.5 8V54" stroke="#fff" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" fill="none" />
    </g>
  );
}

// ── CATCHMATE: 한 가지 색 · 대문자 · 단정한 기하 산세리프(Outfit) ──
const WORDMARK_Y = 578;
export const WORDMARK_AT = F_GATHERED_AT + 0.35;
export const WORDMARK_DONE_AT = WORDMARK_AT + 0.8;

/**
 * 큐브가 다 모인 순간 퍼지는 반짝임 (큐브 중심 기준). 두 번에 나눠 터지고, 크기 · 색 · 모양(별 / 점)이 섞여 있다.
 * 난수 없이 번호로 계산해서 서버 · 브라우저 렌더 결과가 같다.
 */
const SPARKLE_COLORS = [F_COLORS.fit.face, F_COLORS.finance.face, F_COLORS.find.face, PALETTE.sky];
const SPARKLE_SIZES = [1.3, 0.8, 1.7, 1.05, 0.7, 1.45];
const SPARKLE_COUNT = 18;
const SPARKLES = Array.from({ length: SPARKLE_COUNT }, (_, i) => {
  const angle = (i / SPARKLE_COUNT) * Math.PI * 2 + (i % 2) * 0.22;
  const r = 98 + (i % 3) * 17; // 큐브 둘레에서 세 겹으로
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: +(cos * r * 1.1).toFixed(1),
    y: +(sin * r * 0.74).toFixed(1), // 아래쪽 CATCHMATE 글씨를 가리지 않게 세로는 낮춘다
    sx: `${(cos * 20).toFixed(1)}px`,
    sy: `${(sin * 16).toFixed(1)}px`,
    k: SPARKLE_SIZES[i % SPARKLE_SIZES.length],
    c: SPARKLE_COLORS[i % SPARKLE_COLORS.length],
    dot: i % 4 === 3,
    delay: (i % 9) * 0.09 + (i >= 9 ? 0.8 : 0), // 앞 아홉 개가 먼저, 뒤 아홉 개는 조금 뒤에 한 번 더
  };
});
const STAR = 'M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z';

const at = (s: number): CSSProperties => ({ animationDelay: `${s.toFixed(2)}s` });

/** 첫 화면 무대. 다시 재생하려면 key 를 바꿔 다시 마운트한다. */
export function IntroStage() {
  const drops = [...WORDS].sort((a, b) => DROP_AT[a.key] - DROP_AT[b.key]);
  return (
    <svg
      viewBox={`${STAGE.x} ${STAGE.y} ${STAGE.w} ${STAGE.h}`}
      width="100%"
      overflow="visible"
      className="block"
      role="img"
      aria-label="나에게 맞는 금융 파트너를 찾다 — Fit, Finance, Find 의 F 세 개가 모여 CATCHMATE 큐브 로고가 된다"
    >
      <defs>
        {/* 알약 F 의 은은한 안쪽 그림자 */}
        <filter id="pill-in" x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
          <feOffset dx="3" dy="3" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.22 0" />
          <feBlend mode="normal" in2="SourceGraphic" />
        </filter>
        {(Object.keys(F_GLOSS) as FKey[]).map((k) => (
          <linearGradient key={k} id={`gloss-${k}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={F_GLOSS[k]} />
            <stop offset="0.55" stopColor={F_COLORS[k].face} />
          </linearGradient>
        ))}
        {/* 큐브 아래 그림자 */}
        <radialGradient id="cube-shadow">
          <stop offset="0" stopColor={PALETTE.slate} stopOpacity="0.2" />
          <stop offset="1" stopColor={PALETTE.slate} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 1. 문장 — 구절마다 나중에 단어로 바뀐다 */}
      <g className="intro-in" style={at(SENTENCE_AT)}>
        {WORDS.map((w) => (
          <g key={w.key} className={w.key === 'find' ? 'phrase-push' : undefined} style={w.key === 'find' ? ({ '--push': `${PUSH_BY}px`, ...at(swapAt(WORDS[1]) - PUSH_LEAD) } as CSSProperties) : undefined}>
            {/* Find 로 바뀔 때 비켜섰던 만큼 제자리로 돌아온다 */}
            <g className={w.key === 'find' ? 'phrase-push' : undefined} style={w.key === 'find' ? ({ '--push': `${-PUSH_BY}px`, ...at(swapAt(w)) } as CSSProperties) : undefined}>
              <g className="phrase-out" style={at(swapAt(w))}>
                <text
                  x={w.koX}
                  y={LINE_Y}
                  textAnchor="middle"
                  fontFamily="'Pretendard Variable', Pretendard, sans-serif"
                  fontWeight="600"
                  fontSize={SENTENCE_SIZE}
                  letterSpacing="-0.02em"
                  fill={PALETTE.slate}
                >
                  {w.ko}
                </text>
              </g>
            </g>
          </g>
        ))}
      </g>

      {/* 2. 단어의 꼬리 (it · inance · ind) — 자기 F 가 떨어지면 사라진다 */}
      {WORDS.map((w) => (
        <g key={w.key} className="word-in" style={at(wordInAt(w))}>
          <g className="tail-out" style={at(DROP_AT[w.key] - PHRASE_OUT - TAIL_GONE_BEFORE)}>
            <text x={w.x + FW * WORD_SCALE + TAIL_GAP} y={LINE_Y} fontFamily="Outfit, 'Pretendard Variable', sans-serif" fontWeight="600" fontSize={TAIL_SIZE} fill={PALETTE.slate}>
              {w.tail}
            </text>
          </g>
        </g>
      ))}

      {/* 3. 큐브: 몸통 → 면마다 F 가 눕는 순간 큐브 면의 F 로 */}
      <g className="core-pop" style={at(MERGE_AT + 0.1)}>
        <ellipse cx={CUBE.x} cy={CUBE.y + CUBE.edge + 14} rx={CUBE.edge * 0.95} ry={14} fill="url(#cube-shadow)" />
      </g>
      <g className="cube-hug" style={at(F_GATHERED_AT)}>
        <g transform={`translate(${CUBE.x} ${CUBE.y}) scale(${S})`}>
          <g transform={`scale(${CORE_SCALE})`}>
            <g className="core-pop" style={at(MERGE_AT + 0.1)} strokeLinejoin="round" strokeWidth="3">
              <path d={`M0 -100L${C} -50L0 0L${-C} -50Z`} fill={CORE.top} stroke={CORE.top} />
              <path d={`M${-C} -50L0 0L0 100L${-C} 50Z`} fill={CORE.left} stroke={CORE.left} />
              <path d={`M0 0L${C} -50L${C} 50L0 100Z`} fill={CORE.right} stroke={CORE.right} />
            </g>
          </g>
          {(['left', 'right', 'top'] as Face[]).map((face) => {
            const w = WORDS.find((x) => x.face === face)!;
            return (
              <g key={face} className="face-in" style={at(mergeEnd(w.key) - 0.06)}>
                <CubeFaceF k={w.key} face={face} />
              </g>
            );
          })}
        </g>

        {/* 단어에서 떨어지는 F: 통통 튀며 커져서 큐브 앞에 정방향으로 모이고(Fit → Finance → Find), 다 모이면 큐브 면으로 눕는다 */}
        {drops.map((w) => {
          const f = FACES[w.face];
          const slot = SLOT[w.key];
          const sx = w.x + (FW * WORD_SCALE) / 2;
          const sy = WORD_F_TOP + (FH * WORD_SCALE) / 2;
          const ex = CUBE.x + f.c[0] * S;
          const ey = CUBE.y + f.c[1] * S;
          const kx = (S * FIT) / FW;
          const ky = (S * FIT) / FH;
          const timing = { animationDelay: `${DROP_AT[w.key]}s`, animationDuration: `${HOP_DURATION}s` };
          const merge = { animationDelay: `${mergeStart(w.key).toFixed(2)}s`, animationDuration: `${MERGE_DURATION}s` };
          return (
            <g key={w.key} className="word-in" style={at(wordInAt(w))}>
              <g className="flat-out" style={at(mergeEnd(w.key))}>
                <g transform={`translate(${slot.x} ${slot.y})`}>
                  {/* 자리 → 큐브 면 가운데 */}
                  <g className="merge-move" style={{ '--mx': `${(ex - slot.x).toFixed(1)}px`, '--my': `${(ey - slot.y).toFixed(1)}px`, ...merge } as CSSProperties}>
                    {/* 정방향 → 큐브 면 모양으로 눕기 (자리에서 이미 GATHER_SCALE 이라 그만큼 덜어낸다) */}
                    <g
                      className="f-lie"
                      style={{ '--end': `matrix(${[(f.m[0] * kx) / GATHER_SCALE, (f.m[1] * kx) / GATHER_SCALE, (f.m[2] * ky) / GATHER_SCALE, (f.m[3] * ky) / GATHER_SCALE].map((v) => +v.toFixed(4)).join(', ')}, 0, 0)`, ...merge } as CSSProperties}
                    >
                      <g className="hop-x" style={{ '--dx': `${(sx - slot.x).toFixed(1)}px`, ...timing } as CSSProperties}>
                        <g className="hop-y" style={{ '--dy': `${(sy - slot.y).toFixed(1)}px`, '--hop': '44px', ...timing } as CSSProperties}>
                          <g className="f-grow" style={{ '--from': `scale(${WORD_SCALE})`, '--to': `scale(${GATHER_SCALE})`, ...timing } as CSSProperties}>
                            <FlatF k={w.key} />
                          </g>
                        </g>
                      </g>
                    </g>
                  </g>
                </g>
              </g>
            </g>
          );
        })}
      </g>

      {/* 반짝임 */}
      {SPARKLES.map((sp, i) => (
        <g key={i} transform={`translate(${CUBE.x + sp.x} ${CUBE.y + sp.y})`}>
          <g className="sparkle" style={{ '--sx': sp.sx, '--sy': sp.sy, '--k': sp.k, ...at(F_GATHERED_AT + sp.delay) } as CSSProperties}>
            {sp.dot ? <circle r="2.6" fill={sp.c} /> : <path d={STAR} transform="translate(-6 -6) scale(0.5)" fill={sp.c} />}
          </g>
        </g>
      ))}

      {/* 4. CATCHMATE */}
      <g className="tracking-in" style={at(WORDMARK_AT)} aria-hidden="true">
        <text x={STAGE.w / 2} y={WORDMARK_Y} textAnchor="middle" fontFamily="Outfit, 'Pretendard Variable', sans-serif" fontWeight="700" fontSize="34" fill={PALETTE.royal}>
          CATCHMATE
        </text>
      </g>
    </svg>
  );
}
