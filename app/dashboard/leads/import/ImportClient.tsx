"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";

interface CsvRow {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  nationality?: string;
  country_of_residence?: string;
  source?: string;
  interested_in?: string;
  preferred_destination?: string;
  notes?: string;
  // allow extra columns without using `any`
  [key: string]: unknown;
}

interface PreviewRow {
  raw: CsvRow;
  valid: boolean;
  error?: string;
}

export default function ImportClient() {
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const headers = [
      "first_name",
      "last_name",
      "email",
      "phone",
      "nationality",
      "country_of_residence",
      "source",
      "interested_in",
      "preferred_destination",
      "notes",
    ];
    const csv = headers.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lead_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File) {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: PreviewRow[] = results.data.map((r) => {
          let valid = true;
          let error = "";
          if (!r.email) {
            valid = false;
            error = "Missing email";
          } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) {
            valid = false;
            error = "Invalid email format";
          }
          return { raw: r, valid, error };
        });
        setPreviewRows(rows);
      },
      error: (err) => {
        alert("Failed to parse CSV: " + err.message);
      },
    });
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  }

  function handleBrowse() {
    inputRef.current?.click();
  }

  async function handleImport() {
    const validRows = previewRows.filter((r) => r.valid).map((r) => r.raw);
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/admin/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows }),
      });
      if (!res.ok) throw new Error("Import failed");
      const data = await res.json();
      alert(`${data.imported} leads imported successfully. ${data.skipped} rows skipped.`);
      // clear preview
      setPreviewRows([]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const validCount = previewRows.filter((r) => r.valid).length;
  const invalidCount = previewRows.length - validCount;

  return (
    <div className="space-y-6">
      <button
        onClick={downloadTemplate}
        className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <span>Download Template</span>
      </button>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center text-slate-500"
      >
        Drag & drop CSV file here, or
        <button
          type="button"
          onClick={handleBrowse}
          className="ml-2 text-blue-600 underline"
        >
          Browse Files
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
          }}
        />
      </div>

      {previewRows.length > 0 && (
        <>
          <p className="text-sm text-slate-600">
            {validCount} valid rows ready to import. {invalidCount} rows have errors and
            will be skipped.
          </p>
          <div className="overflow-x-auto max-h-[300px] border border-slate-200 rounded">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2">First Name</th>
                  <th className="px-3 py-2">Last Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Nationality</th>
                  <th className="px-3 py-2">Country of Res.</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Interested In</th>
                  <th className="px-3 py-2">Destination</th>
                  <th className="px-3 py-2">Notes / Error</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, idx) => (
                  <tr
                    key={idx}
                    className={r.valid ? "bg-green-50" : "bg-red-50"}
                  >
                    <td className="px-3 py-2">{r.raw.first_name}</td>
                    <td className="px-3 py-2">{r.raw.last_name}</td>
                    <td className="px-3 py-2">{r.raw.email}</td>
                    <td className="px-3 py-2">{r.raw.phone}</td>
                    <td className="px-3 py-2">{r.raw.nationality}</td>
                    <td className="px-3 py-2">{r.raw.country_of_residence}</td>
                    <td className="px-3 py-2">{r.raw.source}</td>
                    <td className="px-3 py-2">{r.raw.interested_in}</td>
                    <td className="px-3 py-2">{r.raw.preferred_destination}</td>
                    <td className="px-3 py-2 text-sm text-red-700">
                      {r.valid ? r.raw.notes : r.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleImport}
            disabled={importing || validCount === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {importing ? "Importing..." : `Import ${validCount} lead(s)`}
          </button>
        </>
      )}
    </div>
  );
}
