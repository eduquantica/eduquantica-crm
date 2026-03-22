"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCcw } from "lucide-react";
import * as XLSX from "xlsx";

export type Confidence = "green" | "amber" | "red";

interface Field<T> {
  value: T | null;
  confidence: Confidence;
}

interface ScrapedCourse {
  [key: string]: Field<string>;
}

interface ScrapeResult {
  university: { [key: string]: Field<string> };
  courses: ScrapedCourse[];
}

interface PreviewRow {
  [key: string]: string;
}

interface Props {
  universityId?: string;
  onScrape?: (result: ScrapeResult) => void;
}

export default function UniversityScrapeManager({ universityId, onScrape }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<"scrape" | "import" | null>(null);
  const [url, setUrl] = useState("");
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [importPreview, setImportPreview] = useState<{
    university: PreviewRow;
    courses: PreviewRow[];
  } | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function startScraping() {
    if (!url) return;
    try {
      const endpoint = universityId
        ? `/api/admin/universities/${universityId}/scrape`
        : `/api/admin/universities/scrape`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scrape failed");
      const result = data.data as ScrapeResult;
      setScrapeResult(result);
      if (onScrape) onScrape(result);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error scraping", false);
    }
  }

  function exportToExcel(result: ScrapeResult | { university: PreviewRow; courses: PreviewRow[] }) {
    const wb = XLSX.utils.book_new();

    // university details
    const uniHeaders = Object.keys(result.university);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniRow = uniHeaders.map((h) => ("value" in (result.university as any)[h] ? (result.university as any)[h].value : (result.university as any)[h]));
    const uniSheet = XLSX.utils.aoa_to_sheet([uniHeaders, uniRow]);
    wb.SheetNames.push("University");
    wb.Sheets["University"] = uniSheet;

    // courses sheet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courseRows: any[] = [];
    if (Array.isArray(result.courses)) {
      const headers = Object.keys(result.courses[0] || {});
      courseRows.push(headers);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.courses.forEach((c: any) => {
        const row = headers.map((h) => {
          const val = c[h];
          if (val && typeof val === "object" && "value" in val) return val.value;
          return val;
        });
        courseRows.push(row);
      });
      const courseSheet = XLSX.utils.aoa_to_sheet(courseRows);
      wb.SheetNames.push("Courses");
      wb.Sheets["Courses"] = courseSheet;
    }

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], { type: "application/octet-stream" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = universityId ? "university_data.xlsx" : "scraped_university.xlsx";
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      if (!data) return;
      const workbook = XLSX.read(data, { type: "array" });
      const uniSheet = workbook.Sheets[workbook.SheetNames[0]];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniRows = XLSX.utils.sheet_to_json<any[]>(uniSheet, { header: 1 });
      const uniObj: PreviewRow = {};
      if (uniRows.length >= 2) {
        const headers: string[] = uniRows[0] as string[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const values: any[] = uniRows[1];
        headers.forEach((h, i) => {
          uniObj[h] = values[i] ?? "";
        });
      }
      let courseObjs: PreviewRow[] = [];
      if (workbook.SheetNames.length > 1) {
        const courseSheet = workbook.Sheets[workbook.SheetNames[1]];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const courseRows = XLSX.utils.sheet_to_json<any[]>(courseSheet, { header: 1 });
        if (courseRows.length >= 2) {
          const headers: string[] = courseRows[0] as string[];
          courseObjs = courseRows.slice(1).map((row) => {
            const obj: PreviewRow = {};
            headers.forEach((h, i) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              obj[h] = (row as any)[i] ?? "";
            });
            return obj;
          });
        }
      }
      setImportPreview({ university: uniObj, courses: courseObjs });
    };
    reader.readAsArrayBuffer(file);
  }

  const router = useRouter();

  async function submitImport() {
    if (!importPreview) return;
    try {
      const payload = {
        universityId,
        university: importPreview.university,
        courses: importPreview.courses,
      };
      const res = await fetch("/api/admin/universities/import-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      showToast("Import successful");
      setImportPreview(null);
      setShowModal(false);
      // if we just created a new university, navigate to it
      if (!universityId && data?.data?.universityId) {
        router.push(`/dashboard/universities/${data.data.universityId}`);
      } else if (universityId) {
        router.refresh();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Error importing", false);
    }
  }

  function renderPreview(result: ScrapeResult | { university: PreviewRow; courses: PreviewRow[] }) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uni = result.university as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courses: any[] = result.courses as any;

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">University Details</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.keys(uni).map((k) => {
            const field = uni[k];
            const val = field && typeof field === "object" && "value" in field ? field.value : field;
            const conf: Confidence = field && typeof field === "object" && "confidence" in field ? field.confidence : "green";
            const bg = conf === "green" ? "bg-white" : conf === "amber" ? "bg-yellow-100" : "bg-red-100";
            return (
              <div key={k}>
                <label className="block text-xs font-semibold text-slate-700 mb-1">{k}</label>
                <input
                  type="text"
                  value={val ?? ""}
                  onChange={(e) => {
                    if (importPreview) {
                      setImportPreview((p) => {
                        if (!p) return p;
                        return { ...p, university: { ...p.university, [k]: e.target.value } };
                      });
                    } else if (scrapeResult) {
                      setScrapeResult((p) => {
                        if (!p) return p;
                        const newField = { value: e.target.value, confidence: "amber" as Confidence };
                        return { ...p, university: { ...p.university, [k]: newField } };
                      });
                    }
                  }}
                  className={`w-full px-2 py-1 border border-slate-300 rounded ${bg}`}
                />
              </div>
            );
          })}
        </div>
        {courses.length > 0 && (
          <>
            <h3 className="text-lg font-medium">Courses</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">                
                <thead>
                  <tr>
                    {Object.keys(courses[0]).map((h) => (
                      <th key={h} className="px-2 py-1 text-left font-medium text-slate-700">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {courses.map((row, i) => (
                    <tr key={i} className="border-b">
                      {Object.keys(row).map((h) => {
                        const val = row[h];
                        return (
                          <td key={h} className="px-2 py-1">
                            <input
                              type="text"
                              value={val ?? ""}
                              onChange={(e) => {
                                if (importPreview) {
                                  setImportPreview((p) => {
                                    if (!p) return p;
                                    const newCourses = [...p.courses];
                                    newCourses[i] = { ...newCourses[i], [h]: e.target.value };
                                    return { ...p, courses: newCourses };
                                  });
                                } else if (scrapeResult) {
                                  setScrapeResult((p) => {
                                    if (!p) return p;
                                    const newCourses = [...p.courses];
                                    newCourses[i] = {
                                      ...newCourses[i],
                                      [h]: {
                                        value: e.target.value,
                                        confidence: "amber",
                                      },
                                    };
                                    return { ...p, courses: newCourses };
                                  });
                                }
                              }}
                              className="w-full px-1 py-0.5 border border-slate-300 rounded"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              exportToExcel(result as any);
            }}
            className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Download size={16} />
            Download as Excel
          </button>
          {mode === "import" && (
            <button
              onClick={submitImport}
              className="inline-flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Confirm & Publish
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {toast && (
        <div
          className={`rounded-lg p-3 text-sm ${toast.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => {
            setMode("scrape");
            setShowModal(true);
            setScrapeResult(null);
            setUrl("");
          }}
          className="inline-flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          <RefreshCcw className="w-4 h-4" />
          {universityId ? "Re-sync from Website" : "Scrape from Website"}
        </button>
        <button
          onClick={() => {
            setMode("import");
            setShowModal(true);
            setImportPreview(null);
            fileInputRef.current?.click();
          }}
          className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
        >
          Import Updated Excel
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowModal(false);
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {mode === "scrape" ? "Scrape University Website" : "Import Excel"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            {mode === "scrape" && (
              <>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="https://university.edu"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded"
                  />
                  <button
                    onClick={startScraping}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Start Scraping
                  </button>
                </div>
                {scrapeResult && renderPreview(scrapeResult)}
              </>
            )}
            {mode === "import" && (
              <>
                {importPreview ? (
                  <>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {renderPreview(importPreview as any)}
                  </>
                ) : (
                  <div className="text-sm text-slate-600">Select an Excel file to preview its contents.</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}