"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

type VisaStatus = "PREPARING" | "SUBMITTED" | "APPROVED" | "REJECTED";

type ChecklistState = {
  passportValid: boolean;
  financialDocs: boolean;
  sopReady: boolean;
  englishTest: boolean;
  visaFormCompleted: boolean;
};

interface VisaDetailResponse {
  data: {
    visa: {
      id: string;
      applicationId: string;
      status: VisaStatus;
      country: string;
      type: string;
      notes: string | null;
      appointmentDate: string | null;
      appointmentLocation: string | null;
      appointmentRef: string | null;
      checklist: unknown;
      decisionAt: string | null;
      student: {
        id: string;
        firstName: string;
        lastName: string;
      };
      application: {
        id: string;
        counsellor: { id: string; name: string | null; email: string } | null;
        university: { id: string; name: string };
        course: { id: string; name: string };
      };
    };
    logs: Array<{
      id: string;
      action: string;
      details: string | null;
      createdAt: string;
      user: {
        id: string;
        name: string | null;
        email: string;
      };
    }>;
  };
}

interface VisaDetailClientProps {
  applicationId: string;
}

const STATUS_OPTIONS: VisaStatus[] = ["PREPARING", "SUBMITTED", "APPROVED", "REJECTED"];

const STATUS_LABELS: Record<VisaStatus, string> = {
  PREPARING: "Preparing",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const STATUS_BADGES: Record<VisaStatus, string> = {
  PREPARING: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
};

const defaultChecklist: ChecklistState = {
  passportValid: false,
  financialDocs: false,
  sopReady: false,
  englishTest: false,
  visaFormCompleted: false,
};

export default function VisaDetailClient({ applicationId }: VisaDetailClientProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["visa-detail", applicationId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/visa/${applicationId}`);
      if (!res.ok) {
        throw new Error("Failed to load visa details");
      }
      return (await res.json()) as VisaDetailResponse;
    },
  });

  const visa = data?.data.visa;
  const logs = data?.data.logs || [];

  const checklist = useMemo(() => {
    const raw = visa?.checklist;
    if (!raw || typeof raw !== "object") return defaultChecklist;

    const parsed = raw as Partial<ChecklistState>;
    return {
      passportValid: !!parsed.passportValid,
      financialDocs: !!parsed.financialDocs,
      sopReady: !!parsed.sopReady,
      englishTest: !!parsed.englishTest,
      visaFormCompleted: !!parsed.visaFormCompleted,
    };
  }, [visa?.checklist]);

  const [status, setStatus] = useState<VisaStatus>("PREPARING");
  const [statusNotes, setStatusNotes] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentLocation, setAppointmentLocation] = useState("");
  const [appointmentRef, setAppointmentRef] = useState("");

  useEffect(() => {
    if (!visa) return;
    setStatus(visa.status);
    setAppointmentLocation(visa.appointmentLocation || "");
    setAppointmentRef(visa.appointmentRef || "");

    if (visa.appointmentDate) {
      const date = new Date(visa.appointmentDate);
      const timezoneOffset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
      setAppointmentDate(localDate);
    } else {
      setAppointmentDate("");
    }
  }, [visa]);

  const patchMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/dashboard/visa/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to update visa");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["visa-detail", applicationId] });
      queryClient.invalidateQueries({ queryKey: ["visas"] });
    },
  });

  const saveStatus = async () => {
    try {
      await patchMutation.mutateAsync({ status, notes: statusNotes || undefined });
      toast.success("Visa status updated");
      setStatusNotes("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    }
  };

  const saveAppointment = async () => {
    try {
      await patchMutation.mutateAsync({
        appointmentDate: appointmentDate || undefined,
        appointmentLocation: appointmentLocation || undefined,
        appointmentRef: appointmentRef || undefined,
      });
      toast.success("Appointment updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update appointment");
    }
  };

  const saveChecklist = async (nextChecklist: ChecklistState) => {
    try {
      await patchMutation.mutateAsync({ checklist: nextChecklist });
      toast.success("Checklist updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update checklist");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading visa details...
      </div>
    );
  }

  if (!visa) {
    return <div className="p-6">Visa application not found.</div>;
  }

  const studentName = `${visa.student.firstName} ${visa.student.lastName}`;

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <Link href="/dashboard/visa" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
          <ArrowLeft className="h-4 w-4" />
          Back to Visa Tracking
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{studentName}</h1>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_BADGES[visa.status]}`}>
            {STATUS_LABELS[visa.status]}
          </span>
        </div>
        <p className="text-sm text-slate-600">
          {visa.application.university.name} • {visa.application.course.name} • {visa.country} • {visa.type}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Status Update</h2>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as VisaStatus)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {STATUS_LABELS[option]}
              </option>
            ))}
          </select>
          <textarea
            className="w-full border rounded-md px-3 py-2 text-sm"
            rows={3}
            placeholder="Optional notes"
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
          />
          <button
            onClick={saveStatus}
            disabled={patchMutation.isPending}
            className="px-3 py-2 text-sm rounded-md bg-slate-900 text-white disabled:opacity-50"
          >
            Save Status
          </button>
        </div>

        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Appointment Details</h2>
          <input
            type="datetime-local"
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={appointmentDate}
            onChange={(e) => setAppointmentDate(e.target.value)}
          />
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Location"
            value={appointmentLocation}
            onChange={(e) => setAppointmentLocation(e.target.value)}
          />
          <input
            className="w-full border rounded-md px-3 py-2 text-sm"
            placeholder="Reference number"
            value={appointmentRef}
            onChange={(e) => setAppointmentRef(e.target.value)}
          />
          <button
            onClick={saveAppointment}
            disabled={patchMutation.isPending}
            className="px-3 py-2 text-sm rounded-md bg-slate-900 text-white disabled:opacity-50"
          >
            Save Appointment
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Visa Checklist</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={checklist.passportValid}
              onChange={(e) => saveChecklist({ ...checklist, passportValid: e.target.checked })}
            />
            Passport valid
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={checklist.financialDocs}
              onChange={(e) => saveChecklist({ ...checklist, financialDocs: e.target.checked })}
            />
            Financial documents
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={checklist.sopReady}
              onChange={(e) => saveChecklist({ ...checklist, sopReady: e.target.checked })}
            />
            SOP ready
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={checklist.englishTest}
              onChange={(e) => saveChecklist({ ...checklist, englishTest: e.target.checked })}
            />
            English test
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={checklist.visaFormCompleted}
              onChange={(e) => saveChecklist({ ...checklist, visaFormCompleted: e.target.checked })}
            />
            Visa form completed
          </label>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Status Timeline</h2>

        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">No activity yet.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="border rounded-md p-3">
                <p className="text-sm font-medium text-slate-900">{log.action.replace(/_/g, " ")}</p>
                <p className="text-xs text-slate-500">
                  {new Date(log.createdAt).toLocaleString()} • {log.user.name || log.user.email}
                </p>
                {log.details && <p className="text-sm text-slate-600 mt-1">{log.details}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
