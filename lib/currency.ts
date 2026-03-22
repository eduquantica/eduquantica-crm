import { db } from "@/lib/db";

const PRIMARY_BASE_URL = "https://open.er-api.com/v6/latest";
const FALLBACK_BASE_URL = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies";

const BASE_CURRENCIES = ["GBP", "CAD", "AUD", "USD", "EUR", "NZD", "SEK", "NOK"] as const;
const TARGET_CURRENCIES = ["BDT", "NGN", "INR", "PKR", "NPR", "LKR", "GHS", "KES", "PHP", "VND"] as const;

type RatesMap = Record<string, number>;
type FetchSource = "primary" | "fallback";

const DISPLAY_CURRENCY_BY_NATIONALITY: Record<string, string> = {
  BD: "BDT",
  NG: "NGN",
  IN: "INR",
  PK: "PKR",
  NP: "NPR",
  GH: "GHS",
  PH: "PHP",
  VN: "VND",
  LK: "LKR",
  KE: "KES",
  EG: "EGP",
  ZA: "ZAR",
  CN: "CNY",
  BR: "BRL",
};

function normalizeRates(input: unknown): RatesMap {
  if (!input || typeof input !== "object") return {};
  const output: RatesMap = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      output[key.toUpperCase()] = value;
    }
  }
  return output;
}

function toCountryCode(nationality: string): string | null {
  const normalized = nationality.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized.length === 2) return normalized;

  const byName: Record<string, string> = {
    BANGLADESH: "BD",
    NIGERIA: "NG",
    INDIA: "IN",
    PAKISTAN: "PK",
    NEPAL: "NP",
    GHANA: "GH",
    PHILIPPINES: "PH",
    VIETNAM: "VN",
    SRI_LANKA: "LK",
    "SRI LANKA": "LK",
    KENYA: "KE",
    EGYPT: "EG",
    SOUTH_AFRICA: "ZA",
    "SOUTH AFRICA": "ZA",
    CHINA: "CN",
    BRAZIL: "BR",
  };

  return byName[normalized] || null;
}

export class CurrencyService {
  static async fetchRates(baseCurrency: string): Promise<{ rates: RatesMap; source: FetchSource }> {
    const base = baseCurrency.toLowerCase();

    try {
      const primaryRes = await fetch(`${PRIMARY_BASE_URL}/${baseCurrency.toUpperCase()}`, {
        cache: "no-store",
      });

      if (primaryRes.ok) {
        const payload = (await primaryRes.json()) as { rates?: unknown };
        const rates = normalizeRates(payload.rates);
        if (Object.keys(rates).length > 0) {
          return { rates, source: "primary" };
        }
      }
    } catch {
      // fallback below
    }

    const fallbackRes = await fetch(`${FALLBACK_BASE_URL}/${base}.json`, {
      cache: "no-store",
    });
    if (!fallbackRes.ok) {
      throw new Error(`Currency API fallback failed (${fallbackRes.status})`);
    }

    const fallbackPayload = (await fallbackRes.json()) as Record<string, unknown>;
    const nested = fallbackPayload[base];
    const rates = normalizeRates(nested);
    if (Object.keys(rates).length === 0) {
      throw new Error("Currency API fallback returned no rates");
    }

    return { rates, source: "fallback" };
  }

  static async refreshAllRates(): Promise<{ refreshedPairs: number; sourceSummary: Record<string, FetchSource> }> {
    let refreshedPairs = 0;
    const sourceSummary: Record<string, FetchSource> = {};

    for (const baseCurrency of BASE_CURRENCIES) {
      const { rates, source } = await CurrencyService.fetchRates(baseCurrency);
      sourceSummary[baseCurrency] = source;

      for (const targetCurrency of TARGET_CURRENCIES) {
        const rate = rates[targetCurrency];
        if (!rate) continue;

        await db.currencyRate.upsert({
          where: {
            baseCurrency_targetCurrency: {
              baseCurrency,
              targetCurrency,
            },
          },
          update: {
            rate,
            source,
            fetchedAt: new Date(),
          },
          create: {
            baseCurrency,
            targetCurrency,
            rate,
            source,
            fetchedAt: new Date(),
          },
        });

        refreshedPairs += 1;
      }
    }

    return { refreshedPairs, sourceSummary };
  }

  static async getRate(baseCurrency: string, targetCurrency: string): Promise<number | null> {
    const base = baseCurrency.toUpperCase();
    const target = targetCurrency.toUpperCase();

    let record = await db.currencyRate.findUnique({
      where: {
        baseCurrency_targetCurrency: {
          baseCurrency: base,
          targetCurrency: target,
        },
      },
    });

    const staleMs = 25 * 60 * 60 * 1000;
    const isStale = !record || Date.now() - new Date(record.fetchedAt).getTime() > staleMs;

    if (isStale) {
      await CurrencyService.refreshAllRates();
      record = await db.currencyRate.findUnique({
        where: {
          baseCurrency_targetCurrency: {
            baseCurrency: base,
            targetCurrency: target,
          },
        },
      });
    }

    return record?.rate ?? null;
  }

  static getDisplayCurrency(nationality: string): string | null {
    const countryCode = toCountryCode(nationality);
    if (!countryCode) return null;
    return DISPLAY_CURRENCY_BY_NATIONALITY[countryCode] || null;
  }
}
