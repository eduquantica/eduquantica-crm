"use client";

import { useState } from "react";
import Link from "next/link";
import ApplicationInterviewTracking from "@/components/ApplicationInterviewTracking";
import MockInterviewTab from "@/components/MockInterviewTab";

type ApplicationModel = {
  id: string;
  status: string;
  createdAt: Date;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  course: {
    name: string;
    university: {
      name: string;
      country: string;
    };
  };
};

export default function AgentApplicationDetailClient({ application }: { application: ApplicationModel }) {
  const [tab, setTab] = useState<"overview" | "interview-tracking" | "mock-interview">("overview");

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/agent/applications" className="text-xs text-blue-600 hover:underline">← Back to applications</Link>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{application.course.university.name} • {application.course.name}</h1>
            <p className="text-sm text-slate-600">{application.student.firstName} {application.student.lastName} • {application.student.email}</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{application.status.replaceAll("_", " ")}</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {[
            { key: "overview", label: "Overview" },
            { key: "interview-tracking", label: "Interview Tracking" },
            { key: "mock-interview", label: "Mock Interview" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key as "overview" | "interview-tracking" | "mock-interview")}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap ${
                tab === item.key ? "border-b-2 border-blue-600 text-blue-600" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "overview" && (
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Student</p><p className="mt-1 text-slate-900">{application.student.firstName} {application.student.lastName}</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">University</p><p className="mt-1 text-slate-900">{application.course.university.name}</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Course</p><p className="mt-1 text-slate-900">{application.course.name}</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-xs text-slate-500">Created</p><p className="mt-1 text-slate-900">{new Date(application.createdAt).toLocaleDateString("en-GB")}</p></div>
            </div>
          )}

          {tab === "interview-tracking" && <ApplicationInterviewTracking applicationId={application.id} roleName="SUB_AGENT" />}

          {tab === "mock-interview" && (
            <MockInterviewTab
              applicationId={application.id}
              listEndpoint={`/api/applications/${application.id}/mock-interviews`}
              canAssign
              scope="agent"
              assignButtonLabel="Assign Mock Interview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
