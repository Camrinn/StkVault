/**
 * STKVAULT Entry Zone Engine
 *
 * Determines where a stock currently sits relative to key technical levels,
 * and outputs research-framed guidance (NOT trade recommendations).
 *
 * Zones:
 *   extended      — Price is stretched above recent support levels
 *   fair          — Price is near fair value relative to moving averages
 *   pullback      — Price has pulled back to an area of interest
 *   support_test  — Price is testing key support (higher risk/reward)
 */

import type { EntryZone, RiskLabel, EntryZoneData, SymbolSnapshot } from "@/types";

interface EntryZoneInput {
  symbol: string;
  price: number;
  ma_20: number;
  ma_50: number;
  ma_200: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  rsi: number;
  volatility_30d: number;
  atr?: number; // average true range (optional, computed from bars if available)
}

export interface EntryZoneResult {
  current_zone: EntryZone;
  aggressive_entry_low: number;
  aggressive_entry_high: number;
  patient_entry_low: number;
  patient_entry_high: number;
  invalidation_price: number;
  risk_label: RiskLabel;
  summary: string;
}

/**
 * Compute entry zone analysis for a stock.
 */
export function computeEntryZone(input: EntryZoneInput): EntryZoneResult {
  const { symbol, price, ma_20, ma_50, ma_200, fifty_two_week_high, fifty_two_week_low, rsi, volatility_30d } = input;

  // ─── Determine current zone ─────────────────────────────────────────────

  let zone: EntryZone;
  const distFromMA20 = ((price - ma_20) / ma_20) * 100;
  const distFromMA50 = ((price - ma_50) / ma_50) * 100;
  const distFrom52High = ((price - fifty_two_week_high) / fifty_two_week_high) * 100;

  if (distFromMA20 > 8 && distFromMA50 > 12) {
    zone = "extended";
  } else if (distFromMA20 > -2 && distFromMA20 < 4) {
    zone = "fair";
  } else if (distFromMA20 < -2 && distFromMA50 > -5) {
    zone = "pullback";
  } else {
    zone = "support_test";
  }

  // ─── Compute entry bands ────────────────────────────────────────────────

  // Aggressive entry: near the 20 MA
  const aggressive_entry_high = round(ma_20 * 1.01);  // 1% above 20 MA
  const aggressive_entry_low = round(ma_20 * 0.98);   // 2% below 20 MA

  // Patient entry: near the 50 MA
  const patient_entry_high = round(ma_50 * 1.01);
  const patient_entry_low = round(ma_50 * 0.97);

  // Invalidation: below 200 MA or significant support
  const supportLevel = Math.max(ma_200, fifty_two_week_low * 1.05);
  const invalidation_price = round(supportLevel * 0.97);

  // ─── Risk label ─────────────────────────────────────────────────────────

  let risk_label: RiskLabel;
  if (zone === "extended" && rsi > 70) {
    risk_label = "high";
  } else if (zone === "extended" || volatility_30d > 40) {
    risk_label = "elevated";
  } else if (zone === "support_test") {
    risk_label = "elevated";
  } else if (zone === "fair" && rsi >= 40 && rsi <= 65) {
    risk_label = "low";
  } else {
    risk_label = "moderate";
  }

  // ─── Summary ────────────────────────────────────────────────────────────

  const summary = generateSummary(symbol, zone, risk_label, price, ma_20, ma_50, aggressive_entry_low, aggressive_entry_high, patient_entry_low, patient_entry_high, invalidation_price);

  return {
    current_zone: zone,
    aggressive_entry_low,
    aggressive_entry_high,
    patient_entry_low,
    patient_entry_high,
    invalidation_price,
    risk_label,
    summary,
  };
}

function generateSummary(
  symbol: string,
  zone: EntryZone,
  risk: RiskLabel,
  price: number,
  ma20: number,
  ma50: number,
  aggLow: number,
  aggHigh: number,
  patLow: number,
  patHigh: number,
  invalidation: number,
): string {
  const zoneDescriptions: Record<EntryZone, string> = {
    extended: `${symbol} is extended above recent support levels. The stock is trading ${((price / ma20 - 1) * 100).toFixed(1)}% above its 20-day moving average.`,
    fair: `${symbol} is near fair value relative to its moving averages. Current price is within normal range of the 20-day MA.`,
    pullback: `${symbol} has pulled back to an area of interest. Price is below the 20-day MA but still above the 50-day MA.`,
    support_test: `${symbol} is testing key support levels. Price is near or below the 50-day moving average at $${ma50.toFixed(2)}.`,
  };

  const riskNote: Record<RiskLabel, string> = {
    low: "Risk is relatively contained at current levels.",
    moderate: "Risk/reward is balanced here.",
    elevated: "Elevated risk at current levels — position sizing matters.",
    high: "High risk — the stock is stretched and momentum could reverse.",
  };

  const entryNote = zone === "extended"
    ? `Better entry may be near the $${aggLow}–$${aggHigh} band (near 20-day MA). A more patient entry could target $${patLow}–$${patHigh} (near 50-day MA).`
    : zone === "fair"
    ? `Current levels offer a reasonable entry window. Momentum remains intact unless price loses $${invalidation}.`
    : zone === "pullback"
    ? `This pullback area ($${aggLow}–$${aggHigh}) could offer an entry opportunity. More conservative: wait for $${patLow}–$${patHigh}.`
    : `Support test in progress. Aggressive entry near $${price.toFixed(2)} with invalidation at $${invalidation}. Patient approach: wait for a bounce confirmation.`;

  return `${zoneDescriptions[zone]} ${entryNote} ${riskNote[risk]}`;
}

/**
 * Compute entry zones from a snapshot (convenience wrapper).
 */
export function computeEntryZoneFromSnapshot(snap: SymbolSnapshot): EntryZoneResult {
  return computeEntryZone({
    symbol: snap.symbol,
    price: snap.price,
    ma_20: snap.ma_20,
    ma_50: snap.ma_50,
    ma_200: snap.ma_200,
    fifty_two_week_high: snap.fifty_two_week_high,
    fifty_two_week_low: snap.fifty_two_week_low,
    rsi: snap.rsi,
    volatility_30d: snap.volatility_30d,
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
