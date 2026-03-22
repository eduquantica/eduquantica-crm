"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type TeamMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  studentsCount: number;
};

type StudentRow = {
  id: string;
  studentName: string;
  subAgentStaffId?: string | null;
};

export default function AgentTeamClient() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [modal, setModal] = useState<"add" | "edit" | "assign" | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [assigningStaffId, setAssigningStaffId] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });

  async function fetchTeam() {
    setLoading(true);
    setError(null);
    try {
      const [teamRes, studentsRes] = await Promise.all([
        fetch("/api/agent/team", { cache: "no-store" }),
        fetch("/api/agent/students", { cache: "no-store" }),
      ]);

      const [teamJson, studentsJson] = await Promise.all([teamRes.json(), studentsRes.json()]);

      if (!teamRes.ok) throw new Error(teamJson.error || "Failed to load team");
      if (!studentsRes.ok) throw new Error(studentsJson.error || "Failed to load students");

      setTeam((teamJson.data.team || []).map((member: TeamMember) => ({
        ...member,
        userId: member.userId,
      })));
      setStudents((studentsJson.data || []).map((row: StudentRow) => ({
        id: row.id,
        studentName: row.studentName,
        subAgentStaffId: row.subAgentStaffId || null,
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeam();
  }, []);

  const unassignedStudents = useMemo(() => students.filter((student) => !student.subAgentStaffId), [students]);

  function closeModal() {
    setModal(null);
    setEditingMember(null);
    setAssigningStaffId("");
    setSelectedStudentIds([]);
    setForm({ name: "", email: "", phone: "" });
  }

  function openAddModal() {
    setForm({ name: "", email: "", phone: "" });
    setModal("add");
  }

  function openEditModal(member: TeamMember) {
    setEditingMember(member);
    setForm({ name: member.name, email: member.email, phone: member.phone || "" });
    setModal("edit");
  }

  function openAssignModal(staffId?: string) {
    const defaultStaffId = staffId || team.find((member) => member.isActive)?.id || "";
    setAssigningStaffId(defaultStaffId);
    setSelectedStudentIds([]);
    setModal("assign");
  }

  async function createMember(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
          role: "BRANCH_COUNSELLOR",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create member");
      closeModal();
      await fetchTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create member");
    } finally {
      setSaving(false);
    }
  }

  async function editMember(e: FormEvent) {
    e.preventDefault();
    if (!editingMember) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: editingMember.id,
          name: form.name,
          email: form.email,
          phone: form.phone || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update member");
      closeModal();
      await fetchTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update member");
    } finally {
      setSaving(false);
    }
  }

  async function toggleMember(member: TeamMember) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: member.id,
          isActive: !member.isActive,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update member");
      await fetchTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update member");
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(staffId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/team", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete member");
      await fetchTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete member");
    } finally {
      setSaving(false);
    }
  }

  async function assignStudents(e: FormEvent) {
    e.preventDefault();
    if (!assigningStaffId || selectedStudentIds.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/team/assign-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: assigningStaffId,
          studentIds: selectedStudentIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to assign students");
      closeModal();
      await fetchTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign students");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading team...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My Team</h1>
        <p className="text-sm text-slate-600">Create branch counsellors and assign students.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={openAddModal} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Add Team Member
        </button>
        <button onClick={() => openAssignModal()} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Assign Students
        </button>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Team Members</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Students</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {team.map((member) => (
                <tr key={member.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium text-slate-900">
                    <Link href={`/agent/team/${member.userId}`} className="text-blue-600 hover:underline">
                      {member.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-slate-700">{member.email}</td>
                  <td className="px-2 py-2 text-slate-700">{member.studentsCount}</td>
                  <td className="px-2 py-2 text-slate-700">{member.isActive ? "Active" : "Inactive"}</td>
                  <td className="px-2 py-2 text-right space-x-2">
                    <button onClick={() => openEditModal(member)} disabled={saving} className="text-xs text-slate-700 hover:underline disabled:opacity-50">
                      Edit
                    </button>
                    <button onClick={() => openAssignModal(member.id)} disabled={saving || !member.isActive} className="text-xs text-indigo-600 hover:underline disabled:opacity-50">
                      Assign
                    </button>
                    <button onClick={() => toggleMember(member)} disabled={saving} className="text-xs text-blue-600 hover:underline disabled:opacity-50">
                      {member.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => removeMember(member.id)} disabled={saving} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {team.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-slate-500">No team members yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal === "add" && (
        <Modal title="Add Team Member" onClose={closeModal}>
          <form onSubmit={createMember} className="space-y-3">
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Full name"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              required
            />
            <input
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              type="email"
              required
            />
            <input
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Phone"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button disabled={saving} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Add Counsellor</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "edit" && editingMember && (
        <Modal title="Edit Team Member" onClose={closeModal}>
          <form onSubmit={editMember} className="space-y-3">
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Full name"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              required
            />
            <input
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="Email"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              type="email"
              required
            />
            <input
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Phone"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button disabled={saving} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Save Changes</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === "assign" && (
        <Modal title="Assign Students" onClose={closeModal}>
          <form onSubmit={assignStudents} className="space-y-3">
            <select
              value={assigningStaffId}
              onChange={(e) => setAssigningStaffId(e.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              required
            >
              <option value="">Select counsellor</option>
              {team
                .filter((member) => member.isActive)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>

            <div className="max-h-56 overflow-auto rounded-md border border-slate-200 p-2">
              <div className="space-y-1">
                {unassignedStudents.map((student) => (
                  <label key={student.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(student.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudentIds((prev) => [...prev, student.id]);
                        } else {
                          setSelectedStudentIds((prev) => prev.filter((id) => id !== student.id));
                        }
                      }}
                    />
                    {student.studentName}
                  </label>
                ))}
                {unassignedStudents.length === 0 && <p className="text-sm text-slate-500">No students available for assignment.</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
              <button disabled={saving || !assigningStaffId || selectedStudentIds.length === 0} className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                Assign Selected Students
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
