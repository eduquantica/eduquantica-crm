"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function AgentStudentCreateSuccessPage() {
  const params = useSearchParams();
  const studentId = params.get("studentId");

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900">Student Added</h1>
      <p className="text-sm text-slate-600 mt-2">
        The student has been created successfully and invited to set their password.
      </p>
      {studentId ? (
        <p className="text-sm text-slate-700 mt-3">
          Student ID: <span className="font-mono">{studentId}</span>
        </p>
      ) : null}

      <div className="mt-6 flex gap-3">
        <Link
          href="/agent/students"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to My Students
        </Link>
        {studentId ? (
          <Link
            href={`/agent/students/${studentId}`}
            className="rounded-md bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium"
          >
            Open Student Profile
          </Link>
        ) : null}
      </div>
    </div>
  );
}
