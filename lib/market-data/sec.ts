/**
 * SEC EDGAR Form 4 client.
 * Fetches insider transactions (purchases) for tracked symbols.
 * All data is free and public per SEC EDGAR policy.
 *
 * Docs: https://www.sec.gov/developer
 */

const SEC_BASE = "https://data.sec.gov";
const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
// SEC requires a descriptive User-Agent with contact info
const USER_AGENT = "STKVAULT Research Bot contact@stkvault.app";

export interface InsiderTransaction {
  symbol: string;
  insider_name: string;
  insider_title: string;
  transaction_type: "P" | "S";
  shares: number;
  price_per_share: number;
  total_value: number;
  transaction_date: string;
  filing_date: string;
  sec_link: string;
}

// ─── CIK Lookup ──────────────────────────────────────────────────────────────

let _cikMap: Record<string, string> | null = null;

async function getCIKMap(): Promise<Record<string, string>> {
  if (_cikMap) return _cikMap;
  const res = await fetch(SEC_TICKERS_URL, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 86400 }, // refresh daily
  });
  if (!res.ok) throw new Error(`SEC tickers fetch failed: ${res.status}`);
  const raw = await res.json();
  const map: Record<string, string> = {};
  for (const entry of Object.values(raw) as any[]) {
    map[String(entry.ticker).toUpperCase()] = String(entry.cik_str).padStart(10, "0");
  }
  _cikMap = map;
  return map;
}

// ─── Main Fetch ──────────────────────────────────────────────────────────────

/**
 * Returns Form 4 purchase transactions for a symbol in the last `dayLimit` days.
 * Only includes officers and directors (not 10% holders).
 */
export async function getInsiderTransactions(
  symbol: string,
  dayLimit = 60
): Promise<InsiderTransaction[]> {
  try {
    const cikMap = await getCIKMap();
    const cik = cikMap[symbol.toUpperCase()];
    if (!cik) return [];

    const submissionsRes = await fetch(`${SEC_BASE}/submissions/CIK${cik}.json`, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 3600 },
    });
    if (!submissionsRes.ok) return [];

    const submissions = await submissionsRes.json();
    const { accessionNumber, filingDate, form, primaryDocument } =
      submissions.filings?.recent ?? {};

    if (!accessionNumber?.length) return [];

    const cutoff = new Date(Date.now() - dayLimit * 86_400_000)
      .toISOString()
      .split("T")[0];

    const transactions: InsiderTransaction[] = [];
    const numericCik = parseInt(cik, 10);

    for (let i = 0; i < form.length; i++) {
      if (form[i] !== "4") continue;
      if (filingDate[i] < cutoff) break; // filings are newest-first, safe to break

      const accNo = String(accessionNumber[i]).replace(/-/g, "");
      // primaryDocument may include an XSLT viewer prefix (e.g. "xslF345X05/")
      // Strip it to get the raw XML data file
      const rawDoc = (primaryDocument[i] ?? "").replace(/^xslF345X05\//, "");
      if (!rawDoc.endsWith(".xml") && !rawDoc.endsWith(".XML")) continue;

      const fileUrl = `https://www.sec.gov/Archives/edgar/data/${numericCik}/${accNo}/${rawDoc}`;

      try {
        const xmlRes = await fetch(fileUrl, {
          headers: { "User-Agent": USER_AGENT },
        });
        if (!xmlRes.ok) continue;
        const xml = await xmlRes.text();
        const parsed = parseForm4(xml, symbol, filingDate[i], fileUrl);
        transactions.push(...parsed);
      } catch {
        // Skip unparseable filings
      }
    }

    return transactions;
  } catch (err) {
    console.error(`SEC EDGAR error for ${symbol}:`, err);
    return [];
  }
}

// ─── XML Parsing ─────────────────────────────────────────────────────────────

function xmlTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>\\s*([^<]+)\\s*</${tag}>`));
  return m ? m[1].trim() : null;
}

/** Extract <value> inside an outer block tag */
function blockValue(xml: string, outerTag: string): string | null {
  const m = xml.match(
    new RegExp(`<${outerTag}>[\\s\\S]*?<value>([^<]+)<\\/value>[\\s\\S]*?<\\/${outerTag}>`)
  );
  return m ? m[1].trim() : null;
}

function parseForm4(
  xml: string,
  symbol: string,
  filingDate: string,
  secLink: string
): InsiderTransaction[] {
  const results: InsiderTransaction[] = [];

  // Only track officers and directors
  const isOfficer = xmlTag(xml, "isOfficer") === "1";
  const isDirector = xmlTag(xml, "isDirector") === "1";
  if (!isOfficer && !isDirector) return [];

  const ownerName = xmlTag(xml, "rptOwnerName") ?? "Unknown";
  const officerTitle = xmlTag(xml, "officerTitle") ?? "";
  const title = officerTitle || (isOfficer ? "Officer" : "Director");
  const transactionDate = xmlTag(xml, "periodOfReport") ?? filingDate;

  // Find all non-derivative transaction blocks
  const txBlocks = [
    ...xml.matchAll(/<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/g),
  ];

  for (const [, txXml] of txBlocks) {
    const code = blockValue(txXml, "transactionAcquiredDisposedCode");
    if (code !== "A") continue; // purchases only

    const sharesStr = blockValue(txXml, "transactionShares");
    const priceStr = blockValue(txXml, "transactionPricePerShare");
    if (!sharesStr || !priceStr) continue;

    const shares = parseFloat(sharesStr);
    const price = parseFloat(priceStr);
    if (isNaN(shares) || isNaN(price) || shares <= 0 || price <= 0) continue;

    results.push({
      symbol,
      insider_name: ownerName,
      insider_title: title,
      transaction_type: "P",
      shares,
      price_per_share: price,
      total_value: Math.round(shares * price),
      transaction_date: transactionDate,
      filing_date: filingDate,
      sec_link: secLink,
    });
  }

  return results;
}
