"use client";

import { useMemo, useState } from "react";

type TabKey = "profile" | "documents" | "academic" | "applications" | "notes";

type StudentDetailClientProps = {
  studentId: string;
  roleName: string;
};

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type NotesForm = {
  internalNotes: string;
};

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "profile", label: "Profile" },
  { key: "documents", label: "Documents" },
  { key: "academic", label: "Academic" },
  { key: "applications", label: "Applications" },
  { key: "notes", label: "Notes" },
];

function canUseEditMode(roleName: string) {
  return ["ADMIN", "MANAGER", "SUB_AGENT", "BRANCH_MANAGER"].includes(roleName);
}

export default function StudentDetailClient({ studentId, roleName }: StudentDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [editMode, setEditMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const [notesForm, setNotesForm] = useState<NotesForm>({ internalNotes: "" });

  const editable = canUseEditMode(roleName) && editMode;
  const canToggle = canUseEditMode(roleName);

  const heading = useMemo(() => {
    return TABS.find((tab) => tab.key === activeTab)?.label || "Student";
  }, [activeTab]);

  function handleSave(section: string) {
    setMessage(`${section} saved (demo mode).`);
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-8">
      <header className="portal-shell-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Student Detail</h1>
            <p className="text-sm text-slate-600">Student ID: {studentId}</p>
          </div>

          {canToggle ? (
            <button
              type="button"
              onClick={() => {
                setEditMode((prev) => !prev);
                setMessage(null);
              }}
              className={
                editMode
                  ? "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                  : "portal-btn-ghost"
              }
            >
              Edit Mode: {editMode ? "ON" : "OFF"}
            </button>
          ) : (
            <span className="portal-chip">Read only</span>
          )}
        </div>
      </header>

      <nav className="portal-shell-card p-2">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? "rounded-lg bg-gradient-to-r from-[#1B2A4A] to-[#2f4f86] px-3 py-1.5 text-sm font-semibold text-white"
                  : "portal-btn-ghost px-3 py-1.5 text-sm font-semibold"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <section className="portal-shell-card p-4">
        <h2 className="text-lg font-semibold text-slate-900">{heading}</h2>

        {activeTab === "profile" && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              value={profileForm.firstName}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, firstName: event.target.value }))}
              disabled={!editable}
              placeholder="First name"
              className="portal-input disabled:bg-slate-100"
            />
            <input
              value={profileForm.lastName}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, lastName: event.target.value }))}
              disabled={!editable}
              placeholder="Last name"
              className="portal-input disabled:bg-slate-100"
            />
            <input
              value={profileForm.email}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
              disabled={!editable}
              placeholder="Email"
              className="portal-input disabled:bg-slate-100"
            />
            <input
              value={profileForm.phone}
              onChange={(event) => setProfileForm((prev) => ({ ...prev, phone: event.target.value }))}
              disabled={!editable}
              placeholder="Phone"
              className="portal-input disabled:bg-slate-100"
            />
            {editable && (
              <button
                type="button"
                onClick={() => handleSave("Profile")}
                className="portal-btn-primary w-fit"
              >
                Save Profile
              </button>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p>{editable ? "Documents can be edited in Edit Mode." : "Documents are read only while Edit Mode is OFF."}</p>
            {editable && (
              <button
                type="button"
                onClick={() => handleSave("Documents")}
                className="portal-btn-primary"
              >
                Save Documents
              </button>
            )}
          </div>
        )}

        {activeTab === "academic" && (
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p>{editable ? "Academic fields are editable." : "Academic tab is read only."}</p>
            {editable && (
              <button
                type="button"
                onClick={() => handleSave("Academic")}
                className="portal-btn-primary"
              >
                Save Academic
              </button>
            )}
          </div>
        )}

        {activeTab === "applications" && (
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p>{editable ? "Application details are editable." : "Application details are read only."}</p>
            {editable && (
              <button
                type="button"
                onClick={() => handleSave("Applications")}
                className="portal-btn-primary"
              >
                Save Applications
              </button>
            )}
          </div>
        )}

        {activeTab === "notes" && (
          <div className="mt-4 space-y-3">
            <textarea
              value={notesForm.internalNotes}
              onChange={(event) => setNotesForm({ internalNotes: event.target.value })}
              disabled={!editable}
              placeholder="Internal notes"
              className="portal-input min-h-[140px] w-full disabled:bg-slate-100"
            />
            {editable && (
              <button
                type="button"
                onClick={() => handleSave("Notes")}
                className="portal-btn-primary"
              >
                Save Notes
              </button>
            )}
          </div>
        )}
      </section>

      {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
    </main>
  );
}
