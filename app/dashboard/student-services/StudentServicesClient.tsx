"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

type AccommodationStatus = "NOT_ARRANGED" | "IN_PROGRESS" | "CONFIRMED";
type AirportStatus = "NOT_REQUIRED" | "ARRANGED" | "CONFIRMED";
type BriefingStatus = "NOT_SCHEDULED" | "SCHEDULED" | "COMPLETED";
type FeedbackStatus = "NOT_SENT" | "SENT" | "RECEIVED";

type ServiceListRow = {
  applicationId: string;
  studentId: string;
  studentName: string;
  university: string;
  course: string;
  enrolmentDate: string;
  accommodationStatus: AccommodationStatus;
  airportStatus: AirportStatus;
  briefingStatus: BriefingStatus;
  feedbackStatus: FeedbackStatus;
  counsellorName: string;
};

type ServiceDetailResponse = {
  data: {
    application: {
      id: string;
      status: string;
      student: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
      university: string;
      course: string;
      counsellor: { id: string; name: string | null; email: string } | null;
    };
    service: {
      id: string;
      accommodationStatus: AccommodationStatus;
      accommodationType: string | null;
      accommodationAddress: string | null;
      accommodationMoveInDate: string | null;
      accommodationNotes: string | null;
      airportRequired: boolean;
      airportStatus: AirportStatus;
      airportArrivalDateTime: string | null;
      airportFlightNumber: string | null;
      airportPickupArrangedBy: string | null;
      airportContactNumber: string | null;
      airportNotes: string | null;
      briefingStatus: BriefingStatus;
      briefingDateTime: string | null;
      briefingNotes: string | null;
      feedbackStatus: FeedbackStatus;
      feedbackOverallSatisfaction: number | null;
      feedbackCounsellorHelpfulness: number | null;
      feedbackApplicationProcess: number | null;
      feedbackWouldRecommend: boolean | null;
      feedbackComments: string | null;
    };
  };
};

const STATUS_STYLES: Record<string, string> = {
  NOT_ARRANGED: "bg-slate-100 text-slate-700",
  IN_PROGRESS: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-emerald-100 text-emerald-700",
  NOT_REQUIRED: "bg-slate-100 text-slate-700",
  ARRANGED: "bg-blue-100 text-blue-700",
  NOT_SCHEDULED: "bg-slate-100 text-slate-700",
  SCHEDULED: "bg-indigo-100 text-indigo-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  NOT_SENT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-100 text-blue-700",
  RECEIVED: "bg-emerald-100 text-emerald-700",
};

