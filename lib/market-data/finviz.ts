/**
 * Finviz quote scraper.
 * Extracts short interest data from public Finviz quote pages.
 * Free data, no API key required.
 */

export interface ShortInterestData {
  short_float_pct: number; // % of float that is short
  short_ratio: number;     // days to cover
}

/**
 * Scrapes short float % and short ratio from Finviz for a given ticker.
 * Returns null if the data is unavailable or the fetch fails.
 */
export async function getShortInterest(symbol: string): Promise<ShortInterestData | null> {
  try {
    const res = await fetch(
      `https://finviz.com/quote.ashx?t=${encodeURIComponent(symbol.toUpperCase())}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: "https://finviz.com/",
        },
        next: { revalidate: 0 },
      }
    );

    if (!res.ok) return null;
    const html = await res.text();

    // Current Finviz layout: label is in <a> tags, value is <a href=...><b>VALUE</b></a>
    // e.g. Short Float</a></td><td ...><a href="..."><b>0.98%</b></a></td>
    const floatMatch = html.match(
      /Short Float<\/a><\/td>[\s\S]*?<b>([\d.]+)%?<\/b>/i
    );
    const ratioMatch = html.match(
      /Short Ratio<\/a><\/td>[\s\S]*?<b>([\d.]+)<\/b>/i
    );

    // Older Finviz layout fallback — labels in <b> tags
    const floatMatchFallback = !floatMatch ? html.match(
      /Short Float<\/b><\/td>[^<]*<td[^>]*><b>([\d.]+)%?<\/b>/i
    ) : null;
    const ratioMatchFallback = !ratioMatch ? html.match(
      /Short Ratio<\/b><\/td>[^<]*<td[^>]*><b>([\d.]+)<\/b>/i
    ) : null;

    const floatFinal = floatMatch ?? floatMatchFallback;
    const ratioFinal = ratioMatch ?? ratioMatchFallback;

    const shortFloat = floatFinal ? parseFloat(floatFinal[1]) : 0;
    const shortRatio = ratioFinal ? parseFloat(ratioFinal[1]) : 0;

    if (shortFloat > 0 || shortRatio > 0) {
      return { short_float_pct: shortFloat, short_ratio: shortRatio };
    }

    return null;
  } catch (err) {
    console.error(`Finviz short interest error for ${symbol}:`, err);
    return null;
  }
}
