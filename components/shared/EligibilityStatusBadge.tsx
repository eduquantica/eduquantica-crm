type EligibilityStatus = {
  eligible: boolean;
  partiallyEligible: boolean;
  overridden: boolean;
  overriddenBy?: string;
  overriddenAt?: string | Date;
  matchedRequirements: string[];
  missingRequirements: string[];
  message: string;
};

function formatOverrideDate(value?: string | Date): string {
  if (!value) return "";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB");
}

export default function EligibilityStatusBadge({
  status,
  isStaff,
  className,
}: {
  status: EligibilityStatus;
  isStaff: boolean;
  className?: string;
}) {
  const badge = (() => {
    if (status.message === "No specific requirements set") {
      return { label: "No requirements set", classes: "bg-slate-100 text-slate-700" };
    }
    if (status.message === "Add qualifications to check eligibility") {
      return { label: "Add qualifications to check eligibility", classes: "bg-slate-100 text-slate-700" };
    }
    if (status.eligible) {
      return { label: "Eligible", classes: "bg-emerald-100 text-emerald-700" };
    }
    if (status.partiallyEligible) {
      return { label: "Partially Eligible", classes: "bg-amber-100 text-amber-700" };
    }
    return { label: "Not Eligible", classes: "bg-rose-100 text-rose-700" };
  })();

  return (
    <div className={className || ""}>
      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badge.classes}`}>
        {badge.label}
      </span>

      {status.eligible && status.overridden && isStaff && (
        <p className="mt-2 text-xs text-emerald-800">
          Manually approved by {status.overriddenBy || "Staff"}
          {status.overriddenAt ? ` on ${formatOverrideDate(status.overriddenAt)}` : ""}
        </p>
      )}

      {status.partiallyEligible && status.missingRequirements.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
          {status.missingRequirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      {!status.eligible && !status.partiallyEligible && status.message !== "No specific requirements set" && status.message !== "Add qualifications to check eligibility" && status.missingRequirements.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-xs text-rose-800">
          {status.missingRequirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
