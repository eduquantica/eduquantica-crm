"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppModal from "@/components/ui/AppModal";

type StaffOption = {
  id: string;
  name: string;
  email: string;
  roleName: string;
  roleLabel: string;
};

type OrganisationOption = {
  value: string;
  label: string;
};

type TrainingRecordRow = {
  id: string;
  trainingId: string;
  userId: string;
  staffName: string;
  staffRole: string;
  staffRoleName: string;
  trainingName: string;
  description?: string | null;
  deliveredBy?: string | null;
  trainingDate?: string | Date | null;
  completionDate: string | Date;
  expiryDate?: string | Date | null;
  status: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "RENEWED";
  certificateUrl?: string | null;
  notes?: string | null;
  isRecurring?: boolean;
  recurringMonths?: number | null;
  organisationType?: string;
  organisationLabel?: string;
};

type CalendarRow = {
  id: string;
  name: string;
  trainingDate: string | Date | null;
  deliveredBy?: string | null;
  bookedUsers: Array<{ id: string; name: string }>;
};

type Props = {
  apiBase: "/api/dashboard/training" | "/api/agent/training";
  variant: "dashboard" | "agent";
  canManage: boolean;
};

type ModalMode = "add" | "edit" | "renew";

type FormState = {
  userId: string;
  name: string;
  description: string;
  deliveredBy: string;
  trainingDate: string;
  completionDate: string;
  expiryDate: string;
  isRecurring: boolean;
  recurringMonths: string;
  certificateUrl: string;
  notes: string;
};

const emptyForm: FormState = {
  userId: "",
  name: "",
  description: "",
  deliveredBy: "",
  trainingDate: "",
  completionDate: "",
  expiryDate: "",
  isRecurring: false,
  recurringMonths: "",
  certificateUrl: "",
  notes: "",
};

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-GB");
}

function statusClass(status: TrainingRecordRow["status"]) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "EXPIRING_SOON") return "bg-amber-100 text-amber-700";
  if (status === "EXPIRED") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

