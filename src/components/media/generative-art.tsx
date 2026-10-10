import { memo } from "react";

/* ═══════════════════════════════════════════════════════════════════════════
   Deterministic procedural artwork.

   There are no photographs in this prototype and we do not fake them with grey
   boxes. Instead every asset is rendered from its own seed and palette by a
   small seeded generator, so the same piece always produces the same frame —
   which is exactly the reproducibility guarantee real generative pipelines
   give you, and is honest about what it is.

   Composition model: sky gradient → atmospheric depth bands → light blooms →
   a horizon silhouette → volumetric haze → grain + vignette. Every parameter
   is drawn from the seeded PRNG, so two pieces never look alike.
   ═══════════════════════════════════════════════════════════════════════════ */

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function rgb(hex: string) {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function mix(a: string, b: string, t: number) {
  const [ar, ag, ab] = rgb(a).split(" ").map(Number);
  const [br, bg, bb] = rgb(b).split(" ").map(Number);
  return `rgb(${Math.round(lerp(ar, br, t))} ${Math.round(lerp(ag, bg, t))} ${Math.round(lerp(ab, bb, t))})`;
}

export type ArtVariant = "still" | "frame" | "avatar" | "mark" | "waveform";

export interface GenerativeArtProps {
  seed: string;
  palette: [string, string, string];
  /** CSS aspect-ratio string; the viewBox is derived from it. */
  ratio?: string;
  variant?: ArtVariant;
  /** Denormalised depth of field: 0 = flat graphic, 1 = heavily defocused. */
  blur?: number;
  className?: string;
  grain?: number;
  /** Optional frame chrome: film-strip sprockets, corner marks. */
  chrome?: boolean;
}

function parseRatio(ratio: string): { w: number; h: number } {
  const m = /^([\d.]+)\s*\/\s*([\d.]+)$/.exec(ratio.trim());
  if (m) return { w: Number(m[1]), h: Number(m[2]) };
  const parts = ratio.split(":").map(Number);
  if (parts.length === 2 && parts.every((n) => Number.isFinite(n) && n > 0)) {
    return { w: parts[0], h: parts[1] };
  }
  return { w: 16, h: 9 };
}

function GenerativeArtImpl({
  seed,
  palette,
  ratio = "16/9",
  variant = "still",
  blur = 0.35,
  className,
  grain = 0.32,
  chrome = false,
}: GenerativeArtProps) {
  const uid = hashSeed(seed).toString(36).slice(0, 7);
  const rand: Rng = mulberry32(hashSeed(seed));
  const [dark, mid, light] = palette;
  const { w: rw, h: rh } = parseRatio(ratio);
  const VW = 160;
  const VH = Math.max(40, Math.round((VW * rh) / rw));

  const glowCount = 2 + Math.floor(rand() * 3);
  const glows = Array.from({ length: glowCount }, (_, i) => ({
    cx: lerp(8, VW - 8, rand()),
    cy: lerp(4, VH * 0.66, rand()),
    r: lerp(VH * 0.28, VH * 0.9, rand()) * (1 - i * 0.11),
    op: lerp(0.22, 0.55, rand()),
    color: i % 2 === 0 ? mid : light,
  }));

  const horizonY = VH * lerp(0.52, 0.76, rand());
  const ridgeA: string[] = [];
  const ridgeB: string[] = [];
  const steps = 14;
  let prev = horizonY;
  for (let i = 0; i <= steps; i++) {
    const x = (VW * i) / steps;
    prev = lerp(horizonY, VH, Math.pow(i / steps, 1.7)) + (rand() - 0.5) * VH * 0.07;
    ridgeA.push(`${x.toFixed(1)},${prev.toFixed(1)}`);
    prev += (rand() - 0.5) * VH * 0.06;
    ridgeB.push(`${x.toFixed(1)},${prev.toFixed(1)}`);
  }
  const silhouette = `M0,${VH} L0,${ridgeA[0]?.split(",")[1]} L${ridgeA.join(" L")} L${VW},${VH} Z`;

  const bands = Array.from({ length: 3 + Math.floor(rand() * 3) }, () => ({
    y: lerp(VH * 0.2, VH * 0.95, rand()),
    h: lerp(0.6, VH * 0.09, rand()),
    op: lerp(0.05, 0.22, rand()),
  }));

  const specks = Array.from({ length: variant === "avatar" ? 0 : 26 }, () => ({
    x: rand() * VW,
    y: rand() * VH * 0.7,
    r: lerp(0.2, 0.75, rand()),
    o: lerp(0.15, 0.7, rand()),
  }));

  const grainId = `grain-${uid}`;
  const softId = `soft-${uid}`;
  const tintId = `tint-${uid}`;

  if (variant === "avatar" || variant === "mark") {
    if (variant === "mark") {
      const rings = Array.from({ length: 4 + Math.floor(rand() * 3) }, (_, i) => ({
        r: 12 + i * lerp(5, 11, rand()),
        o: lerp(0.16, 0.5, 0.7 - i * 0.07),
        dash: rand() > 0.5 ? `${lerp(3, 16, rand()).toFixed(0)} ${lerp(4, 20, rand()).toFixed(0)}` : undefined,
        rot: rand() * 360,
      }));
      const blades = Array.from({ length: 3 + Math.floor(rand() * 3) }, () => ({
        a: rand() * Math.PI * 2,
        l: lerp(18, 46, rand()),
        w: lerp(1.4, 7, rand()),
      }));
      return (
        <svg
          viewBox="0 0 100 100"
          className={className}
          role="img"
          aria-hidden
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id={`${tintId}-a`} cx="30%" cy="22%" r="82%">
              <stop offset="0%" stopColor={mid} stopOpacity="0.95" />
              <stop offset="55%" stopColor={dark} stopOpacity="0.9" />
              <stop offset="100%" stopColor={light} stopOpacity="0.16" />
            </radialGradient>
            <filter id={softId}>
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
          </defs>
          <rect width="100" height="100" fill={dark} />
          <rect width="100" height="100" fill={`url(#${tintId}-a)`} />
          <g filter={`url(#${softId})`}>
            {rings.map((r, i) => (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={r.r}
                fill="none"
                stroke={light}
                strokeOpacity={r.o}
                strokeWidth={lerp(0.6, 2.2, rand())}
                strokeDasharray={r.dash}
                transform={`rotate(${r.rot} 50 50)`}
              />
            ))}
            {blades.map((b, i) => (
              <rect
                key={`b${i}`}
                x={50 + Math.cos(b.a) * b.l}
                y={50 + Math.sin(b.a) * b.l}
                width={b.w}
                height={b.w * lerp(3, 9, rand())}
                rx={b.w / 2}
                fill={i % 2 ? mid : light}
                fillOpacity={0.55}
                transform={`rotate(${((b.a * 180) / Math.PI + 90).toFixed(1)} ${(50 + Math.cos(b.a) * b.l).toFixed(1)} ${(50 + Math.sin(b.a) * b.l).toFixed(1)})`}
              />
            ))}
          </g>
          <circle cx="50" cy="50" r="4.2" fill={light} fillOpacity="0.9" />
        </svg>
      );
    }

    /* Portrait variant — an abstracted head-and-shoulders silhouette over a
       studio-lit gradient. It reads as "a person" at 28px, which a set of
       concentric rings does not. */
    const headR = lerp(15, 18.5, rand());
    const headCx = 50 + lerp(-4, 4, rand());
    const headCy = 42 + lerp(-2, 2, rand());
    const shoulderW = lerp(30, 40, rand());
    const shoulderTop = headCy + headR + lerp(4, 8, rand());
    const keyX = lerp(22, 74, rand());
    const keyY = lerp(14, 34, rand());

    return (
      <svg
        viewBox="0 0 100 100"
        className={className}
        role="img"
        aria-hidden
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id={`${tintId}-bg`} cx={`${keyX}%`} cy={`${keyY}%`} r="86%">
            <stop offset="0%" stopColor={light} stopOpacity="0.92" />
            <stop offset="42%" stopColor={mix(light, mid, 0.55)} />
            <stop offset="100%" stopColor={dark} />
          </radialGradient>
          <linearGradient id={`${tintId}-fig`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0%" stopColor={mix(dark, mid, 0.42)} />
            <stop offset="100%" stopColor={mix(dark, "#000000", 0.4)} />
          </linearGradient>
          <filter id={softId} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
          <filter id={`${grainId}-a`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" stitchTiles="stitch" result="n" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope={grain * 0.6} />
            </feComponentTransfer>
          </filter>
        </defs>

        <rect width="100" height="100" fill={dark} />
        <rect width="100" height="100" fill={`url(#${tintId}-bg)`} />

        <g filter={`url(#${softId})`} opacity="0.34">
          <circle cx={keyX} cy={keyY} r="34" fill={light} opacity="0.32" />
        </g>

        <g filter={`url(#${softId})`}>
          <path
            d={`M${headCx - shoulderW / 2},104 C${headCx - shoulderW / 2},${shoulderTop + 14} ${headCx - headR * 1.15},${shoulderTop} ${headCx},${shoulderTop} C${headCx + headR * 1.15},${shoulderTop} ${headCx + shoulderW / 2},${shoulderTop + 14} ${headCx + shoulderW / 2},104 Z`}
            fill={`url(#${tintId}-fig)`}
          />
          <ellipse cx={headCx} cy={headCy} rx={headR * 0.86} ry={headR} fill={`url(#${tintId}-fig)`} />
        </g>

        <ellipse
          cx={headCx - headR * 0.3}
          cy={headCy - headR * 0.34}
          rx={headR * 0.42}
          ry={headR * 0.3}
          fill={light}
          opacity="0.2"
          transform={`rotate(-18 ${headCx} ${headCy})`}
        />

        <rect
          width="100"
          height="100"
          fill="#000"
          opacity="0.16"
          style={{ mixBlendMode: "multiply" }}
        />
        <rect width="100" height="100" filter={`url(#${grainId}-a)`} opacity="0.5" style={{ mixBlendMode: "overlay" }} />
      </svg>
    );
  }

  if (variant === "waveform") {
    const bars = 72;
    const path: string[] = [];
    let h = 0;
    for (let i = 0; i < bars; i++) {
      h = Math.abs(Math.sin(i * 0.37 + hashSeed(seed) % 7) * Math.sin(i * 0.11) ) * VH * 0.34 +
        lerp(0.02, 0.12, rand());
      path.push(`M${((VW / bars) * i).toFixed(2)},${((VH - h) / 2).toFixed(1)} L${((VW / bars) * (i + 1)).toFixed(2)},${((VH - h) / 2).toFixed(1)}`);
    }
    return (
      <svg viewBox={`0 0 ${VW} ${VH}`} className={className} role="img" aria-hidden preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${tintId}-w`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={dark} />
            <stop offset="45%" stopColor={mid} />
            <stop offset="100%" stopColor={light} />
          </linearGradient>
        </defs>
        <rect width={VW} height={VH} fill={dark} />
        <path d={path.join(" ")} stroke={`url(#${tintId}-w)`} strokeWidth={VH * 0.05} strokeLinecap="round" fill="none" />
      </svg>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className={className}
      role="img"
      aria-label={`Generative preview rendered from seed "${seed}"`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${tintId}-sky`} x1="0" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor={light} stopOpacity={lerp(0.7, 1, rand()).toFixed(2)} />
          <stop offset="42%" stopColor={mix(light, mid, 0.62)} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
        <radialGradient id={`${tintId}-vig`} cx="50%" cy="46%" r="72%">
          <stop offset="55%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.62" />
        </radialGradient>
        <linearGradient id={`${tintId}-haze`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={light} stopOpacity="0" />
          <stop offset="100%" stopColor={light} stopOpacity="0.28" />
        </linearGradient>
        <filter id={softId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={(blur * VH * 0.16).toFixed(2)} />
        </filter>
        <filter id={grainId} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" result="n" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope={grain} />
          </feComponentTransfer>
        </filter>
      </defs>

      <rect width={VW} height={VH} fill={`url(#${tintId}-sky)`} />

      <g filter={`url(#${softId})`}>
        {glows.map((g, i) => (
          <circle key={i} cx={g.cx.toFixed(1)} cy={g.cy.toFixed(1)} r={g.r.toFixed(1)} fill={g.color} opacity={g.op.toFixed(2)} />
        ))}
      </g>

      {bands.map((b, i) => (
        <rect
          key={`b${i}`}
          x={-4}
          y={b.y.toFixed(1)}
          width={VW + 8}
          height={b.h.toFixed(1)}
          fill={light}
          opacity={b.op.toFixed(2)}
        />
      ))}

      <path d={silhouette} fill={mix(dark, "#000000", 0.55)} opacity="0.92" />

      <rect x={-4} y={horizonY.toFixed(1)} width={VW + 8} height={(VH - horizonY).toFixed(1)} fill={`url(#${tintId}-haze)`} />

      {specks.map((s, i) => (
        <circle key={`s${i}`} cx={s.x.toFixed(1)} cy={s.y.toFixed(1)} r={s.r.toFixed(2)} fill="#fff" opacity={s.o.toFixed(2)} />
      ))}

      <rect width={VW} height={VH} fill={`url(#${tintId}-vig)`} />

      {chrome && (
        <g stroke={light} strokeOpacity="0.35" strokeWidth="0.5" fill="none">
          <path d={`M6,14 L6,6 L14,6`} />
          <path d={`M${VW - 14},6 L${VW - 6},6 L${VW - 6},14`} />
          <path d={`M${VW - 6},${VH - 14} L${VW - 6},${VH - 6} L${VW - 14},${VH - 6}`} />
          <path d={`M14,${VH - 6} L6,${VH - 6} L6,${VH - 14}`} />
        </g>
      )}

      <rect width={VW} height={VH} filter={`url(#${grainId})`} opacity="0.55" style={{ mixBlendMode: "overlay" }} />
    </svg>
  );
}

export const GenerativeArt = memo(GenerativeArtImpl);

export function avatarVariant(kind: "portrait" | "abstract" | "mark"): ArtVariant {
  return kind === "mark" ? "mark" : "avatar";
}