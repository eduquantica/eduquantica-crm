"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type InvitationData = {
  id: string;
  rsvpStatus: "PENDING" | "ATTENDING" | "NOT_ATTENDING" | "MAYBE";
  event: {
    title: string;
    description: string | null;
    eventDate: string;
    eventTime: string;
    location: string;
    isOnline: boolean;
    onlineLink: string | null;
  };
  studentName: string;
  studentEmail: string | null;
};

export default function PublicRsvpPage() {
  const params = useParams<{ invitationId: string }>();
  const searchParams = useSearchParams();
  const invitationId = params?.invitationId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [autoHandled, setAutoHandled] = useState(false);

  useEffect(() => {
    if (!invitationId) return;
    void loadInvitation(invitationId);
  }, [invitationId]);

  async function loadInvitation(id: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/events/rsvp/${id}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Unable to load invitation");
      setInvitation(json.data || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load invitation");
    } finally {
      setLoading(false);
    }
  }

  const submitRsvp = useCallback(async (status: "ATTENDING" | "NOT_ATTENDING") => {
    if (!invitationId) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/events/rsvp/${invitationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to submit RSVP");
      setSuccess(status === "ATTENDING" ? "Thank you for confirming. We look forward to seeing you." : "Your response has been recorded. Thank you.");
      setInvitation((current) => (current ? { ...current, rsvpStatus: status } : current));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit RSVP");
    } finally {
      setSubmitting(false);
    }
  }, [invitationId]);

  useEffect(() => {
    const choice = searchParams.get("choice");
    if (!invitationId || !choice || !invitation || autoHandled) return;
    if (choice === "ATTENDING" || choice === "NOT_ATTENDING") {
      setAutoHandled(true);
      void submitRsvp(choice);
    }
  }, [autoHandled, invitation, invitationId, searchParams, submitRsvp]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Event RSVP</h1>
        {loading ? <p className="mt-3 text-sm text-slate-600">Loading invitation...</p> : null}
        {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {!loading && invitation ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-md border bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-medium">Student:</span> {invitation.studentName}</p>
              <p><span className="font-medium">Email:</span> {invitation.studentEmail || "-"}</p>
              <p><span className="font-medium">Event:</span> {invitation.event.title}</p>
              <p><span className="font-medium">Date:</span> {new Date(invitation.event.eventDate).toLocaleDateString()}</p>
              <p><span className="font-medium">Time:</span> {invitation.event.eventTime}</p>
              <p><span className="font-medium">Location:</span> {invitation.event.isOnline ? invitation.event.onlineLink || "Online" : invitation.event.location}</p>
              {invitation.event.description ? <p className="mt-2"><span className="font-medium">About:</span> {invitation.event.description}</p> : null}
            </div>

            {success ? <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div> : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitRsvp("ATTENDING")}
                className="rounded-md bg-green-600 px-4 py-3 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                I Will Attend
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitRsvp("NOT_ATTENDING")}
                className="rounded-md bg-slate-700 px-4 py-3 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                I Cannot Attend
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
