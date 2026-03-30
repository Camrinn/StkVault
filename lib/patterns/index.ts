/**
 * Chart Pattern Detection
 *
 * Detects three patterns from daily OHLCV bars:
 *   - Breakout: Price clears 20-day high with volume confirmation
 *   - Bull Flag: Strong pole + tight consolidation channel
 *   - Cup & Handle: U-shaped base + small handle near prior high
 */

export type PatternType =
  | "bull_flag"
  | "breakout"
  | "cup_and_handle"
  | "golden_cross"
  | "death_cross";

export interface DetectedPattern {
  pattern_type: PatternType;
  confidence: number; // 0–100
  description: string;
}

interface Bar {
  c: number; // close
  h: number; // high
  l: number; // low
  v: number; // volume
}

/**
 * Run all pattern detectors on a sorted (oldest→newest) bar array.
 */
export function detectPatterns(bars: Bar[]): DetectedPattern[] {
  if (bars.length < 20) return [];
  const results: DetectedPattern[] = [];

  const breakout = detectBreakout(bars);
  if (breakout) results.push(breakout);

  const bullFlag = detectBullFlag(bars);
  if (bullFlag) results.push(bullFlag);

  if (bars.length >= 45) {
    const cup = detectCupAndHandle(bars);
    if (cup) results.push(cup);
  }

  return results;
}

// ─── Breakout ─────────────────────────────────────────────────────────────────

function detectBreakout(bars: Bar[]): DetectedPattern | null {
  const lookback = bars.slice(-21, -1); // 20 bars excluding today
  const today = bars[bars.length - 1];
  if (lookback.length < 20) return null;

  const prevHighest = Math.max(...lookback.map((b) => b.c));
  if (today.c <= prevHighest) return null; // no breakout

  const avgVol = lookback.reduce((s, b) => s + b.v, 0) / lookback.length;
  const volConfirm = today.v > avgVol * 1.5;
  const breakPct = ((today.c - prevHighest) / prevHighest) * 100;

  // Reject micro-moves that are just noise
  if (breakPct < 0.3) return null;

  let confidence = 45;
  if (volConfirm) confidence += 30;
  if (breakPct > 1.5) confidence += 10;
  if (breakPct > 3) confidence += 10;
  if (today.c > today.h * 0.98) confidence += 5; // closed near day high

  return {
    pattern_type: "breakout",
    confidence: Math.min(100, confidence),
    description: `20-day breakout above $${prevHighest.toFixed(2)} (+${breakPct.toFixed(1)}%)${
      volConfirm ? " — volume confirmed" : ""
    }`,
  };
}

// ─── Bull Flag ────────────────────────────────────────────────────────────────

function detectBullFlag(bars: Bar[]): DetectedPattern | null {
  if (bars.length < 25) return null;

  // Pole = prior 15 bars, flag = last 10 bars
  const poleWindow = bars.slice(-25, -10);
  const flagWindow = bars.slice(-10);

  const poleStart = poleWindow[0].c;
  const poleEnd = poleWindow[poleWindow.length - 1].c;
  const poleGain = ((poleEnd - poleStart) / poleStart) * 100;

  if (poleGain < 8) return null; // need a real pole (>8% gain)

  const flagHigh = Math.max(...flagWindow.map((b) => b.c));
  const flagLow = Math.min(...flagWindow.map((b) => b.c));
  const flagRange = ((flagHigh - flagLow) / flagHigh) * 100;

  if (flagRange > 9) return null; // flag too loose
  if (flagHigh > poleEnd * 1.03) return null; // not really a flag if it ran higher

  const poleAvgVol = poleWindow.reduce((s, b) => s + b.v, 0) / poleWindow.length;
  const flagAvgVol = flagWindow.reduce((s, b) => s + b.v, 0) / flagWindow.length;
  const volContraction = flagAvgVol < poleAvgVol * 0.8;

  let confidence = 45;
  if (poleGain > 15) confidence += 15;
  if (poleGain > 25) confidence += 5;
  if (flagRange < 4) confidence += 15;
  else if (flagRange < 7) confidence += 7;
  if (volContraction) confidence += 15;

  return {
    pattern_type: "bull_flag",
    confidence: Math.min(100, confidence),
    description: `Bull flag: ${poleGain.toFixed(0)}% pole, ${flagRange.toFixed(1)}% flag range${
      volContraction ? ", vol contracting" : ""
    }. Watch breakout above $${flagHigh.toFixed(2)}`,
  };
}

