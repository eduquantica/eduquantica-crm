"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Download, UploadCloud } from "lucide-react";

interface PreviewRow {
  data: Record<string, unknown>;
  error?: string;
}

function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function show(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }
  return { toast, show };
}

const TEMPLATE_HEADERS = [
  "course_name",
  "level",
  "field_of_study",
  "duration",
  "study_mode",
  "tuition_fee",
  "application_fee",
  "intake_dates",
  "application_deadline",
  "tags",
  "description",
  "status",
];

export default function ImportCoursesClient({ universityId }: { universityId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast, show } = useToast();

  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  function downloadTemplate() {
    const csv = TEMPLATE_HEADERS.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "course_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: Papa.ParseResult<Record<string, unknown>>) =>
          processParsed(results.data as Record<string, unknown>[]),
      });
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        if (!data) return;
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(sheet);
        const parsed: Papa.ParseResult<Record<string, unknown>> = Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
        });
        processParsed(parsed.data as Record<string, unknown>[]);
      };
      reader.readAsArrayBuffer(file);
    } else {
      show("Unsupported file type", false);
    }
  }

  function processParsed(rows: Record<string, unknown>[]) {
    const previewRows: PreviewRow[] = [];
    let valid = 0;
    let invalid = 0;
    rows.forEach((r) => {
      let err: string | undefined;
      const courseName = r["course_name"];
      if (!courseName || String(courseName).trim() === "") {
        err = "Missing course name";
      } else if (
        r["level"] &&
        !["FOUNDATION", "CERTIFICATE", "DIPLOMA", "BACHELORS", "MASTERS", "PHD"].includes(
          String(r["level"]).toUpperCase()
        )
      ) {
        err = "Invalid level";
      } else if (
        r["study_mode"] &&
        !["FULL_TIME", "PART_TIME", "ONLINE"].includes(String(r["study_mode"]).toUpperCase())
      ) {
        err = "Invalid study mode";
      }
      if (err) {
        invalid++;
      } else {
        valid++;
      }
      previewRows.push({ data: r, error: err });
    });
    setPreview(previewRows);
    setValidCount(valid);
    setErrorCount(invalid);
  }

  async function handleImport() {
    if (validCount === 0) {
      show("No valid rows to import", false);
      return;
    }
    try {
      const rowsToSend = preview.filter((p) => !p.error).map((p) => p.data);
      const res = await fetch(`/api/admin/universities/${universityId}/import-courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToSend }),
      });
      if (!res.ok) throw new Error("Import failed");
      const data = await res.json();
      show(`Imported ${data.data.imported} courses (${data.data.skipped} skipped)`);
      setTimeout(() => {
        router.push(`/dashboard/universities/${universityId}`);
      }, 1500);
    } catch (err) {
      show(err instanceof Error ? err.message : "An error occurred", false);
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`rounded-lg p-4 text-sm ${toast.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Download size={16} />
          Download Template
        </button>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        className="relative cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-12 text-center text-gray-500 hover:border-gray-400"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
          }}
        />
        <UploadCloud className="mx-auto mb-2 h-8 w-8" />
        <p className="text-sm">Drag & drop a CSV or Excel file here, or click to browse</p>
      </div>

      {preview.length > 0 && (
        <div className="space-y-4">
          <div className="text-sm text-gray-700">
            {validCount} courses ready to import. {errorCount} rows have errors and will be skipped.
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {TEMPLATE_HEADERS.map((h) => (
                    <th key={h} className="px-2 py-1 text-left font-medium text-gray-700">
                      {h}
                    </th>
                  ))}
                  <th className="px-2 py-1 text-left font-medium text-gray-700">Error</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p, idx) => (
                  <tr
                    key={idx}
                    className={p.error ? "bg-red-50" : "bg-green-50"}
                  >
                    {TEMPLATE_HEADERS.map((h) => (
                      <td key={h} className="px-2 py-1 align-top">
                        {String(p.data[h] ?? "")}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-sm text-red-700">
                      {String(p.error ?? "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleImport}
            disabled={validCount === 0}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Import Valid Rows
          </button>
        </div>
      )}
    </div>
  );
}
