"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import AppModal from "@/components/ui/AppModal";

type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
type RsvpStatus = "PENDING" | "ATTENDING" | "NOT_ATTENDING" | "MAYBE";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  eventDate: string;
  eventTime: string;
  location: string;
  city: string;
  country: string;
  venueAddress: string | null;
  onlineLink: string | null;
  isOnline: boolean;
  targetCountry: string;
  status: EventStatus;
  maxAttendees: number | null;
  notes: string | null;
  _count: { invitations: number; attendees: number };
};

type EligibleStudent = {
  id: string;
  name: string;
  email: string;
  destination: string;
  visaStatus: string;
};

type RsvpRow = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  invitationSent: string | null;
  rsvpStatus: RsvpStatus;
  rsvpDate: string | null;
  attended: boolean;
};

type EventForm = {
  title: string;
  description: string;
  eventDate: string;
  eventTime: string;
  isOnline: boolean;
  location: string;
  city: string;
  country: string;
  venueAddress: string;
  onlineLink: string;
  targetCountry: string;
  maxAttendees: string;
  notes: string;
};

const statusBadge: Record<EventStatus, string> = {
  DRAFT: "bg-slate-200 text-slate-700",
  PUBLISHED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
  COMPLETED: "bg-blue-100 text-blue-700",
};

const emptyForm: EventForm = {
  title: "",
  description: "",
  eventDate: "",
  eventTime: "",
  isOnline: false,
  location: "",
  city: "",
  country: "",
  venueAddress: "",
  onlineLink: "",
  targetCountry: "",
  maxAttendees: "",
  notes: "",
};

