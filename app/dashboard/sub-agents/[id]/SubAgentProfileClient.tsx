"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "overview" | "kpi" | "students" | "commissions" | "team" | "certificate";

type ProfileData = {
  viewerRole: string;
  header: {
    agencyName: string;
    contactName: string;
    country: string;
    email: string;
    phone: string;
    approvalDate: string | null;
    status: "APPROVED" | "SUSPENDED";
  };
  overview: {
    id: string;
    agencyName: string;
    firstName: string | null;
    lastName: string | null;
    roleAtAgency: string | null;
    businessEmail: string | null;
    primaryDialCode: string | null;
    agencyCountry: string | null;
    agencyCity: string | null;
    phone: string | null;
    website: string | null;
    expectedMonthlySubmissions: string | null;
    heardAboutUs: string | null;
    registrationDocUrl: string | null;
    createdAt: string;
  };
  agreement: {
    currentTier: "GOLD" | "SILVER" | "PLATINUM";
    currentRate: number;
    silverThreshold: number;
    platinumThreshold: number;
    intakePeriod: string;
    enrolmentsThisIntake: number;
    manualTierOverride: boolean;
    overrideReason: string;
    isActive: boolean;
    assignedContactId: string | null;
  };
  certificate: {
    tier: "SILVER" | "GOLD" | "PLATINUM" | null;
    tierAchievedAt: string | null;
    certificateIssuedAt: string | null;
    certificateUrl: string | null;
    kpiAchievementPercentage: number;
    history: Array<{
      id: string;
      tier: "SILVER" | "GOLD" | "PLATINUM";
      certificateNumber: string;
      certificateUrl: string;
      issuedAt: string;
      validUntil: string;
      achievementPct: number;
      reason: string | null;
      isManual: boolean;
    }>;
  };
  contacts: Array<{ id: string; name: string | null; email: string; role: { name: string } }>;
  students: Array<{ id: string; name: string; email: string; latestApplicationStatus: string }>;
  commissions: Array<{
    id: string;
    studentName: string;
    university: string;
    course: string;
    currency: string;
    tuitionFee: number;
    universityCommRate: number;
    grossCommission: number;
    agentRate: number | null;
    agentAmount: number | null;
    eduquanticaNet: number | null;
    status: string;
    createdAt: string;
  }>;
};

function money(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value || 0);
}