function StatusBadge({ value, label }: { value: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[value] || "bg-slate-100 text-slate-700",
      )}
    >
      {label}
    </span>
  );
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toDateLocal(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function StudentServicesClient() {
  const [rows, setRows] = useState<ServiceListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ServiceDetailResponse["data"] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchList();
  }, []);

  async function fetchList() {
    setLoading(true);
    const res = await fetch("/api/dashboard/student-services");
    const json = await res.json();
    if (res.ok) {
      setRows(json.data || []);
    }
    setLoading(false);
  }

  async function openDetail(applicationId: string) {
    setSelectedId(applicationId);
    setDetail(null);
    const res = await fetch(`/api/dashboard/student-services/${applicationId}`);
    const json = await res.json();
    if (res.ok) {
      setDetail(json.data);
    } else {
      toast.error(json.error || "Failed to load details");
    }
  }

  async function patchDetail(payload: Record<string, unknown>, successMessage: string) {
    if (!selectedId) return;
    setSaving(true);
    const res = await fetch(`/api/dashboard/student-services/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      toast.error(json.error || "Failed to save");
      return;
    }

    toast.success(successMessage);
    await openDetail(selectedId);
    await fetchList();
  }

  const feedbackSummary = useMemo(() => {
    if (!detail || detail.service.feedbackStatus !== "RECEIVED") return null;

    return [
      { label: "Overall satisfaction", value: detail.service.feedbackOverallSatisfaction },
      { label: "Counsellor helpfulness", value: detail.service.feedbackCounsellorHelpfulness },
      { label: "Application process", value: detail.service.feedbackApplicationProcess },
      {
        label: "Would recommend",
        value:
          detail.service.feedbackWouldRecommend === null
            ? null
            : detail.service.feedbackWouldRecommend
              ? "Yes"
              : "No",
      },
      { label: "Comments", value: detail.service.feedbackComments || "-" },
    ];
  }, [detail]);

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Student Services</h1>
        <p className="text-sm text-slate-600 mt-0.5">Post-enrolment tracking for enrolled students.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-600 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">University</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Enrolment Date</th>
                <th className="px-4 py-3">Accommodation</th>
                <th className="px-4 py-3">Airport Pickup</th>
                <th className="px-4 py-3">Pre-Departure Briefing</th>
                <th className="px-4 py-3">Feedback</th>
                <th className="px-4 py-3">Counsellor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.applicationId}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => openDetail(row.applicationId)}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/students/${row.studentId}`}
                      className="text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {row.studentName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.university}</td>
                  <td className="px-4 py-3">{row.course}</td>
                  <td className="px-4 py-3">{new Date(row.enrolmentDate).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={row.accommodationStatus} label={formatStatus(row.accommodationStatus)} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={row.airportStatus} label={formatStatus(row.airportStatus)} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={row.briefingStatus} label={formatStatus(row.briefingStatus)} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={row.feedbackStatus} label={formatStatus(row.feedbackStatus)} />
                  </td>
                  <td className="px-4 py-3">{row.counsellorName}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={9}>
                    No enrolled students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {selectedId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedId(null)} />
          <div className="relative h-full w-full max-w-2xl bg-white shadow-xl overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Student Service Detail</h2>
                {detail && (
                  <p className="text-sm text-slate-600 mt-1">
                    {detail.application.student.firstName} {detail.application.student.lastName} · {detail.application.university}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!detail ? (
              <div className="text-sm text-slate-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading details...
              </div>
            ) : (
              <>
                <section className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-slate-900">Accommodation</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <select
                      value={detail.service.accommodationStatus}
                      onChange={(e) =>
                        setDetail((prev) =>
                          prev
                            ? {
                                ...prev,
                                service: {
                                  ...prev.service,
                                  accommodationStatus: e.target.value as AccommodationStatus,
                                },
                              }
                            : prev,
                        )
                      }
                      className="border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="NOT_ARRANGED">Not Arranged</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="CONFIRMED">Confirmed</option>
                    </select>
                    <select
                      value={detail.service.accommodationType || ""}
                      onChange={(e) =>
                        setDetail((prev) =>
                          prev
                            ? {
                                ...prev,
                                service: {
                                  ...prev.service,
                                  accommodationType: e.target.value || null,
                                },
                              }
                            : prev,
                        )
                      }
                      className="border rounded-md px-3 py-2 text-sm"
                    >
                      <option value="">Type</option>
                      <option value="UNIVERSITY_HALLS">University Halls</option>
                      <option value="PRIVATE">Private</option>
                      <option value="HOMESTAY">Homestay</option>
                      <option value="OTHER">Other</option>
                    </select>
                    <input
                      placeholder="Address"
                      value={detail.service.accommodationAddress || ""}
                      onChange={(e) =>
                        setDetail((prev) =>
                          prev
                            ? {
                                ...prev,
                                service: { ...prev.service, accommodationAddress: e.target.value || null },
                              }
                            : prev,
                        )
                      }
                      className="border rounded-md px-3 py-2 text-sm sm:col-span-2"
                    />
                    <input
                      type="date"
                      value={toDateLocal(detail.service.accommodationMoveInDate)}
                      onChange={(e) =>
                        setDetail((prev) =>
                          prev
                            ? {
                                ...prev,
                                service: {
                                  ...prev.service,
                                  accommodationMoveInDate: e.target.value
                                    ? `${e.target.value}T00:00:00.000Z`
                                    : null,
                                },
                              }
                            : prev,
                        )
                      }
                      className="border rounded-md px-3 py-2 text-sm"
                    />
                    <textarea
                      placeholder="Notes"
                      rows={3}
                      value={detail.service.accommodationNotes || ""}
                      onChange={(e) =>
                        setDetail((prev) =>
                          prev
                            ? {
                                ...prev,
                                service: { ...prev.service, accommodationNotes: e.target.value || null },
                              }
                            : prev,
                        )
                      }
                      className="border rounded-md px-3 py-2 text-sm sm:col-span-2"
                    />
                  </div>
                  <button
                    disabled={saving}
                    onClick={() =>
                      patchDetail(
                        {
                          accommodationStatus: detail.service.accommodationStatus,
                          accommodationType: detail.service.accommodationType,
                          accommodationAddress: detail.service.accommodationAddress,
                          accommodationMoveInDate: detail.service.accommodationMoveInDate,
                          accommodationNotes: detail.service.accommodationNotes,
                        },
                        "Accommodation updated",
                      )
                    }
                    className="px-3 py-2 rounded-md bg-slate-900 text-white text-sm disabled:opacity-50"
                  >
                    Save
                  </button>
                </section>

                <section className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-slate-900">Airport Pickup</h3>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={detail.service.airportRequired}
                      onChange={(e) =>
                        setDetail((prev) =>
                          prev
                            ? {
                                ...prev,
                                service: {
                                  ...prev.service,
                                  airportRequired: e.target.checked,
                                  airportStatus: e.target.checked ? "ARRANGED" : "NOT_REQUIRED",
                                },
                              }
                            : prev,
                        )
                      }
                    />
                    Required
                  </label>

                  {detail.service.airportRequired && (
                    <div className="grid sm:grid-cols-2 gap-3">
                      <select
                        value={detail.service.airportStatus}
                        onChange={(e) =>
                          setDetail((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  service: {
                                    ...prev.service,
                                    airportStatus: e.target.value as AirportStatus,
                                  },
                                }
                              : prev,
                          )
                        }
                        className="border rounded-md px-3 py-2 text-sm"
                      >
                        <option value="ARRANGED">Arranged</option>
                        <option value="CONFIRMED">Confirmed</option>
                      </select>
                      <input
                        type="datetime-local"
                        value={toDatetimeLocal(detail.service.airportArrivalDateTime)}
                        onChange={(e) =>
                          setDetail((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  service: {
                                    ...prev.service,
                                    airportArrivalDateTime: e.target.value
                                      ? new Date(e.target.value).toISOString()
                                      : null,
                                  },
                                }
                              : prev,
                          )
                        }
                        className="border rounded-md px-3 py-2 text-sm"
                      />
                      <input
                        placeholder="Flight number"
                        value={detail.service.airportFlightNumber || ""}
                        onChange={(e) =>
                          setDetail((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  service: { ...prev.service, airportFlightNumber: e.target.value || null },
                                }
                              : prev,
                          )
                        }
                        className="border rounded-md px-3 py-2 text-sm"
                      />
                      <input
                        placeholder="Pickup arranged by"
                        value={detail.service.airportPickupArrangedBy || ""}
                        onChange={(e) =>
                          setDetail((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  service: { ...prev.service, airportPickupArrangedBy: e.target.value || null },
                                }
                              : prev,
                          )
                        }
                        className="border rounded-md px-3 py-2 text-sm"
                      />
                      <input
                        placeholder="Contact number"
                        value={detail.service.airportContactNumber || ""}
                        onChange={(e) =>
                          setDetail((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  service: { ...prev.service, airportContactNumber: e.target.value || null },
                                }
                              : prev,
                          )
                        }
                        className="border rounded-md px-3 py-2 text-sm"
                      />
                      <textarea
                        placeholder="Notes"
                        rows={3}
                        value={detail.service.airportNotes || ""}
                        onChange={(e) =>
                          setDetail((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  service: { ...prev.service, airportNotes: e.target.value || null },
                                }
                              : prev,
                          )
                        }
                        className="border rounded-md px-3 py-2 text-sm sm:col-span-2"
                      />
                    </div>
                  )}

                  <button
                    disabled={saving}
                    onClick={() =>
                      patchDetail(
                        {
                          airportRequired: detail.service.airportRequired,
                          airportStatus: detail.service.airportRequired
                            ? detail.service.airportStatus
                            : "NOT_REQUIRED",
                          airportArrivalDateTime: detail.service.airportArrivalDateTime,
                          airportFlightNumber: detail.service.airportFlightNumber,
                          airportPickupArrangedBy: detail.service.airportPickupArrangedBy,
                          airportContactNumber: detail.service.airportContactNumber,
                          airportNotes: detail.service.airportNotes,
                        },
                        "Airport pickup updated",
                      )
                    }
                    className="px-3 py-2 rounded-md bg-slate-900 text-white text-sm disabled:opacity-50"
                  >
                    Save
                  </button>
                </section>

                <section className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-slate-900">Pre-Departure Briefing</h3>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <input
                      type="datetime-local"
                      value={toDatetimeLocal(detail.service.briefingDateTime)}
                      onChange={(e) =>
                        setDetail((prev) =>
                          prev
                            ? {
                                ...prev,
                                service: {
                                  ...prev.service,
                                  briefingDateTime: e.target.value ? new Date(e.target.value).toISOString() : null,
                                },
                              }
                            : prev,
                        )
                      }
                      className="border rounded-md px-3 py-2 text-sm"
                    />
                    <button
                      disabled={saving}
                      onClick={() =>
                        patchDetail(
                          {
                            briefingDateTime: detail.service.briefingDateTime,
                            briefingStatus: "SCHEDULED",
                            briefingNotes: detail.service.briefingNotes,
                          },
                          "Briefing scheduled and invite sent",
                        )
                      }
                      className="px-3 py-2 rounded-md border border-slate-300 text-sm"
                    >
                      Schedule Briefing
                    </button>
                  </div>

                  {detail.service.briefingDateTime && (
                    <p className="text-sm text-slate-600">
                      Scheduled at: {new Date(detail.service.briefingDateTime).toLocaleString("en-GB")}
                    </p>
                  )}

                  <button
                    disabled={saving}
                    onClick={() =>
                      patchDetail(
                        { briefingStatus: "COMPLETED", briefingNotes: detail.service.briefingNotes },
                        "Briefing marked as completed",
                      )
                    }
                    className="px-3 py-2 rounded-md border border-slate-300 text-sm"
                  >
                    Mark as Completed
                  </button>

                  <textarea
                    placeholder="Briefing notes"
                    rows={3}
                    value={detail.service.briefingNotes || ""}
                    onChange={(e) =>
                      setDetail((prev) =>
                        prev
                          ? {
                              ...prev,
                              service: { ...prev.service, briefingNotes: e.target.value || null },
                            }
                          : prev,
                      )
                    }
                    className="border rounded-md px-3 py-2 text-sm w-full"
                  />
                </section>

                <section className="border border-slate-200 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-slate-900">Feedback</h3>

                  <button
                    disabled={saving}
                    onClick={() => patchDetail({ sendFeedbackForm: true }, "Feedback form sent")}
                    className="px-3 py-2 rounded-md border border-slate-300 text-sm"
                  >
                    Send Feedback Form
                  </button>

                  <StatusBadge
                    value={detail.service.feedbackStatus}
                    label={formatStatus(detail.service.feedbackStatus)}
                  />

                  {feedbackSummary && (
                    <div className="space-y-2 text-sm">
                      {feedbackSummary.map((item) => (
                        <div key={item.label} className="flex justify-between gap-4 border-b border-slate-100 pb-1">
                          <span className="text-slate-600">{item.label}</span>
                          <span className="font-medium text-slate-900">{String(item.value ?? "-")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
