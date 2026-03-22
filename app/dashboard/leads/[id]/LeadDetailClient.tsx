"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Session } from "next-auth";
import { Loader2, Mail, Phone, MapPin, Flag, Edit2, Trash2, UserCheck, MessageSquare, Phone as CallIcon, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { LogCallModal } from "@/components/LogCallModal";
import FollowUpModal from "@/components/FollowUpModal";

interface CommunicationLog {
  id: string;
  type: string;
  subject?: string | null;
  message: string;
  direction: string;
  createdAt: string;
  user: { id: string; name: string | null };
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  interestedCountry: string | null;
  source: string;
  status: string;
  createdAt: string;
  assignedCounsellorId?: string | null;
  subAgentId?: string | null;
  notes: string | null;
  campaign: string | null;
  interestedLevel: string | null;
  score: number;
  assignedCounsellor: { id: string; name: string | null; email: string } | null;
  subAgent: { id: string; agencyName: string } | null;
  communications: CommunicationLog[];
  tasks: Array<{ id: string; title: string; dueDate?: string | null }>;
}

interface LeadDetailClientProps {
  initialLead: Lead;
  session: Session; // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userRole: string;
  userId: string;
  backHref?: string;
  onDeleteRedirectHref?: string;
  canDeleteLead?: boolean;
  counsellorOptions?: Array<{ id: string; name: string }>;
  subAgentOptions?: Array<{ id: string; agencyName: string }>;
  allowAssignCounsellor?: boolean;
  allowAssignSubAgent?: boolean;
  deleteEndpointBase?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-slate-100 text-slate-600" },
  CONTACTED: { label: "Contacted", className: "bg-blue-100 text-blue-700" },
  QUALIFIED: { label: "Interested", className: "bg-amber-100 text-amber-700" },
  CONVERTED: { label: "Converted", className: "bg-teal-100 text-teal-700" },
  LOST: { label: "Lost", className: "bg-red-100 text-red-600" },
};

const SOURCE_LABELS: Record<string, string> = {
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  WHATSAPP: "WhatsApp",
  GOOGLE_ADS: "Google Ads",
  WEBSITE: "Website",
  REFERRAL: "Referral",
  WALK_IN: "Walk-in",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
}

export default function LeadDetailClient({
  initialLead,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  session,
  userRole,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId,
  backHref = "/dashboard/leads",
  onDeleteRedirectHref = "/dashboard/leads",
  canDeleteLead,
  counsellorOptions = [],
  subAgentOptions = [],
  allowAssignCounsellor = false,
  allowAssignSubAgent = false,
  deleteEndpointBase = "/api/leads",
}: LeadDetailClientProps) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead>(initialLead);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email || "",
    phone: lead.phone || "",
    nationality: lead.nationality || "",
    interestedCountry: lead.interestedCountry || "",
    source: lead.source,
    status: lead.status,
    notes: lead.notes || "",
    campaign: lead.campaign || "",
    interestedLevel: lead.interestedLevel || "",
  });

  const [saving, setSaving] = useState(false);
  const [deletingLead, setDeletingLead] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [statusChangeLoading, setStatusChangeLoading] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertingToStudent, setConvertingToStudent] = useState(false);
  const [assigningCounsellor, setAssigningCounsellor] = useState(false);
  const [assigningSubAgent, setAssigningSubAgent] = useState(false);

  // const canEdit = userRole === "ADMIN" || userRole === "MANAGER" || (userRole === "COUNSELLOR" && lead.assignedCounsellorId === userId);
  const canDelete = canDeleteLead ?? ["ADMIN"].includes(userRole);
  const canEdit = userRole === "ADMIN" || userRole === "MANAGER";
  const canChangeCounsellor = userRole === "ADMIN" || userRole === "MANAGER";
  const canConvert = userRole === "ADMIN" || userRole === "MANAGER";

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      if (!res.ok) throw new Error("Failed to save");

      const { data } = await res.json();
      setLead(data.lead);
      setIsEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLead() {
    setDeletingLead(true);

    try {
      const res = await fetch(`${deleteEndpointBase}/${lead.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete");

      router.push(onDeleteRedirectHref);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingLead(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleAddNote() {
    if (!noteInput.trim()) return;

    setSubmittingNote(true);

    try {
      const res = await fetch(`/api/dashboard/communications/leads/${lead.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "NOTE",
          message: noteInput,
        }),
      });

      if (!res.ok) throw new Error("Failed to add note");

      const { communication, data } = await res.json();
      const newCommunication = communication || data?.communication;
      setLead({
        ...lead,
        communications: newCommunication ? [newCommunication, ...lead.communications] : lead.communications,
      });
      setNoteInput("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setSubmittingNote(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setStatusChangeLoading(true);

    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to change status");

      const { data } = await res.json();
      setLead(data.lead);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to change status");
    } finally {
      setStatusChangeLoading(false);
    }
  }



  async function handleConvertToStudent() {
    setConvertingToStudent(true);

    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/convert-to-student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to convert lead");
      }

      const { data } = await res.json();
      
      // Show success message and redirect
      setTimeout(() => {
        router.push(`/dashboard/students/${data.student.id}`);
        router.refresh();
      }, 1000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to convert lead");
    } finally {
      setConvertingToStudent(false);
      setShowConvertModal(false);
    }
  }

  async function handleAssignCounsellor(counsellorId: string) {
    setAssigningCounsellor(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/assign-counsellor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counsellorId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to assign counsellor");

      setLead((prev) => ({
        ...prev,
        assignedCounsellorId: counsellorId,
        assignedCounsellor: payload.data?.lead?.assignedCounsellor || prev.assignedCounsellor,
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign counsellor");
    } finally {
      setAssigningCounsellor(false);
    }
  }

  async function handleAssignSubAgent(subAgentId: string) {
    setAssigningSubAgent(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}/assign-sub-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subAgentId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to assign sub-agent");

      setLead((prev) => ({
        ...prev,
        subAgentId,
        subAgent: payload.data?.lead?.subAgent || prev.subAgent,
      }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign sub-agent");
    } finally {
      setAssigningSubAgent(false);
    }
  }

  const statusConfig = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NEW;

  return (
    <div className="p-6">
      {/* Header with back button */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={backHref}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Leads
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* LEFT SECTION - Lead Summary Card */}
        <div className="lg:col-span-1">
          {/* Summary Card */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 sticky top-6">
            {/* Status Badge */}
            <div className="mb-4">
              <span
                className={cn(
                  "inline-block px-3 py-1 rounded-full text-sm font-medium",
                  statusConfig.className
                )}
              >
                {statusConfig.label}
              </span>
            </div>

            {/* Full Name & Title */}
            <h1 className="text-2xl font-bold text-slate-900 mb-1">
              {lead.firstName} {lead.lastName}
            </h1>

            {/* Lead Score Circular */}
            <div className="mb-6 flex items-center gap-4">
              {(() => {
                return (
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      {/* Background circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="8"
                      />
                      {/* Progress circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="8"
                        strokeDasharray={`${(lead.score / 100) * 282.7} 282.7`}
                        strokeLinecap="round"
                        className={cn(
                          "transition-all duration-500",
                          lead.score >= 70
                            ? "text-green-600"
                            : lead.score >= 40
                              ? "text-amber-600"
                              : "text-red-600"
                        )}
                      />
                    </svg>
                    {/* Center text */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-bold text-slate-900">
                        {lead.score}
                      </span>
                    </div>
                  </div>
                );
              })()}
              <div>
                <p className="text-sm text-slate-600">Lead Score</p>
                <p className="text-xs text-slate-500">
                  {lead.score >= 70
                    ? "Highly Engaged"
                    : lead.score >= 40
                      ? "Moderately Engaged"
                      : "Low Engagement"}
                </p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-3 mb-6 pb-6 border-b border-slate-200">
              {lead.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 uppercase">Email</p>
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-sm text-blue-600 hover:underline break-all"
                    >
                      {lead.email}
                    </a>
                  </div>
                </div>
              )}

              {lead.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 uppercase">Phone</p>
                    <a
                      href={`tel:${lead.phone}`}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {lead.phone}
                    </a>
                  </div>
                </div>
              )}

              {lead.nationality && (
                <div className="flex items-start gap-3">
                  <Flag className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 uppercase">Nationality</p>
                    <p className="text-sm text-slate-700">{lead.nationality}</p>
                  </div>
                </div>
              )}

              {lead.interestedCountry && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-slate-400 mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500 uppercase">Residence</p>
                    <p className="text-sm text-slate-700">{lead.interestedCountry}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Additional Info */}
            <div className="space-y-3 mb-6 pb-6 border-b border-slate-200">
              {lead.source && (
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Source</p>
                  <p className="text-sm text-slate-700">
                    {SOURCE_LABELS[lead.source] || lead.source}
                  </p>
                </div>
              )}

              {lead.campaign && (
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">
                    Preferred Destination
                  </p>
                  <p className="text-sm text-slate-700">{lead.campaign}</p>
                </div>
              )}

              {lead.interestedLevel && (
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">
                    Interested In
                  </p>
                  <p className="text-sm text-slate-700">{lead.interestedLevel}</p>
                </div>
              )}

              {lead.subAgent && (
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Sub-Agent</p>
                  <p className="text-sm text-slate-700">{lead.subAgent.agencyName}</p>
                </div>
              )}

              {lead.assignedCounsellor && (
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Counsellor</p>
                  <p className="text-sm text-slate-700">
                    {lead.assignedCounsellor.name || lead.assignedCounsellor.email}
                  </p>
                </div>
              )}

              {(canChangeCounsellor || allowAssignCounsellor) && counsellorOptions.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Assign Counsellor</p>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={lead.assignedCounsellorId || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) handleAssignCounsellor(value);
                    }}
                    disabled={assigningCounsellor}
                  >
                    <option value="">Unassigned</option>
                    {counsellorOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {allowAssignSubAgent && subAgentOptions.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase mb-1">Assign Sub-Agent</p>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={lead.subAgentId || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value) handleAssignSubAgent(value);
                    }}
                    disabled={assigningSubAgent}
                  >
                    <option value="">None</option>
                    {subAgentOptions.map((a) => (
                      <option key={a.id} value={a.id}>{a.agencyName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">Date Added</p>
                <p className="text-sm text-slate-700">
                  {formatDateShort(lead.createdAt)}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              {canEdit && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit Lead
                </button>
              )}

              {canConvert && (
                <button
                  onClick={() => setShowConvertModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <UserCheck className="w-4 h-4" />
                  Convert to Student
                </button>
              )}

              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 rounded-lg hover:bg-red-50 text-red-700 text-sm font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Lead
                </button>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 bg-white rounded-lg border border-slate-200 p-6 space-y-2">
            <h3 className="font-semibold text-slate-900 mb-4">Quick Actions</h3>

            <button
              type="button"
              onClick={() => setShowLogCallModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
            >
              <CallIcon className="w-4 h-4" />
              Log Call
            </button>

            <button
              type="button"
              onClick={() => setShowFollowUpModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
            >
              <Clock className="w-4 h-4" />
              Schedule Follow-Up
            </button>
          </div>
        </div>

        {/* RIGHT SECTION - Activity Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Change Status */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Update Status</h3>
            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={statusChangeLoading}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="NEW">New</option>
              <option value="CONTACTED">Contacted</option>
              <option value="QUALIFIED">Interested</option>
              <option value="CONVERTED">Converted</option>
              <option value="LOST">Lost</option>
            </select>
          </div>



          {/* Add Note */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Add Note</h3>
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Type a note..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleAddNote}
              disabled={submittingNote || !noteInput.trim()}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-2"
            >
              {submittingNote && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Note
            </button>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-lg border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-6">Activity</h3>

            {lead.communications.length === 0 ? (
              <p className="text-sm text-slate-500">No activity yet</p>
            ) : (
              <div className="space-y-4">
                {lead.communications.map((comm) => (
                  <div key={comm.id} className="flex gap-3 pb-4 border-b border-slate-100 last:border-b-0">
                    <div className="flex-shrink-0">
                      {comm.type === "NOTE" && (
                        <MessageSquare className="w-5 h-5 text-blue-600" />
                      )}
                      {comm.type === "CALL" && (
                        <CallIcon className="w-5 h-5 text-green-600" />
                      )}
                      {comm.type === "EMAIL" && (
                        <Mail className="w-5 h-5 text-orange-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900">
                        {comm.type === "NOTE" && "Note"}
                        {comm.type === "CALL" && "Call"}
                        {comm.type === "EMAIL" && "Email"}
                      </p>
                      <p className="text-sm text-slate-700 mt-1">{comm.message}</p>
                      <p className="text-xs text-slate-500 mt-2">
                        by {comm.user.name || "Unknown"} on {formatDate(comm.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Edit Lead</h2>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">First Name</label>
                  <input
                    type="text"
                    value={editFormData.firstName}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        firstName: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Last Name</label>
                  <input
                    type="text"
                    value={editFormData.lastName}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        lastName: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={editFormData.email}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        email: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <input
                    type="text"
                    value={editFormData.phone}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        phone: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Nationality</label>
                  <input
                    type="text"
                    value={editFormData.nationality}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        nationality: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Country of Residence</label>
                  <input
                    type="text"
                    value={editFormData.interestedCountry}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        interestedCountry: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Source</label>
                  <input
                    type="text"
                    value={editFormData.source}
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg bg-slate-100"
                    disabled
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        status: e.target.value,
                      })
                    }
                    className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value="NEW">New</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="QUALIFIED">Interested</option>
                    <option value="CONVERTED">Converted</option>
                    <option value="LOST">Lost</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  value={editFormData.notes}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      notes: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex gap-2 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-xl font-bold mb-2">Delete Lead?</h2>
            <p className="text-slate-600 mb-6">
              This action cannot be undone. Are you sure you want to delete {lead.firstName} {lead.lastName}?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteLead}
                disabled={deletingLead}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-slate-400"
              >
                {deletingLead && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert to Student Modal */}
      {showConvertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-xl font-bold mb-2">Convert to Student?</h2>
            <p className="text-slate-600 mb-6">
              You are about to convert <strong>{lead.firstName} {lead.lastName}</strong> into a student profile. This will create a new student account and send them a welcome email with a link to set their password.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConvertModal(false)}
                disabled={convertingToStudent}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertToStudent}
                disabled={convertingToStudent}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-slate-400"
              >
                {convertingToStudent && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                Convert to Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Call Modal */}
      <LogCallModal
        studentId={lead.id}
        studentName={`${lead.firstName} ${lead.lastName}`}
        isOpen={showLogCallModal}
        onClose={() => setShowLogCallModal(false)}
        entityType="lead"
      />

      <FollowUpModal
        entityType="lead"
        entityId={lead.id}
        entityName={`${lead.firstName} ${lead.lastName}`}
        isOpen={showFollowUpModal}
        onClose={() => setShowFollowUpModal(false)}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
