"use client";

import { useEffect, useState } from "react";

interface CurrencyDisplayProps {
  amount: number | null;
  baseCurrency: string;
  studentNationality?: string;
}

// map nationality to default currency
const NATIONALITY_CURRENCY: Record<string, string> = {
  Bangladesh: "BDT",
  India: "INR",
  Nigeria: "NGN",
  Pakistan: "PKR",
  Nepal: "NPR",
  Ghana: "GHS",
  Philippines: "PHP",
  Vietnam: "VND",
  "Sri Lanka": "LKR",
  Kenya: "KES",
  Egypt: "EGP",
  "South Africa": "ZAR",
  China: "CNY",
  Brazil: "BRL",
};

// symbol for some currencies
const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£",
  USD: "$",
  CAD: "CA$",
  AUD: "A$",
  BDT: "৳",
  INR: "₹",
  NGN: "₦",
  PKR: "₨",
  NPR: "₨",
  LKR: "Rs",
  GHS: "₵",
  KES: "KSh",
  PHP: "₱",
  VND: "₫",
  EGP: "E£",
  ZAR: "R",
  CNY: "¥",
  BRL: "R$",
};

interface StudentProfile {
  nationality: string | null;
  preferredCurrency: string | null;
}

export default function CurrencyDisplay({ amount, baseCurrency, studentNationality }: CurrencyDisplayProps) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [preferred, setPreferred] = useState<string | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [rateUpdatedAt, setRateUpdatedAt] = useState<string | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);

  useEffect(() => {
    if (studentNationality || profile) return;
    fetch("/api/student/currency-preference")
      .then((r) => r.json())
      .then((data) => {
        if (data?.data) {
          setProfile(data.data as StudentProfile);
          setPreferred(data.data.preferredCurrency || null);
        }
      })
      .catch(() => {});
  }, [studentNationality, profile]);

  useEffect(() => {
    if (profile && profile.preferredCurrency) {
      setPreferred(profile.preferredCurrency);
    }
  }, [profile]);

  const targetCurrency = preferred
    || studentNationality && NATIONALITY_CURRENCY[studentNationality] 
    || null;

  useEffect(() => {
    let cancelled = false;
    const targetCurrency = preferred || (studentNationality && NATIONALITY_CURRENCY[studentNationality]) || null;

    if (!targetCurrency || amount == null || targetCurrency === baseCurrency) {
      setRate(null);
      setRateUpdatedAt(null);
      setLoadingRate(false);
      return;
    }

    setLoadingRate(true);

    (async () => {
      try {
        const res = await fetch(`/api/currency/rate?from=${encodeURIComponent(baseCurrency)}&to=${encodeURIComponent(targetCurrency)}`);
        const json = await res.json();
        if (!cancelled) {
          setRate(typeof json?.data?.rate === "number" ? json.data.rate : null);
          setRateUpdatedAt(typeof json?.data?.updatedAt === "string" ? json.data.updatedAt : null);
          setLoadingRate(false);
        }
      } catch {
        if (!cancelled) {
          setRate(null);
          setRateUpdatedAt(null);
          setLoadingRate(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [amount, baseCurrency, preferred, studentNationality]);

  function handleChangePreferred(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value || null;
    setPreferred(val);
    // persist
    fetch("/api/student/currency-preference", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredCurrency: val }),
    }).catch(() => {});
  }

  if (amount == null) return null;

  const converted = targetCurrency && rate != null ? amount * rate : null;

  return (
    <div className="space-y-1">
      <div className="text-lg font-bold">
        {CURRENCY_SYMBOL[baseCurrency] || baseCurrency} {amount.toLocaleString()} / year
      </div>
      {converted != null && targetCurrency && targetCurrency !== baseCurrency && (
        <div className="text-sm text-gray-500">
          ≈ {CURRENCY_SYMBOL[targetCurrency] || targetCurrency} {converted.toLocaleString()}
        </div>
      )}
      {loadingRate && targetCurrency && targetCurrency !== baseCurrency && (
        <div className="text-xs text-gray-400">Updating rate…</div>
      )}
      {converted != null && targetCurrency && targetCurrency !== baseCurrency && rateUpdatedAt && (
        <div className="text-[12px] text-gray-400">
          Rate updated: {new Date(rateUpdatedAt).toLocaleDateString("en-GB")}
        </div>
      )}
      {/* dropdown to override currency if student profile available */}
      {(profile || studentNationality) && (
        <div className="mt-1">
          <label className="text-xs text-gray-500 mr-2">Convert to:</label>
          <select
            value={preferred || ""}
            onChange={handleChangePreferred}
            className="text-xs border border-gray-300 rounded px-1 py-0.5"
          >
            <option value="">Auto</option>
            {Object.values(NATIONALITY_CURRENCY).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