export default function PreDepartureEventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [targetCountryFilter, setTargetCountryFilter] = useState("");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<EventRow | null>(null);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEvent, setInviteEvent] = useState<EventRow | null>(null);
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudent[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [sendProgress, setSendProgress] = useState({ sent: 0, total: 0 });

  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [rsvpRows, setRsvpRows] = useState<RsvpRow[]>([]);
  const [rsvpFilter, setRsvpFilter] = useState<"ALL" | "ATTENDING" | "NOT_ATTENDING" | "PENDING">("ALL");
  const [rsvpEvent, setRsvpEvent] = useState<EventRow | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (targetCountryFilter.trim()) params.set("targetCountry", targetCountryFilter.trim());
      const query = params.toString();
      const response = await fetch(`/api/admin/events${query ? `?${query}` : ""}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to load events");
      setEvents(json.data || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, targetCountryFilter]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  function openCreate() {
    setEditingEvent(null);
    setForm(emptyForm);
    setCreateOpen(true);
  }

  function openEdit(event: EventRow) {
    setEditingEvent(event);
    setForm({
      title: event.title,
      description: event.description || "",
      eventDate: event.eventDate.slice(0, 10),
      eventTime: event.eventTime,
      isOnline: event.isOnline,
      location: event.location,
      city: event.city,
      country: event.country,
      venueAddress: event.venueAddress || "",
      onlineLink: event.onlineLink || "",
      targetCountry: event.targetCountry,
      maxAttendees: event.maxAttendees == null ? "" : String(event.maxAttendees),
      notes: event.notes || "",
    });
    setCreateOpen(true);
  }

  async function submitEvent(status: EventStatus) {
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        eventDate: form.eventDate,
        eventTime: form.eventTime,
        isOnline: form.isOnline,
        location: form.isOnline ? (form.onlineLink || "Online") : form.location,
        city: form.city || "-",
        country: form.country || "-",
        venueAddress: form.isOnline ? null : form.venueAddress || null,
        onlineLink: form.isOnline ? form.onlineLink || null : null,
        targetCountry: form.targetCountry,
        maxAttendees: form.maxAttendees ? Number(form.maxAttendees) : null,
        notes: form.notes || null,
        status,
      };
      const response = await fetch(
        editingEvent ? `/api/admin/events/${editingEvent.id}` : "/api/admin/events",
        {
          method: editingEvent ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to save event");
      toast.success(editingEvent ? "Event updated" : "Event created");
      setCreateOpen(false);
      await fetchEvents();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save event";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function cancelEvent(event: EventRow) {
    if (!window.confirm(`Cancel ${event.title}?`)) return;
    const response = await fetch(`/api/admin/events/${event.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    const json = await response.json();
    if (!response.ok) {
      toast.error(json.error || "Failed to cancel event");
      return;
    }
    toast.success("Event cancelled");
    await fetchEvents();
  }

  async function openInviteModal(event: EventRow) {
    setInviteEvent(event);
    setInviteOpen(true);
    setSelectedStudentIds([]);
    setEligibleStudents([]);
    const response = await fetch(`/api/admin/events/${event.id}`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) {
      toast.error(json.error || "Failed to load invite list");
      return;
    }
    setEligibleStudents(json.data?.eligibleStudents || []);
  }

  async function sendInvitations() {
    if (!inviteEvent || !selectedStudentIds.length) return;
    setSendingInvites(true);
    setSendProgress({ sent: 0, total: selectedStudentIds.length });
    try {
      const response = await fetch(`/api/admin/events/${inviteEvent.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: selectedStudentIds }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to send invitations");
      setSendProgress({ sent: selectedStudentIds.length, total: selectedStudentIds.length });
      toast.success(`Invitations sent: ${json.data?.sent ?? 0}`);
      setInviteOpen(false);
      await fetchEvents();
    } catch (sendError) {
      toast.error(sendError instanceof Error ? sendError.message : "Failed to send invitations");
    } finally {
      setSendingInvites(false);
    }
  }

  async function openRsvpModal(event: EventRow) {
    setRsvpEvent(event);
    setRsvpOpen(true);
    const response = await fetch(`/api/admin/events/${event.id}/rsvp`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok) {
      toast.error(json.error || "Failed to load RSVPs");
      return;
    }
    setRsvpRows(json.data || []);
  }

  async function markAttended(studentId: string) {
    if (!rsvpEvent) return;
    const response = await fetch(`/api/admin/events/${rsvpEvent.id}/rsvp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    const json = await response.json();
    if (!response.ok) {
      toast.error(json.error || "Failed to mark attended");
      return;
    }
    toast.success("Marked as attended");
    await openRsvpModal(rsvpEvent);
  }

  const filteredRsvps = useMemo(() => {
    if (rsvpFilter === "ALL") return rsvpRows;
    return rsvpRows.filter((item) => item.rsvpStatus === rsvpFilter);
  }, [rsvpFilter, rsvpRows]);

  function exportAttendeesCsv() {
    const rows = rsvpRows.filter((item) => item.rsvpStatus === "ATTENDING");
    const csv = [["Name", "Email", "RSVP Date"], ...rows.map((item) => [item.studentName, item.studentEmail || "", item.rsvpDate || ""])]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `event-attendees-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const calendarCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const key = date.toISOString().slice(0, 10);
      const items = events.filter((event) => event.eventDate.slice(0, 10) === key);
      return { date, items, inMonth: date.getMonth() === month.getMonth() };
    });
  }, [events, month]);

  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Pre-Departure Events</h1>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-1">
            <button type="button" onClick={() => setView("list")} className={`rounded px-3 py-1.5 text-sm ${view === "list" ? "bg-blue-600 text-white" : "text-slate-700"}`}>List View</button>
            <button type="button" onClick={() => setView("calendar")} className={`rounded px-3 py-1.5 text-sm ${view === "calendar" ? "bg-blue-600 text-white" : "text-slate-700"}`}>Calendar View</button>
          </div>
          <button type="button" onClick={openCreate} className="rounded-md bg-[#F5A623] px-4 py-2 text-sm font-medium text-white hover:bg-[#e39a14]">Create Event</button>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border bg-slate-50 p-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full rounded-md border px-3 py-2">
            <option value="ALL">All</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Target Country</span>
          <input value={targetCountryFilter} onChange={(event) => setTargetCountryFilter(event.target.value)} className="w-full rounded-md border px-3 py-2" placeholder="Filter by target country" />
        </label>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {view === "list" ? (
        loading ? (
          <p className="text-sm text-slate-600">Loading events...</p>
        ) : events.length === 0 ? (
          <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-slate-600">No pre-departure events found.</div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  {["Title", "Date", "Time", "Location", "Target Country", "Invitations", "Attendees", "Status", "Actions"].map((label) => (
                    <th key={label} className="px-4 py-3 font-medium">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{event.title}</td>
                    <td className="px-4 py-3">{new Date(event.eventDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{event.eventTime}</td>
                    <td className="px-4 py-3">{event.location}</td>
                    <td className="px-4 py-3">{event.targetCountry}</td>
                    <td className="px-4 py-3">{event._count.invitations}</td>
                    <td className="px-4 py-3">{event._count.attendees}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadge[event.status]}`}>{event.status}</span></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openEdit(event)} className="rounded-md border px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Edit</button>
                        <button type="button" onClick={() => void openInviteModal(event)} className="rounded-md border px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Invite Students</button>
                        <button type="button" onClick={() => void openRsvpModal(event)} className="rounded-md border px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">View RSVPs</button>
                        <button
                          type="button"
                          onClick={() => {
                            setDetailEvent(event);
                            setDetailOpen(true);
                          }}
                          className="rounded-md border px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Details
                        </button>
                        <button type="button" onClick={() => void cancelEvent(event)} className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50">Cancel</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="space-y-3 rounded-md border p-4">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50">Previous</button>
            <p className="text-sm font-semibold">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
            <button type="button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50">Next</button>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-1">{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((cell) => (
              <div key={cell.date.toISOString()} className={`min-h-24 rounded-md border p-2 ${cell.inMonth ? "bg-white" : "bg-slate-50 text-slate-400"}`}>
                <p className="text-xs font-medium">{cell.date.getDate()}</p>
                <div className="mt-1 space-y-1">
                  {cell.items.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => {
                        setDetailEvent(event);
                        setDetailOpen(true);
                      }}
                      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-xs ${statusBadge[event.status]}`}
                    >
                      {event.title}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {createOpen ? (
        <AppModal maxWidthClass="max-w-3xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{editingEvent ? "Edit Event" : "Create Event"}</h3>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm md:col-span-2"><span>Event title</span><input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm md:col-span-2"><span>Description</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="min-h-20 w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Event date</span><input required type="date" value={form.eventDate} onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Event time</span><input required type="time" value={form.eventTime} onChange={(event) => setForm((current) => ({ ...current, eventTime: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <div className="space-y-2 text-sm md:col-span-2">
                <p>Location type</p>
                <label className="mr-4 inline-flex items-center gap-2"><input type="radio" checked={!form.isOnline} onChange={() => setForm((current) => ({ ...current, isOnline: false }))} />In Person</label>
                <label className="inline-flex items-center gap-2"><input type="radio" checked={form.isOnline} onChange={() => setForm((current) => ({ ...current, isOnline: true }))} />Online</label>
              </div>
              {form.isOnline ? (
                <label className="space-y-1 text-sm md:col-span-2"><span>Meeting link</span><input value={form.onlineLink} onChange={(event) => setForm((current) => ({ ...current, onlineLink: event.target.value, location: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              ) : (
                <>
                  <label className="space-y-1 text-sm"><span>Venue name</span><input value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Address</span><input value={form.venueAddress} onChange={(event) => setForm((current) => ({ ...current, venueAddress: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>City</span><input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                  <label className="space-y-1 text-sm"><span>Country</span><input value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
                </>
              )}
              <label className="space-y-1 text-sm"><span>Target destination country</span><input value={form.targetCountry} onChange={(event) => setForm((current) => ({ ...current, targetCountry: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm"><span>Maximum attendees</span><input type="number" min="1" value={form.maxAttendees} onChange={(event) => setForm((current) => ({ ...current, maxAttendees: event.target.value }))} className="w-full rounded-md border px-3 py-2" /></label>
              <label className="space-y-1 text-sm md:col-span-2"><span>Notes</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-20 w-full rounded-md border px-3 py-2" /></label>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
              <button type="button" disabled={saving} onClick={() => void submitEvent("DRAFT")} className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">Save as Draft</button>
              <button type="button" disabled={saving} onClick={() => void submitEvent("PUBLISHED")} className="rounded-md bg-[#F5A623] px-4 py-2 text-sm font-medium text-white hover:bg-[#e39a14] disabled:opacity-60">Publish</button>
            </div>
          </div>
        </AppModal>
      ) : null}

      {inviteOpen && inviteEvent ? (
        <AppModal maxWidthClass="max-w-3xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Invite Students - {inviteEvent.title}</h3>
              <button type="button" onClick={() => setInviteOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>
            {eligibleStudents.length === 0 ? (
              <div className="rounded-md border border-dashed px-4 py-8 text-center text-sm text-slate-600">No eligible students found.</div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium"><input type="checkbox" checked={selectedStudentIds.length === eligibleStudents.length && eligibleStudents.length > 0} onChange={(event) => setSelectedStudentIds(event.target.checked ? eligibleStudents.map((student) => student.id) : [])} /></th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Destination</th>
                      <th className="px-4 py-3 font-medium">Visa Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {eligibleStudents.map((student) => (
                      <tr key={student.id}>
                        <td className="px-4 py-3"><input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={(event) => setSelectedStudentIds((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} /></td>
                        <td className="px-4 py-3">{student.name}</td>
                        <td className="px-4 py-3">{student.email}</td>
                        <td className="px-4 py-3">{student.destination}</td>
                        <td className="px-4 py-3">{student.visaStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {sendingInvites ? <p className="text-sm text-slate-600">Sending {sendProgress.sent} of {sendProgress.total} invitations...</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setInviteOpen(false)} className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
              <button type="button" disabled={sendingInvites || selectedStudentIds.length === 0} onClick={() => void sendInvitations()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">Send Invitations</button>
            </div>
          </div>
        </AppModal>
      ) : null}

      {rsvpOpen && rsvpEvent ? (
        <AppModal maxWidthClass="max-w-4xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">RSVPs - {rsvpEvent.title}</h3>
              <button type="button" onClick={() => setRsvpOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-md border p-1">
                {(["ALL", "ATTENDING", "NOT_ATTENDING", "PENDING"] as const).map((tab) => (
                  <button key={tab} type="button" onClick={() => setRsvpFilter(tab)} className={`rounded px-3 py-1.5 text-sm ${rsvpFilter === tab ? "bg-blue-600 text-white" : "text-slate-700"}`}>{tab === "NOT_ATTENDING" ? "Not Attending" : tab[0] + tab.slice(1).toLowerCase()}</button>
                ))}
              </div>
              <button type="button" onClick={exportAttendeesCsv} className="rounded-md border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Export Attendees</button>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    {["Name", "Email", "Invitation Sent", "RSVP Status", "RSVP Date", "Actions"].map((label) => (
                      <th key={label} className="px-4 py-3 font-medium">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredRsvps.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{row.studentName}</td>
                      <td className="px-4 py-3">{row.studentEmail || "-"}</td>
                      <td className="px-4 py-3">{row.invitationSent ? new Date(row.invitationSent).toLocaleString() : "-"}</td>
                      <td className="px-4 py-3">{row.rsvpStatus}</td>
                      <td className="px-4 py-3">{row.rsvpDate ? new Date(row.rsvpDate).toLocaleString() : "-"}</td>
                      <td className="px-4 py-3">
                        {new Date(rsvpEvent.eventDate) < new Date() && row.rsvpStatus === "ATTENDING" && !row.attended ? (
                          <button type="button" onClick={() => void markAttended(row.studentId)} className="rounded-md border px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Mark as Attended</button>
                        ) : (
                          <span className="text-xs text-slate-500">{row.attended ? "Attended" : "-"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </AppModal>
      ) : null}

      {detailOpen && detailEvent ? (
        <AppModal maxWidthClass="max-w-2xl">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{detailEvent.title}</h3>
              <button type="button" onClick={() => setDetailOpen(false)} className="text-sm text-slate-500 hover:text-slate-700">Close</button>
            </div>
            <div className="grid gap-3 rounded-md border bg-slate-50 p-3 text-sm md:grid-cols-2">
              <p><span className="font-medium">Date:</span> {new Date(detailEvent.eventDate).toLocaleDateString()}</p>
              <p><span className="font-medium">Time:</span> {detailEvent.eventTime}</p>
              <p><span className="font-medium">Location:</span> {detailEvent.location}</p>
              <p><span className="font-medium">Target Country:</span> {detailEvent.targetCountry}</p>
              <p className="md:col-span-2"><span className="font-medium">Description:</span> {detailEvent.description || "-"}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDetailOpen(false)} className="rounded-md border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
              <button
                type="button"
                onClick={() => {
                  setDetailOpen(false);
                  openEdit(detailEvent);
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Edit
              </button>
            </div>
          </div>
        </AppModal>
      ) : null}
    </main>
  );
}
