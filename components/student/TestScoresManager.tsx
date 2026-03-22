"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DocumentPreviewModal from "@/components/shared/DocumentPreviewModal";
import QRCodeUploadModal from "@/components/shared/QRCodeUploadModal";
import { toApiFilesDownloadPath } from "@/lib/file-url";

type TestTypeRow = {
  id: string;
  name: string;
  isIELTS: boolean;
};

type TestScoreRow = {
  id: string;
  studentId: string;
  testType: string;
  dateTaken: string | null;
  isUKVI: boolean;
  overallScore: string | null;
  listeningScore: string | null;
  readingScore: string | null;
  writingScore: string | null;
  speakingScore: string | null;
  certificateUrl: string | null;
  certificateFileName: string | null;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  testType: string;
  dateTaken: string;
  isUKVI: boolean;
  overallScore: string;
  listeningScore: string;
  readingScore: string;
  writingScore: string;
  speakingScore: string;
  certificateUrl: string;
  certificateFileName: string;
};

function emptyForm(defaultType = ""): FormState {
  return {
    testType: defaultType,
    dateTaken: "",
    isUKVI: false,
    overallScore: "",
    listeningScore: "",
    readingScore: "",
    writingScore: "",
    speakingScore: "",
    certificateUrl: "",
    certificateFileName: "",
  };
}

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function TestScoresManager({
  studentId,
  canManage,
  title,
}: {
  studentId: string;
  canManage: boolean;
  title?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [testTypes, setTestTypes] = useState<TestTypeRow[]>([]);
  const [scores, setScores] = useState<TestScoreRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileUrl: string } | null>(null);

  const selectedType = useMemo(() => {
    return testTypes.find((item) => item.name === form.testType) || null;
  }, [form.testType, testTypes]);

  const isIELTS = Boolean(selectedType?.isIELTS);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [typesRes, scoresRes] = await Promise.all([
        fetch("/api/admin/test-types", { cache: "no-store" }),
        fetch(`/api/students/${studentId}/test-scores`, { cache: "no-store" }),
      ]);

      const typesJson = await typesRes.json() as { data?: TestTypeRow[]; error?: string };
      const scoresJson = await scoresRes.json() as { data?: TestScoreRow[]; error?: string };

      if (!typesRes.ok) throw new Error(typesJson.error || "Failed to load test types");
      if (!scoresRes.ok) throw new Error(scoresJson.error || "Failed to load test scores");

      const availableTypes = typesJson.data || [];
      const list = scoresJson.data || [];

      setTestTypes(availableTypes);
      setScores(list);

      if (!form.testType && availableTypes.length > 0) {
        setForm((prev) => ({ ...prev, testType: availableTypes[0].name }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load test scores");
    } finally {
      setLoading(false);
    }
  }, [form.testType, studentId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function openCreateModal() {
    setEditingId(null);
    setError(null);
    setMessage(null);
    setForm(emptyForm(testTypes[0]?.name || ""));
    setShowModal(true);
  }

  function openEditModal(row: TestScoreRow) {
    setEditingId(row.id);
    setError(null);
    setMessage(null);
    setForm({
      testType: row.testType,
      dateTaken: toDateInput(row.dateTaken),
      isUKVI: Boolean(row.isUKVI),
      overallScore: row.overallScore || "",
      listeningScore: row.listeningScore || "",
      readingScore: row.readingScore || "",
      writingScore: row.writingScore || "",
      speakingScore: row.speakingScore || "",
      certificateUrl: row.certificateUrl || "",
      certificateFileName: row.certificateFileName || "",
    });
    setShowModal(true);
  }

  async function uploadCertificate(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      const uploadJson = await uploadRes.json() as { urls?: string[]; error?: string; message?: string };
      if (!uploadRes.ok || !uploadJson.urls?.[0]) {
        throw new Error(uploadJson.error || "File upload failed");
      }

      setForm((prev) => ({
        ...prev,
        certificateUrl: uploadJson.urls?.[0] || "",
        certificateFileName: file.name,
      }));
      setMessage(uploadJson.message ? `Certificate uploaded. ${uploadJson.message}` : "Certificate uploaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload certificate");
    } finally {
      setUploading(false);
    }
  }

  async function saveScore() {
    if (!form.testType) {
      setError("Please select a test type");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const payload = {
        testType: form.testType,
        dateTaken: form.dateTaken || null,
        isUKVI: isIELTS ? form.isUKVI : false,
        overallScore: form.overallScore || null,
        listeningScore: isIELTS ? form.listeningScore || null : null,
        readingScore: isIELTS ? form.readingScore || null : null,
        writingScore: isIELTS ? form.writingScore || null : null,
        speakingScore: isIELTS ? form.speakingScore || null : null,
        certificateUrl: form.certificateUrl || null,
        certificateFileName: form.certificateFileName || null,
      };

      const url = editingId
        ? `/api/students/${studentId}/test-scores/${editingId}`
        : `/api/students/${studentId}/test-scores`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { data?: TestScoreRow; error?: string };
      if (!res.ok || !json.data) {
        throw new Error(json.error || "Failed to save test score");
      }

      const saved = json.data;
      setScores((prev) => {
        if (editingId) {
          return prev.map((row) => (row.id === editingId ? saved : row));
        }
        return [saved, ...prev];
      });

      setShowModal(false);
      setEditingId(null);
      setForm(emptyForm(testTypes[0]?.name || ""));
      setMessage(editingId ? "Test score updated." : "Test score added.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save test score");
    } finally {
      setSaving(false);
    }
  }

  async function deleteScore(scoreId: string) {
    const ok = window.confirm("Delete this test score?");
    if (!ok) return;

    setError(null);
    setMessage(null);
    const res = await fetch(`/api/students/${studentId}/test-scores/${scoreId}`, { method: "DELETE" });
    const json = await res.json() as { error?: string };
    if (!res.ok) {
      setError(json.error || "Failed to delete test score");
      return;
    }

    setScores((prev) => prev.filter((row) => row.id !== scoreId));
    setMessage("Test score deleted.");
  }

  async function deleteDocument(scoreId: string) {
    const row = scores.find((item) => item.id === scoreId);
    if (!row) return;

    const ok = window.confirm("Delete this uploaded certificate?");
    if (!ok) return;

    setError(null);
    setMessage(null);

    const res = await fetch(`/api/students/${studentId}/test-scores/${scoreId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testType: row.testType,
        dateTaken: toDateInput(row.dateTaken) || null,
        isUKVI: row.isUKVI,
        overallScore: row.overallScore,
        listeningScore: row.listeningScore,
        readingScore: row.readingScore,
        writingScore: row.writingScore,
        speakingScore: row.speakingScore,
        certificateUrl: null,
        certificateFileName: null,
        isVerified: row.isVerified,
      }),
    });

    const json = await res.json() as { data?: TestScoreRow; error?: string };
    if (!res.ok || !json.data) {
      setError(json.error || "Failed to delete certificate");
      return;
    }

    setScores((prev) => prev.map((item) => (item.id === scoreId ? json.data as TestScoreRow : item)));
    setMessage("Certificate removed.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{title || "Test Scores"}</h3>
        {canManage && (
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-[#1E3A5F] px-3 py-2 text-sm font-semibold text-white"
          >
            + Add Test Score
          </button>
        )}
      </div>

      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading test scores...</div>
      ) : scores.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">No test scores found.</div>
      ) : (
        <div className="space-y-3">
          {scores.map((row) => {
            const rowType = testTypes.find((item) => item.name === row.testType);
            const rowIsIELTS = Boolean(rowType?.isIELTS) || row.testType.toLowerCase().includes("ielts");

            return (
              <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{row.testType}</p>
                    <p className="text-xs text-slate-600">Date Taken: {row.dateTaken ? new Date(row.dateTaken).toLocaleDateString("en-GB") : "-"}</p>
                    <p className="text-xs text-slate-600">Overall: {row.overallScore || "-"}</p>
                    {rowIsIELTS && <p className="text-xs text-slate-600">UKVI IELTS: {row.isUKVI ? "Yes" : "No"}</p>}
                    {rowIsIELTS && (
                      <p className="mt-1 text-xs text-slate-500">
                        L {row.listeningScore || "-"} • R {row.readingScore || "-"} • W {row.writingScore || "-"} • S {row.speakingScore || "-"}
                      </p>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(row)}
                        className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void deleteScore(row.id);
                        }}
                        className="rounded border border-rose-300 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {row.certificateUrl && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-800">{row.certificateFileName || "Uploaded certificate"}</p>
                    <p className="text-xs text-slate-500">Uploaded: {new Date(row.updatedAt || row.createdAt).toLocaleString("en-GB")}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc({ fileName: row.certificateFileName || "Test Certificate", fileUrl: row.certificateUrl || "" })}
                        className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Preview
                      </button>
                      <a
                        href={toApiFilesDownloadPath(row.certificateUrl)}
                        className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Download
                      </a>
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            void deleteDocument(row.id);
                          }}
                          className="rounded border border-rose-300 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <h4 className="text-lg font-semibold text-slate-900">{editingId ? "Edit Test Score" : "Add Test Score"}</h4>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Test Type</label>
                <select
                  value={form.testType}
                  onChange={(event) => {
                    const nextType = event.target.value;
                    const next = testTypes.find((item) => item.name === nextType);
                    setForm((prev) => ({
                      ...prev,
                      testType: nextType,
                      isUKVI: next?.isIELTS ? prev.isUKVI : false,
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select type</option>
                  {testTypes.map((item) => (
                    <option key={item.id} value={item.name}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Date Taken</label>
                <input
                  type="date"
                  value={form.dateTaken}
                  onChange={(event) => setForm((prev) => ({ ...prev, dateTaken: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {isIELTS && (
                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={form.isUKVI}
                    onChange={(event) => setForm((prev) => ({ ...prev, isUKVI: event.target.checked }))}
                  />
                  UKVI IELTS? Yes / No
                </label>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Overall Band / Score</label>
                <input
                  value={form.overallScore}
                  onChange={(event) => setForm((prev) => ({ ...prev, overallScore: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {isIELTS && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Listening</label>
                    <input
                      value={form.listeningScore}
                      onChange={(event) => setForm((prev) => ({ ...prev, listeningScore: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Reading</label>
                    <input
                      value={form.readingScore}
                      onChange={(event) => setForm((prev) => ({ ...prev, readingScore: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Writing</label>
                    <input
                      value={form.writingScore}
                      onChange={(event) => setForm((prev) => ({ ...prev, writingScore: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Speaking</label>
                    <input
                      value={form.speakingScore}
                      onChange={(event) => setForm((prev) => ({ ...prev, speakingScore: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Upload Test Certificate</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadCertificate(file);
                    }
                    event.currentTarget.value = "";
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  className="mt-2 flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 cursor-pointer w-full justify-center"
                >
                  📱 Take Photo with Phone via QR Code
                </button>
                {uploading && <p className="mt-1 text-xs text-slate-500">Uploading...</p>}
                {form.certificateFileName && (
                  <p className="mt-1 text-xs text-slate-600">Attached: {form.certificateFileName}</p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  void saveScore();
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          fileUrl={previewDoc.fileUrl}
          fileName={previewDoc.fileName}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      <QRCodeUploadModal
        open={showQrModal}
        studentId={studentId}
        documentField="TEST_CERTIFICATE"
        documentType="TEST_SCORE"
        documentLabel="Test Score Certificate"
        onClose={() => setShowQrModal(false)}
        onCompleted={async (payload) => {
          setShowQrModal(false);
          try {
            const res = await fetch(payload.fileUrl);
            const blob = await res.blob();
            const file = new File([blob], payload.fileName || "certificate.pdf", { type: blob.type || "application/pdf" });
            await uploadCertificate(file);
          } catch {
            // handled in uploadCertificate
          }
        }}
      />
    </div>
  );
}