export default function TrainingRecordsClient({ apiBase, variant, canManage }: Props) {
  const [activeTab, setActiveTab] = useState<"register" | "calendar" | "all">("register");
  const [records, setRecords] = useState<TrainingRecordRow[]>([]);
  const [calendarRows, setCalendarRows] = useState<CalendarRow[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [organisationOptions, setOrganisationOptions] = useState<OrganisationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [selectedRecord, setSelectedRecord] = useState<TrainingRecordRow | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [staffId, setStaffId] = useState("");
  const [trainingName, setTrainingName] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [organisation, setOrganisation] = useState("");

  const roleOptions = useMemo(() => {
    const values = new Set<string>();
    records.forEach((row) => values.add(row.staffRoleName));
    return Array.from(values.values());
  }, [records]);

  async function loadRegister() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (staffId) params.set("staffId", staffId);
      if (trainingName) params.set("trainingName", trainingName);
      if (status) params.set("status", status);
      if (role) params.set("role", role);

      if (variant === "dashboard") {
        params.set("scope", activeTab === "all" ? "all" : "edu");
        if (organisation) params.set("organisation", organisation);
      }

      const res = await fetch(`${apiBase}?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load records");

      setRecords(json.data.records || []);
      setStaffOptions(json.data.staffOptions || []);
      if (variant === "dashboard") {
        setOrganisationOptions(json.data.organisationOptions || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load records");
    } finally {
      setLoading(false);
    }
  }

  async function loadCalendar() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/calendar`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load calendar");
      setCalendarRows(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "calendar") {
      loadCalendar();
      return;
    }
    loadRegister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  async function applyFilters() {
    if (activeTab === "calendar") {
      await loadCalendar();
      return;
    }
    await loadRegister();
  }

  function openAddModal() {
    setModalMode("add");
    setSelectedRecord(null);
    setForm({
      ...emptyForm,
      userId: staffOptions[0]?.id || "",
      completionDate: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  }

  function openEditModal(row: TrainingRecordRow) {
    setModalMode("edit");
    setSelectedRecord(row);
    setForm({
      userId: row.userId,
      name: row.trainingName || "",
      description: row.description || "",
      deliveredBy: row.deliveredBy || "",
      trainingDate: row.trainingDate ? new Date(row.trainingDate).toISOString().slice(0, 10) : "",
      completionDate: row.completionDate ? new Date(row.completionDate).toISOString().slice(0, 10) : "",
      expiryDate: row.expiryDate ? new Date(row.expiryDate).toISOString().slice(0, 10) : "",
      isRecurring: !!row.isRecurring,
      recurringMonths: row.recurringMonths ? String(row.recurringMonths) : "",
      certificateUrl: row.certificateUrl || "",
      notes: row.notes || "",
    });
    setShowModal(true);
  }

  function openRenewModal(row: TrainingRecordRow) {
    setModalMode("renew");
    setSelectedRecord(row);
    setForm({
      userId: row.userId,
      name: row.trainingName || "",
      description: row.description || "",
      deliveredBy: row.deliveredBy || "",
      trainingDate: row.trainingDate ? new Date(row.trainingDate).toISOString().slice(0, 10) : "",
      completionDate: new Date().toISOString().slice(0, 10),
      expiryDate: row.expiryDate ? new Date(row.expiryDate).toISOString().slice(0, 10) : "",
      isRecurring: !!row.isRecurring,
      recurringMonths: row.recurringMonths ? String(row.recurringMonths) : "",
      certificateUrl: row.certificateUrl || "",
      notes: row.notes || "",
    });
    setShowModal(true);
  }

  async function uploadCertificate(file: File) {
    const formData = new FormData();
    formData.append("files", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const json = await res.json() as { urls?: string[]; error?: string; message?: string };
    if (!res.ok) throw new Error(json.error || "Upload failed");
    return {
      url: (json.urls?.[0] as string) || "",
      message: json.message || "",
    };
  }

  async function submitForm(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const basePayload = {
        name: form.name,
        description: form.description || null,
        deliveredBy: form.deliveredBy || null,
        trainingDate: form.trainingDate || null,
        completionDate: form.completionDate,
        expiryDate: form.expiryDate || null,
        isRecurring: form.isRecurring,
        recurringMonths: form.isRecurring && form.recurringMonths ? Number(form.recurringMonths) : null,
        certificateUrl: form.certificateUrl || null,
        notes: form.notes || null,
      };

      if (modalMode === "add") {
        const payload = {
          ...basePayload,
          userId: form.userId,
        };

        const res = await fetch(apiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to create record");
      } else {
        if (!selectedRecord) throw new Error("No selected record");

        const res = await fetch(`${apiBase}/${selectedRecord.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...basePayload,
            action: modalMode,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to update record");
      }

      setShowModal(false);
      setSelectedRecord(null);
      await applyFilters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save record");
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(recordId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${recordId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete record");
      await applyFilters();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete record");
    } finally {
      setSaving(false);
    }
  }

  async function handleExport() {
    const params = new URLSearchParams();
    params.set("scope", "all");
    if (staffId) params.set("staffId", staffId);
    if (trainingName) params.set("trainingName", trainingName);
    if (status) params.set("status", status);
    if (role) params.set("role", role);
    if (organisation) params.set("organisation", organisation);

    const url = `/api/dashboard/training/export?${params.toString()}`;
    window.open(url, "_blank");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`rounded-md px-3 py-2 text-sm font-medium ${activeTab === "register" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"}`}
          onClick={() => setActiveTab("register")}
        >
          Register
        </button>
        <button
          className={`rounded-md px-3 py-2 text-sm font-medium ${activeTab === "calendar" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"}`}
          onClick={() => setActiveTab("calendar")}
        >
          Calendar
        </button>
        {variant === "dashboard" && (
          <button
            className={`rounded-md px-3 py-2 text-sm font-medium ${activeTab === "all" ? "bg-blue-600 text-white" : "border border-slate-300 text-slate-700"}`}
            onClick={() => setActiveTab("all")}
          >
            All Organisations
          </button>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          {variant === "dashboard" && activeTab === "all" && (
            <button onClick={handleExport} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Export CSV
            </button>
          )}
          {canManage && activeTab !== "calendar" && (
            <button type="button" onClick={openAddModal} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" aria-label="Add Training Record">
              Add Training Record
            </button>
          )}
        </div>
      </div>

      {activeTab !== "calendar" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All Staff</option>
              {staffOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </select>
            <input
              value={trainingName}
              onChange={(e) => setTrainingName(e.target.value)}
              placeholder="Training name"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRING_SOON">Expiring Soon</option>
              <option value="EXPIRED">Expired</option>
              <option value="RENEWED">Renewed</option>
            </select>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">All Roles</option>
              {roleOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {variant === "dashboard" && activeTab === "all" && (
              <select value={organisation} onChange={(e) => setOrganisation(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                <option value="">All Organisations</option>
                {organisationOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            )}
            <button onClick={applyFilters} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Apply
            </button>
          </div>
        </div>
      )}

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {info && <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{info}</div>}

      <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-600">Loading...</div>
        ) : activeTab === "calendar" ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2">Training</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Delivered By</th>
                <th className="px-3 py-2">Booked Users</th>
              </tr>
            </thead>
            <tbody>
              {calendarRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.name}</td>
                  <td className="px-3 py-2 text-slate-700">{formatDate(row.trainingDate)}</td>
                  <td className="px-3 py-2 text-slate-700">{row.deliveredBy || "-"}</td>
                  <td className="px-3 py-2 text-slate-700">{row.bookedUsers.map((item) => item.name).join(", ") || "-"}</td>
                </tr>
              ))}
              {calendarRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-5 text-sm text-slate-500">No upcoming training sessions.</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Training</th>
                {activeTab === "all" && <th className="px-3 py-2">Organisation</th>}
                <th className="px-3 py-2">Completion</th>
                <th className="px-3 py-2">Expiry</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Certificate</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {records.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900">{row.staffName}</p>
                    <p className="text-xs text-slate-500">{row.staffRole}</p>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900">{row.trainingName}</p>
                    <p className="text-xs text-slate-500">{row.deliveredBy || "-"}</p>
                  </td>
                  {activeTab === "all" && <td className="px-3 py-2 text-slate-700">{row.organisationLabel || "-"}</td>}
                  <td className="px-3 py-2 text-slate-700">{formatDate(row.completionDate)}</td>
                  <td className="px-3 py-2 text-slate-700">{formatDate(row.expiryDate)}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}>
                      {row.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {row.certificateUrl ? (
                      <a href={row.certificateUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                        View
                      </a>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    {canManage && (
                      <>
                        <button onClick={() => openEditModal(row)} className="text-xs text-slate-700 hover:underline" disabled={saving}>
                          Edit
                        </button>
                        <button onClick={() => openRenewModal(row)} className="text-xs text-blue-600 hover:underline" disabled={saving}>
                          Renew
                        </button>
                        <button onClick={() => setDeletingRecordId(row.id)} className="text-xs text-red-600 hover:underline" disabled={saving}>
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={activeTab === "all" ? 8 : 7} className="px-3 py-5 text-sm text-slate-500">No training records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <AppModal maxWidthClass="max-w-2xl">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              {modalMode === "add" ? "Add Training" : modalMode === "edit" ? "Edit Training" : "Renew Training"}
            </h2>
            <form onSubmit={submitForm} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {modalMode === "add" && (
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">Staff</label>
                  <select
                    name="userId"
                    value={form.userId}
                    onChange={(e) => setForm((prev) => ({ ...prev, userId: e.target.value }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select staff</option>
                    {staffOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.name} ({opt.roleLabel})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Training Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Delivered By</label>
                <input
                  name="deliveredBy"
                  value={form.deliveredBy}
                  onChange={(e) => setForm((prev) => ({ ...prev, deliveredBy: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Training Date</label>
                <input
                  name="trainingDate"
                  type="date"
                  value={form.trainingDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, trainingDate: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Completion Date</label>
                <input
                  name="completionDate"
                  type="date"
                  value={form.completionDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, completionDate: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Expiry Date</label>
                <input
                  name="expiryDate"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  id="recurring"
                  name="isRecurring"
                  type="checkbox"
                  checked={form.isRecurring}
                  onChange={(e) => setForm((prev) => ({ ...prev, isRecurring: e.target.checked }))}
                />
                <label htmlFor="recurring" className="text-sm text-slate-700">Recurring</label>
              </div>

              {form.isRecurring && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Recurring Months</label>
                  <input
                    name="recurringMonths"
                    type="number"
                    min={1}
                    max={36}
                    value={form.recurringMonths}
                    onChange={(e) => setForm((prev) => ({ ...prev, recurringMonths: e.target.value }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  rows={2}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Certificate URL</label>
                <div className="flex gap-2">
                  <input
                    name="certificateUrl"
                    value={form.certificateUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, certificateUrl: e.target.value }))}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    placeholder="https://..."
                  />
                  <label className="cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                    Upload
                    <input
                      name="certificateFile"
                      type="file"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          setSaving(true);
                          setError(null);
                          setInfo(null);
                          const { url, message } = await uploadCertificate(file);
                          setForm((prev) => ({ ...prev, certificateUrl: url }));
                          if (message) {
                            setInfo(message);
                          }
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Upload failed");
                        } finally {
                          setSaving(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  rows={2}
                />
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Saving..." : modalMode === "renew" ? "Renew" : "Save"}
                </button>
              </div>
            </form>
        </AppModal>
      )}

      {deletingRecordId && (
        <AppModal maxWidthClass="max-w-md">
            <h3 className="text-base font-semibold text-slate-900">Delete Training Record</h3>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete this training record? This action cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingRecordId(null)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const targetId = deletingRecordId;
                  setDeletingRecordId(null);
                  if (targetId) await removeRecord(targetId);
                }}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
        </AppModal>
      )}
    </div>
  );
}