export default function SubAgentProfileClient({ id }: { id: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<ProfileData | null>(null);
  const [teamData, setTeamData] = useState<{
    agencyName: string;
    unassignedStudents: number;
    team: Array<{ id: string; name: string; email: string; role: string; isActive: boolean; studentsCount: number; createdAt: string }>;
  } | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamSavingId, setTeamSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignedContactId, setAssignedContactId] = useState<string>("");
  const [silverThreshold, setSilverThreshold] = useState(10);
  const [platinumThreshold, setPlatinumThreshold] = useState(20);
  const [intakePeriod, setIntakePeriod] = useState("");
  const [manualOverride, setManualOverride] = useState(false);
  const [forcedTier, setForcedTier] = useState<"GOLD" | "SILVER" | "PLATINUM">("GOLD");
  const [overrideReason, setOverrideReason] = useState("");
  const [statementMonth, setStatementMonth] = useState(new Date().toISOString().slice(0, 7));
  const [downloadingStatement, setDownloadingStatement] = useState(false);
  const [manualTier, setManualTier] = useState<"SILVER" | "GOLD" | "PLATINUM">("SILVER");
  const [manualTierReason, setManualTierReason] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sub-agents/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load profile");
      const payload = json.data as ProfileData;
      setData(payload);
      setAssignedContactId(payload.agreement.assignedContactId || "");
      setSilverThreshold(payload.agreement.silverThreshold);
      setPlatinumThreshold(payload.agreement.platinumThreshold);
      setIntakePeriod(payload.agreement.intakePeriod || "");
      setManualOverride(payload.agreement.manualTierOverride);
      setForcedTier(payload.agreement.currentTier);
      setOverrideReason(payload.agreement.overrideReason || "");
      setManualTier(payload.certificate.tier || "SILVER");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/admin/sub-agents/${id}/team`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load team");
      setTeamData(json.data);
    } catch {
      setTeamData(null);
    } finally {
      setTeamLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (tab === "team") fetchTeam();
  }, [tab, fetchTeam]);

  async function updateTeamMemberStatus(staffId: string, isActive: boolean) {
    setTeamSavingId(staffId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sub-agents/${id}/team/${staffId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setStatus",
          isActive,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update team member status");
      await fetchTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update team member status");
    } finally {
      setTeamSavingId(null);
    }
  }

  const progress = useMemo(() => {
    const target = data?.agreement.currentTier === "PLATINUM" ? platinumThreshold : silverThreshold;
    const value = data?.agreement.enrolmentsThisIntake || 0;
    const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
    return { value, target, pct };
  }, [data?.agreement.currentTier, data?.agreement.enrolmentsThisIntake, platinumThreshold, silverThreshold]);

  async function saveAssignedContact() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sub-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assignContact", contactUserId: assignedContactId || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save assigned contact");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save assigned contact");
    } finally {
      setSaving(false);
    }
  }

  async function saveKpiAgreement() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sub-agents/${id}/agreement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          silverThreshold,
          platinumThreshold,
          intakePeriod,
          manualTierOverride: manualOverride,
          forcedTier,
          overrideReason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save KPI agreement");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save KPI agreement");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSuspendActivate() {
    if (!data) return;
    const action = data.header.status === "APPROVED" ? "suspend" : "activate";
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sub-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update status");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  async function downloadStatement() {
    setDownloadingStatement(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sub-agents/${id}/commission-statement?month=${encodeURIComponent(statementMonth)}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to download statement");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `commission-statement-${statementMonth}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download statement");
    } finally {
      setDownloadingStatement(false);
    }
  }

  async function issueCertificateNow() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sub-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issueCertificateNow" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to issue certificate");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to issue certificate");
    } finally {
      setSaving(false);
    }
  }

  async function regenerateCertificate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sub-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerateCertificate" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to regenerate certificate");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate certificate");
    } finally {
      setSaving(false);
    }
  }

  async function setTierOverride() {
    if (!manualTierReason.trim()) {
      setError("Reason for manual override is required");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/sub-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setTierOverride",
          tier: manualTier,
          reason: manualTierReason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to set tier override");
      setManualTierReason("");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set tier override");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-slate-600">Loading...</div>;
  if (!data) return <div className="text-sm text-red-600">Failed to load profile.</div>;

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{data.header.agencyName}</h1>
          <p className="text-sm text-slate-600 mt-1">{data.header.contactName} • {data.header.country}</p>
          <p className="text-sm text-slate-500">{data.header.email} • {data.header.phone}</p>
          <p className="text-xs text-slate-500 mt-1">Approval date: {data.header.approvalDate ? new Date(data.header.approvalDate).toLocaleDateString("en-GB") : "-"}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${data.header.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
            {data.header.status}
          </span>
          {data.viewerRole === "ADMIN" && (
            <button onClick={toggleSuspendActivate} disabled={saving} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
              {data.header.status === "APPROVED" ? "Suspend" : "Activate"}
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="border-b border-slate-200 flex overflow-x-auto">
          {([
            ["overview", "Overview"],
            ["kpi", "KPI Agreement"],
            ["students", "Students"],
            ["commissions", "Commissions"],
            ["team", "Internal Team"],
            ["certificate", "Certificate"],
          ] as Array<[Tab, string]>).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${tab === key ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-600 hover:text-slate-900"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <Info label="Agency Name" value={data.overview.agencyName} />
                <Info label="Role at Agency" value={data.overview.roleAtAgency || "-"} />
                <Info label="First Name" value={data.overview.firstName || "-"} />
                <Info label="Last Name" value={data.overview.lastName || "-"} />
                <Info label="Business Email" value={data.overview.businessEmail || "-"} />
                <Info label="Phone" value={data.overview.phone || "-"} />
                <Info label="Dial Code" value={data.overview.primaryDialCode || "-"} />
                <Info label="Website" value={data.overview.website || "-"} />
                <Info label="Country" value={data.overview.agencyCountry || "-"} />
                <Info label="City" value={data.overview.agencyCity || "-"} />
                <Info label="Monthly Submissions" value={data.overview.expectedMonthlySubmissions || "-"} />
                <Info label="Heard About Us" value={data.overview.heardAboutUs || "-"} />
              </div>

              <div className="max-w-md space-y-2">
                <p className="text-sm font-semibold text-slate-900">Assigned EduQuantica Contact</p>
                <select value={assignedContactId} onChange={(e) => setAssignedContactId(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm">
                  <option value="">Unassigned</option>
                  {data.contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.name || contact.email} ({contact.role.name})</option>
                  ))}
                </select>
                <button onClick={saveAssignedContact} disabled={saving} className="rounded-md bg-blue-600 text-white px-3 py-2 text-sm disabled:opacity-50">Save Contact</button>
              </div>
            </div>
          )}

          {tab === "kpi" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                <p className="text-xs font-semibold text-slate-500">Current Tier</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{data.agreement.currentTier}</p>
                <p className="text-sm text-slate-600 mt-1">Current rate: {data.agreement.currentRate}%</p>

                <div className="mt-3">
                  <div className="flex justify-between text-xs text-slate-500"><span>Enrolments this intake</span><span>{progress.value} / {progress.target || 0}</span></div>
                  <div className="mt-1 h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-blue-600" style={{ width: `${progress.pct}%` }} /></div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <Field label="Silver threshold">
                  <input type="number" value={silverThreshold} onChange={(e) => setSilverThreshold(Number(e.target.value))} className="w-full border rounded-md px-3 py-2 text-sm" />
                </Field>
                <Field label="Platinum threshold">
                  <input type="number" value={platinumThreshold} onChange={(e) => setPlatinumThreshold(Number(e.target.value))} className="w-full border rounded-md px-3 py-2 text-sm" />
                </Field>
                <Field label="Intake Period">
                  <input type="month" value={intakePeriod || ""} onChange={(e) => setIntakePeriod(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
                </Field>
              </div>

              <div className="border border-slate-200 rounded-md p-3 space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" checked={manualOverride} onChange={(e) => setManualOverride(e.target.checked)} disabled={data.viewerRole !== "ADMIN"} />
                  Manual Override (Admin only)
                </label>

                {manualOverride && (
                  <div className="grid md:grid-cols-2 gap-3">
                    <Field label="Forced Tier">
                      <select value={forcedTier} onChange={(e) => setForcedTier(e.target.value as "GOLD" | "SILVER" | "PLATINUM")} className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="GOLD">GOLD</option>
                        <option value="SILVER">SILVER</option>
                        <option value="PLATINUM">PLATINUM</option>
                      </select>
                    </Field>
                    <Field label="Override Reason (required)">
                      <input value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
                    </Field>
                  </div>
                )}
              </div>

              <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Commission rates</p>
                <p className="mt-1">Silver: 80% | Gold: 85% | Platinum: 90%</p>
                <p className="text-xs text-slate-500 mt-1">Hard cap enforced: 90% maximum.</p>
              </div>

              <button onClick={saveKpiAgreement} disabled={saving} className="rounded-md bg-blue-600 text-white px-4 py-2 text-sm disabled:opacity-50">Save KPI Agreement</button>
            </div>
          )}

          {tab === "students" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4">Student</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Application Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.length === 0 ? (
                    <tr><td colSpan={3} className="py-3 text-slate-500">No students found.</td></tr>
                  ) : data.students.map((student) => (
                    <tr key={student.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{student.name}</td>
                      <td className="py-2 pr-4">{student.email}</td>
                      <td className="py-2 pr-4">{student.latestApplicationStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "commissions" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="month"
                  value={statementMonth}
                  onChange={(e) => setStatementMonth(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm"
                />
                <button
                  onClick={downloadStatement}
                  disabled={downloadingStatement}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {downloadingStatement ? "Downloading..." : "Download Statement"}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-2 pr-4">Student</th>
                    <th className="py-2 pr-4">University</th>
                    <th className="py-2 pr-4">Course</th>
                    <th className="py-2 pr-4">Gross</th>
                    <th className="py-2 pr-4">Agent Amount</th>
                    <th className="py-2 pr-4">EduQuantica Net</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.commissions.length === 0 ? (
                    <tr><td colSpan={7} className="py-3 text-slate-500">No commission records.</td></tr>
                  ) : data.commissions.map((commission) => (
                    <tr key={commission.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4">{commission.studentName}</td>
                      <td className="py-2 pr-4">{commission.university}</td>
                      <td className="py-2 pr-4">{commission.course}</td>
                      <td className="py-2 pr-4">{money(commission.grossCommission, commission.currency)}</td>
                      <td className="py-2 pr-4">{money(commission.agentAmount || 0, commission.currency)}</td>
                      <td className="py-2 pr-4">{money(commission.eduquanticaNet || 0, commission.currency)}</td>
                      <td className="py-2 pr-4">{commission.status}</td>
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "team" && (
            <div className="space-y-4">
              {teamLoading ? (
                <p className="text-sm text-slate-600">Loading team...</p>
              ) : !teamData ? (
                <p className="text-sm text-red-600">Failed to load internal team.</p>
              ) : (
                <>
                  <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                    <p>Unassigned students: <span className="font-semibold text-slate-900">{teamData.unassignedStudents}</span></p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-500 border-b border-slate-200">
                          <th className="py-2 pr-4">Name</th>
                          <th className="py-2 pr-4">Email</th>
                          <th className="py-2 pr-4">Role</th>
                          <th className="py-2 pr-4">Students</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamData.team.length === 0 ? (
                          <tr><td colSpan={6} className="py-3 text-slate-500">No internal team records.</td></tr>
                        ) : teamData.team.map((member) => (
                          <tr key={member.id} className="border-b border-slate-100">
                            <td className="py-2 pr-4">{member.name}</td>
                            <td className="py-2 pr-4">{member.email}</td>
                            <td className="py-2 pr-4">{member.role}</td>
                            <td className="py-2 pr-4">{member.studentsCount}</td>
                            <td className="py-2 pr-4">{member.isActive ? "Active" : "Inactive"}</td>
                            <td className="py-2 pr-4 text-right">
                              <button
                                disabled={teamSavingId === member.id}
                                onClick={() => updateTeamMemberStatus(member.id, !member.isActive)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                {teamSavingId === member.id ? "Saving..." : member.isActive ? "Deactivate" : "Activate"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "certificate" && (
            <div className="space-y-4">
              <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
                <p>Current tier: <span className="font-semibold text-slate-900">{data.certificate.tier || "NO TIER YET"}</span></p>
                <p>Tier achieved at: <span className="font-semibold text-slate-900">{data.certificate.tierAchievedAt ? new Date(data.certificate.tierAchievedAt).toLocaleDateString("en-GB") : "-"}</span></p>
                <p>Current KPI achievement: <span className="font-semibold text-slate-900">{data.certificate.kpiAchievementPercentage}%</span></p>
                <p>Certificate issued at: <span className="font-semibold text-slate-900">{data.certificate.certificateIssuedAt ? new Date(data.certificate.certificateIssuedAt).toLocaleDateString("en-GB") : "-"}</span></p>
              </div>

              <div className="flex flex-wrap gap-2">
                {data.certificate.certificateUrl && (
                  <a
                    href={data.certificate.certificateUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Download Current Certificate
                  </a>
                )}
                {data.viewerRole === "ADMIN" && (
                  <>
                    <button onClick={issueCertificateNow} disabled={saving || !data.certificate.tier} className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">
                      Issue Certificate Now
                    </button>
                    <button onClick={regenerateCertificate} disabled={saving || !data.certificate.tier} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      Regenerate Certificate
                    </button>
                    {!data.certificate.tier && (
                      <span
                        title="This sub-agent has not yet reached Silver tier (80% KPI). A certificate will be available once they achieve Silver status or above."
                        className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                      >
                        This sub-agent has not yet reached Silver tier (80% KPI). A certificate will be available once they achieve Silver status or above.
                      </span>
                    )}
                  </>
                )}
              </div>

              {data.viewerRole === "ADMIN" && (
                <div className="rounded-md border border-slate-200 p-3 space-y-3">
                  <p className="text-sm font-semibold text-slate-900">Manual Override</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Manually set tier">
                      <select value={manualTier} onChange={(e) => setManualTier(e.target.value as "SILVER" | "GOLD" | "PLATINUM")} className="w-full border rounded-md px-3 py-2 text-sm">
                        <option value="SILVER">SILVER</option>
                        <option value="GOLD">GOLD</option>
                        <option value="PLATINUM">PLATINUM</option>
                      </select>
                    </Field>
                    <Field label="Reason for manual override">
                      <input value={manualTierReason} onChange={(e) => setManualTierReason(e.target.value)} className="w-full border rounded-md px-3 py-2 text-sm" />
                    </Field>
                  </div>
                  <button onClick={setTierOverride} disabled={saving} className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">
                    Save Tier Override and Issue Certificate
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500 border-b border-slate-200">
                      <th className="py-2 pr-4">Tier</th>
                      <th className="py-2 pr-4">Certificate Number</th>
                      <th className="py-2 pr-4">Issued</th>
                      <th className="py-2 pr-4">Valid Until</th>
                      <th className="py-2 pr-4">KPI %</th>
                      <th className="py-2 pr-4 text-right">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.certificate.history.length === 0 ? (
                      <tr><td colSpan={6} className="py-3 text-slate-500">No certificate history yet.</td></tr>
                    ) : data.certificate.history.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="py-2 pr-4">{row.tier}</td>
                        <td className="py-2 pr-4">{row.certificateNumber}</td>
                        <td className="py-2 pr-4">{new Date(row.issuedAt).toLocaleDateString("en-GB")}</td>
                        <td className="py-2 pr-4">{new Date(row.validUntil).toLocaleDateString("en-GB")}</td>
                        <td className="py-2 pr-4">{row.achievementPct}%</td>
                        <td className="py-2 pr-4 text-right">
                          <a href={row.certificateUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">Download</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-slate-800 mt-1">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      {children}
    </div>
  );
}