// ─── MA Crossovers ───────────────────────────────────────────────────────────

/**
 * Detect golden cross or death cross by comparing current vs previous MA values.
 * Call with today's and yesterday's ma_50 / ma_200 from snapshot history.
 */
export function detectMACrossover(
  curMa50: number,
  curMa200: number,
  prevMa50: number,
  prevMa200: number
): DetectedPattern | null {
  if (!curMa50 || !curMa200 || !prevMa50 || !prevMa200) return null;

  const nowAbove = curMa50 > curMa200;
  const wasAbove = prevMa50 > prevMa200;

  if (!wasAbove && nowAbove) {
    return {
      pattern_type: "golden_cross",
      confidence: 90,
      description: `Golden Cross: 50-day MA ($${curMa50.toFixed(2)}) crossed above 200-day MA ($${curMa200.toFixed(2)}). Historically a major bullish signal.`,
    };
  }

  if (wasAbove && !nowAbove) {
    return {
      pattern_type: "death_cross",
      confidence: 85,
      description: `Death Cross: 50-day MA ($${curMa50.toFixed(2)}) crossed below 200-day MA ($${curMa200.toFixed(2)}). Historically a bearish signal.`,
    };
  }

  return null;
}

// ─── Cup & Handle ─────────────────────────────────────────────────────────────

function detectCupAndHandle(bars: Bar[]): DetectedPattern | null {
  // Use last 60 bars (or all available)
  const window = bars.slice(-60);
  const n = window.length;
  if (n < 45) return null;

  const third = Math.floor(n / 3);

  const leftPart = window.slice(0, third);
  const middlePart = window.slice(third, 2 * third);
  const rightPart = window.slice(2 * third, -5); // pre-handle
  const handlePart = window.slice(-5);

  if (!leftPart.length || !middlePart.length || !rightPart.length) return null;

  const leftPeak = Math.max(...leftPart.map((b) => b.c));
  const cupBottom = Math.min(...middlePart.map((b) => b.c));
  const rightPeak = Math.max(...rightPart.map((b) => b.c));

  const depth = ((leftPeak - cupBottom) / leftPeak) * 100;
  if (depth < 12 || depth > 50) return null; // cup too shallow or too deep

  const recovery = ((rightPeak - cupBottom) / (leftPeak - cupBottom)) * 100;
  if (recovery < 75) return null; // hasn't recovered enough

  const handleHigh = Math.max(...handlePart.map((b) => b.c));
  const handleLow = Math.min(...handlePart.map((b) => b.c));
  const handleRange = ((handleHigh - handleLow) / handleHigh) * 100;

  if (handleRange > 12) return null; // handle too volatile

  let confidence = 45;
  if (recovery > 90) confidence += 15;
  if (depth >= 15 && depth <= 35) confidence += 15; // ideal cup depth
  if (handleRange < 5) confidence += 10;
  if (handleHigh > rightPeak * 0.96) confidence += 10; // near breakout point
  if (handleHigh > leftPeak * 0.97) confidence += 5;   // near all-time high

  return {
    pattern_type: "cup_and_handle",
    confidence: Math.min(100, confidence),
    description: `Cup & Handle: ${depth.toFixed(0)}% cup, ${recovery.toFixed(0)}% recovery, ${handleRange.toFixed(
      1
    )}% handle. Breakout above $${handleHigh.toFixed(2)}`,
  };
}
