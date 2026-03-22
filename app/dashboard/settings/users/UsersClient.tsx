"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { cn } from "@/lib/cn";
import {
  Search, Plus, X, ChevronLeft, ChevronRight,
  ShieldCheck, UserX, UserCheck, KeyRound, Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleRef { id: string; name: string; label: string }
interface UserRow {
  id: string; name: string | null; email: string;
  isActive: boolean; createdAt: string | Date;
  role: RoleRef & { isBuiltIn: boolean };
}
interface Props {
  users: UserRow[];
  total: number; page: number; pageSize: number;
  staffRoles: RoleRef[];
  currentAdminId: string;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function show(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }
  return { toast, show };
}

// ─── Small reusable pieces ────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

// ─── Main component ────────────────────────────────────────────────────────────

export default function UsersClient({ users, total, page, pageSize, staffRoles, currentAdminId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { toast, show } = useToast();

  // Filters
  const search = searchParams.get("search") ?? "";
  const roleId = searchParams.get("roleId") ?? "";

  function updateParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value); else p.delete(key);
    p.delete("page");
    startTransition(() => router.push(`${pathname}?${p.toString()}`));
  }

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "", roleId: staffRoles[0]?.id ?? "" });
  const [createError, setCreateError] = useState("");

  async function handleCreate() {
    setCreateError("");
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.roleId) {
      setCreateError("All fields are required."); return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setCreateError(data?.error ?? "Something went wrong."); return; }
      setShowCreate(false);
      setCreateForm({ name: "", email: "", roleId: staffRoles[0]?.id ?? "" });
      show("Account created. A set-password email has been sent.");
      startTransition(() => router.refresh());
    } catch { setCreateError("Network error."); }
    finally { setCreating(false); }
  }

  // Edit panel
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [editRoleId, setEditRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  function openPanel(user: UserRow) {
    setSelected(user);
    setEditRoleId(user.role.id);
  }
  function closePanel() { setSelected(null); }

  async function patch(id: string, body: object, successMsg: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/settings/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { show(data?.error ?? "Something went wrong.", false); return; }
      show(successMsg);
      closePanel();
      startTransition(() => router.refresh());
    } catch { show("Network error.", false); }
    finally { setSaving(false); }
  }

  async function handleResetPassword(id: string) {
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/settings/users/${id}/reset-password`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { show(data?.error ?? "Something went wrong.", false); return; }
      show("Password reset email sent.");
    } catch { show("Network error.", false); }
    finally { setResetting(false); }
  }

  const totalPages = Math.ceil(total / pageSize);
  const isSelf = selected?.id === currentAdminId;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            placeholder="Search name or email…"
            defaultValue={search}
            onChange={(e) => {
              const v = e.target.value;
              const t = setTimeout(() => updateParam("search", v), 400);
              return () => clearTimeout(t);
            }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <select
          value={roleId}
          onChange={(e) => updateParam("roleId", e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Roles</option>
          {staffRoles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> Create Staff Account
        </button>
      </div>

      {isPending && <p className="text-xs text-slate-400 animate-pulse">Loading…</p>}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {users.length === 0 ? (
          <p className="text-center py-12 text-sm text-slate-400">No staff accounts found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden lg:table-cell">Created</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => openPanel(u)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{u.name ?? "—"}</p>
                    <p className="text-xs text-slate-400 md:hidden">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      <ShieldCheck className="w-3 h-3" />{u.role.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                      u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
                    )}>
                      {u.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell">
                    {format(new Date(u.createdAt), "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/users/${u.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <p>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</p>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <button onClick={() => updateParam("page", String(page - 1))} className="p-1.5 rounded hover:bg-slate-100">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <span className="px-3 py-1 rounded bg-slate-100 font-medium">{page} / {totalPages}</span>
            {page < totalPages && (
              <button onClick={() => updateParam("page", String(page + 1))} className="p-1.5 rounded hover:bg-slate-100">
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Create modal ── */}
      {showCreate && (
        <Modal title="Create Staff Account" onClose={() => setShowCreate(false)}>
          <div className="space-y-4">
            {createError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{createError}</p>
            )}
            <Field label="Full Name">
              <input className={inputCls} value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
            </Field>
            <Field label="Email Address">
              <input type="email" className={inputCls} value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
            </Field>
            <Field label="Role">
              <select className={inputCls} value={createForm.roleId} onChange={(e) => setCreateForm((f) => ({ ...f, roleId: e.target.value }))}>
                {staffRoles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </Field>
            <p className="text-xs text-slate-400">A set-password link will be emailed to the user (expires in 48 h).</p>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
            <button
              disabled={creating}
              onClick={handleCreate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60 transition"
            >
              {creating && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Account
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit slide-over ── */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/20 z-30" onClick={closePanel} />
          <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-white shadow-2xl z-40 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Edit Account</h3>
              <button onClick={closePanel} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <div>
                <p className="font-medium text-slate-900">{selected.name ?? "—"}</p>
                <p className="text-sm text-slate-500">{selected.email}</p>
                <span className={cn(
                  "mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                  selected.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700",
                )}>{selected.isActive ? "Active" : "Inactive"}</span>
              </div>

              {/* Role selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <select className={inputCls} value={editRoleId} onChange={(e) => setEditRoleId(e.target.value)}>
                  {staffRoles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <p className="text-xs text-slate-400 mt-1">Role change applies on the user&apos;s next request.</p>
                <button
                  disabled={saving || editRoleId === selected.role.id}
                  onClick={() => patch(selected.id, { roleId: editRoleId }, "Role updated.")}
                  className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium disabled:opacity-50 transition"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Role
                </button>
              </div>

              {/* Reset password */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-1">Reset Password</p>
                <p className="text-xs text-slate-400 mb-2">Sends a new set-password link to the user (24 h expiry).</p>
                <button
                  disabled={resetting || !selected.isActive}
                  onClick={() => handleResetPassword(selected.id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium disabled:opacity-50 transition border border-slate-300"
                >
                  {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  Send Reset Link
                </button>
              </div>

              {/* Activate / Deactivate */}
              <div className="border-t border-slate-100 pt-4">
                <p className="text-sm font-medium text-slate-700 mb-1">Account Status</p>
                {isSelf ? (
                  <p className="text-xs text-slate-400">You cannot deactivate your own account.</p>
                ) : selected.isActive ? (
                  <>
                    <p className="text-xs text-slate-400 mb-2">Deactivating will block this user from signing in.</p>
                    <button
                      disabled={saving}
                      onClick={() => patch(selected.id, { isActive: false }, "Account deactivated.")}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-medium disabled:opacity-50 transition border border-red-200"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                      Deactivate Account
                    </button>
                  </>
                ) : (
                  <button
                    disabled={saving}
                    onClick={() => patch(selected.id, { isActive: true }, "Account reactivated.")}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 text-xs font-medium disabled:opacity-50 transition border border-green-200"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                    Reactivate Account
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium",
          toast.ok ? "bg-green-50 border border-green-200 text-green-800" : "bg-red-50 border border-red-200 text-red-800",
        )}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
