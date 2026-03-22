type Props = {
  status: "PENDING" | "SCANNING" | "REVISION_REQUIRED" | "VERIFIED" | "REJECTED";
};

export default function ChecklistStatusIcon({ status }: Props) {
  if (status === "SCANNING") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700" aria-label="Scanning">
        <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" className="opacity-25" />
          <path d="M22 12a10 10 0 0 1-10 10" className="opacity-90" />
        </svg>
      </span>
    );
  }

  if (status === "REVISION_REQUIRED") {
    return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">!</span>;
  }

  if (status === "VERIFIED") {
    return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>;
  }

  if (status === "REJECTED") {
    return <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-700 text-xs font-bold">✕</span>;
  }

  return <span className="inline-flex h-6 w-6 rounded-full border-2 border-slate-300 bg-slate-100" aria-label="Pending" />;
}
