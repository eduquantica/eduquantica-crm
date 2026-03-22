"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Plus, Copy, Trash2, Pencil, X, Loader2, ShieldCheck, Lock } from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODULES: { key: string; label: string; locked?: boolean }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "leads", label: "Leads" },
  { key: "students", label: "Students" },
  { key: "applications", label: "Applications" },
  { key: "universities", label: "Universities" },
  { key: "courses", label: "Courses" },
  { key: "sub-agents", label: "Sub-Agents" },
  { key: "communications", label: "Communications" },
  { key: "tasks", label: "Tasks" },
  { key: "commissions", label: "Commissions" },
  { key: "visa", label: "Visa" },
  { key: "documents", label: "Document Verification" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings", locked: true },
];

const ACTIONS: { key: "canView" | "canCreate" | "canEdit" | "canDelete"; label: string }[] = [
  { key: "canView", label: "View" },
  { key: "canCreate", label: "Create" },
  { key: "canEdit", label: "Edit" },
  { key: "canDelete", label: "Delete" },
];

type PermMap = Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>;

interface RoleData {
  id: string;
  name: string;
  label: string;
  isBuiltIn: boolean;
  createdAt: string | Date;
  permissions: { module: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }[];
  _count: { users: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEmptyPerms(): PermMap {
  return Object.fromEntries(MODULES.map((m) => [m.key, { canView: false, canCreate: false, canEdit: false, canDelete: false }]));
}

function permFromRole(role: RoleData): PermMap {
  const map = buildEmptyPerms();
  for (const p of role.permissions) {
    if (map[p.module] !== undefined) {
      map[p.module] = { canView: p.canView, canCreate: p.canCreate, canEdit: p.canEdit, canDelete: p.canDelete };
    }
  }
  return map;
}

function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function show(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }
  return { toast, show };
}

// ─── Permissions Matrix ───────────────────────────────────────────────────────

function PermissionsMatrix({
  perms,
  onChange,
  readOnly,
}: {
  perms: PermMap;
  onChange?: (module: string, action: "canView" | "canCreate" | "canEdit" | "canDelete", val: boolean) => void;
  readOnly?: boolean;
}) {
  function rowAllChecked(moduleKey: string) {
    const p = perms[moduleKey];
    return p && ACTIONS.every((a) => p[a.key]);
  }
  function colAllChecked(action: "canView" | "canCreate" | "canEdit" | "canDelete") {
    return MODULES.filter((m) => !m.locked).every((m) => perms[m.key]?.[action]);
  }
  function toggleRow(moduleKey: string, val: boolean) {
    ACTIONS.forEach((a) => onChange?.(moduleKey, a.key, val));
  }
  function toggleCol(action: "canView" | "canCreate" | "canEdit" | "canDelete", val: boolean) {
    MODULES.filter((m) => !m.locked).forEach((m) => onChange?.(m.key, action, val));
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left px-3 py-2.5 font-medium text-slate-600 w-44">Module</th>
            {ACTIONS.map((a) => (
              <th key={a.key} className="text-center px-2 py-2.5 font-medium text-slate-600 min-w-[72px]">
                <div className="flex flex-col items-center gap-1">
                  <span>{a.label}</span>
                  {!readOnly && (
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 accent-blue-600"
                      checked={colAllChecked(a.key)}
                      onChange={(e) => toggleCol(a.key, e.target.checked)}
                      title={`Select all ${a.label}`}
                    />
                  )}
                </div>
              </th>
            ))}
            {!readOnly && <th className="text-center px-2 py-2.5 font-medium text-slate-600 w-16">All</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {MODULES.map((mod) => {
            const p = perms[mod.key] ?? { canView: false, canCreate: false, canEdit: false, canDelete: false };
            const isLocked = mod.locked;
            return (
              <tr key={mod.key} className={cn("hover:bg-slate-50 transition-colors", isLocked && "bg-slate-50/60")}>
                <td className="px-3 py-2.5 text-slate-700 font-medium">
                  <div className="flex items-center gap-1.5">
                    {isLocked && <Lock className="w-3 h-3 text-slate-400" />}
                    {mod.label}
                  </div>
                </td>
                {ACTIONS.map((a) => (
                  <td key={a.key} className="text-center px-2 py-2.5">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-blue-600"
                      checked={isLocked ? false : p[a.key]}
                      disabled={readOnly || isLocked}
                      onChange={(e) => !isLocked && onChange?.(mod.key, a.key, e.target.checked)}
                    />
                  </td>
                ))}
                {!readOnly && (
                  <td className="text-center px-2 py-2.5">
                    {isLocked ? (
                      <span className="text-xs text-slate-300">Admin</span>
                    ) : (
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-slate-500"
                        checked={rowAllChecked(mod.key)}
                        onChange={(e) => toggleRow(mod.key, e.target.checked)}
                        title="Select all for this module"
                      />
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Role Builder Modal ───────────────────────────────────────────────────────

function RoleBuilderModal({
  role,
  onClose,
  onSaved,
}: {
  role?: RoleData;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const isEdit = Boolean(role);
  const [name, setName] = useState(role ? role.name : "");
  const [label, setLabel] = useState(role ? role.label : "");
  const [perms, setPerms] = useState<PermMap>(role ? permFromRole(role) : buildEmptyPerms());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function setCell(module: string, action: "canView" | "canCreate" | "canEdit" | "canDelete", val: boolean) {
    setPerms((prev) => ({ ...prev, [module]: { ...prev[module], [action]: val } }));
  }

  async function save() {
    setError("");
    if (!isEdit && !name.trim()) { setError("Role name is required."); return; }
    if (!isEdit && !label.trim()) { setError("Display label is required."); return; }
    setSaving(true);
    try {
      const url = isEdit ? `/api/admin/settings/roles/${role!.id}` : "/api/admin/settings/roles";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit ? { permissions: perms } : { name: name.trim(), label: label.trim(), permissions: perms };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error ?? "Something went wrong."); return; }

      onSaved(isEdit ? "Permissions updated." : "Role created successfully.");
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">
            {isEdit ? `Edit Permissions — ${role!.label}` : "Create New Role"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          {!isEdit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role Name</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. ADMISSIONS_OFFICER"
                />
                <p className="text-xs text-slate-400 mt-1">Internal identifier — will be uppercased.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Display Label</label>
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. Admissions Officer"
                />
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Permissions Matrix</p>
            <p className="text-xs text-slate-400 mb-3">Settings row is Admin-only and always locked for custom roles.</p>
            <PermissionsMatrix perms={perms} onChange={setCell} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
          <button
            disabled={saving}
            onClick={save}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60 transition"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Role"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function RolesClient({ roles: initialRoles }: { roles: RoleData[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { toast, show } = useToast();

  const [builderRole, setBuilderRole] = useState<RoleData | "new" | null>(null);
  const [viewRole, setViewRole] = useState<RoleData | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);

  function refresh() { startTransition(() => router.refresh()); }

  async function handleDelete(role: RoleData) {
    if (role._count.users > 0) {
      show(`Reassign ${role._count.users} user(s) before deleting this role.`, false);
      return;
    }
    if (!confirm(`Delete role "${role.label}"? This cannot be undone.`)) return;
    setDeleting(role.id);
    try {
      const res = await fetch(`/api/admin/settings/roles/${role.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { show(data?.error ?? "Failed to delete role.", false); return; }
      show("Role deleted.");
      refresh();
    } catch { show("Network error.", false); }
    finally { setDeleting(null); }
  }

  async function handleDuplicate(role: RoleData) {
    setDuplicating(role.id);
    try {
      const res = await fetch(`/api/admin/settings/roles/${role.id}/duplicate`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { show(data?.error ?? "Failed to duplicate role.", false); return; }
      show("Role duplicated.");
      refresh();
    } catch { show("Network error.", false); }
    finally { setDuplicating(null); }
  }

  const builtIn = initialRoles.filter((r) => r.isBuiltIn);
  const custom = initialRoles.filter((r) => !r.isBuiltIn);

  return (
    <div className="space-y-6">
      {/* Create button */}
      <div className="flex justify-end">
        <button
          onClick={() => setBuilderRole("new")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> Create New Role
        </button>
      </div>

      {/* Built-in roles */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Built-in Roles</h2>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {builtIn.map((role) => (
            <div key={role.id} className="flex items-center gap-3 px-4 py-3">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-900">{role.label}</p>
                <p className="text-xs text-slate-400">{role.name}</p>
              </div>
              <span className="text-xs text-slate-400">{role._count.users} user{role._count.users !== 1 ? "s" : ""}</span>
              <button
                onClick={() => setViewRole(role)}
                className="text-xs text-blue-600 hover:underline px-2 py-1 rounded hover:bg-blue-50 transition"
              >
                View permissions
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Custom roles */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Custom Roles</h2>
        {custom.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 border-dashed py-10 text-center">
            <p className="text-sm text-slate-400">No custom roles yet.</p>
            <button
              onClick={() => setBuilderRole("new")}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Create your first role →
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {custom.map((role) => {
              const hasUsers = role._count.users > 0;
              return (
                <div key={role.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{role.label}</p>
                    <p className="text-xs text-slate-400">{role.name}</p>
                  </div>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    hasUsers ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500",
                  )}>
                    {role._count.users} user{role._count.users !== 1 ? "s" : ""}
                  </span>
                  {/* Duplicate */}
                  <button
                    disabled={duplicating === role.id}
                    onClick={() => handleDuplicate(role)}
                    className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 disabled:opacity-50 transition"
                    title="Duplicate role"
                  >
                    {duplicating === role.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  </button>
                  {/* Edit permissions */}
                  <button
                    onClick={() => setBuilderRole(role)}
                    className="p-1.5 rounded hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition"
                    title="Edit permissions"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {/* Delete */}
                  {hasUsers ? (
                    <Link
                      href={`/dashboard/settings/users?roleId=${role.id}`}
                      className="p-1.5 rounded text-slate-300 cursor-not-allowed"
                      title={`Reassign ${role._count.users} user(s) before deleting`}
                      onClick={(e) => { e.preventDefault(); show(`Reassign ${role._count.users} user(s) before deleting this role.`, false); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Link>
                  ) : (
                    <button
                      disabled={deleting === role.id}
                      onClick={() => handleDelete(role)}
                      className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-50 transition"
                      title="Delete role"
                    >
                      {deleting === role.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Builder modal (create or edit) */}
      {builderRole !== null && (
        <RoleBuilderModal
          role={builderRole === "new" ? undefined : builderRole}
          onClose={() => setBuilderRole(null)}
          onSaved={(msg) => { setBuilderRole(null); show(msg); refresh(); }}
        />
      )}

      {/* Read-only view modal for built-in roles */}
      {viewRole && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">{viewRole.label} — Permissions</h3>
              <button onClick={() => setViewRole(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <PermissionsMatrix perms={permFromRole(viewRole)} readOnly />
            </div>
          </div>
        </div>
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
