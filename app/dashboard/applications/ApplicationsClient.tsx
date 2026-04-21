"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Plus,
  Download,
  LayoutGrid,
  List,
  Search,
  Filter,
} from "lucide-react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

interface Application {
  id: string;
  studentId: string;
  student: {
    firstName: string;
    lastName: string;
    subAgentId?: string;
    subAgent?: { agencyName: string };
    assignedCounsellorId?: string;
  };
  course: {
    name: string;
    intakeDatesWithDeadlines?: Array<{ date?: string; deadline?: string }>;
    university: {
      name: string;
    };
  };
  counsellor?: { name?: string };
  status:
    | "APPLIED"
    | "DOCUMENTS_PENDING"
    | "DOCUMENTS_SUBMITTED"
    | "SUBMITTED_TO_UNIVERSITY"
    | "CONDITIONAL_OFFER"
    | "UNCONDITIONAL_OFFER"
    | "FINANCE_IN_PROGRESS"
    | "DEPOSIT_PAID"
    | "FINANCE_COMPLETE"
    | "CAS_ISSUED"
    | "VISA_APPLIED"
    | "ENROLLED"
    | "WITHDRAWN";
  visaSubStatus?: "VISA_PENDING" | "VISA_APPROVED" | "VISA_REJECTED" | null;
  createdAt: string;
  nextIntake?: string;
  hasImmigrationUpdate?: boolean;
  fee?: {
    feeRequired: boolean;
    displayStatus: "UNPAID" | "PENDING_APPROVAL" | "PAID" | "WAIVED" | "NOT_REQUIRED";
  };
}

interface StatusColumn {
  id: string;
  label: string;
  statuses: string[];
}

interface Swimlane {
  id: string;
  label: string;
  headerClass: string;
  columns: StatusColumn[];
}

const SWIMLANES: Swimlane[] = [
  {
    id: "pre-submission",
    label: "Swimlane 1 - Pre-Submission",
    headerClass: "bg-blue-100 text-blue-800",
    columns: [
      { id: "applied", label: "Applied", statuses: ["APPLIED"] },
      { id: "documents-pending", label: "Documents Pending", statuses: ["DOCUMENTS_PENDING"] },
      { id: "documents-submitted", label: "Documents Submitted", statuses: ["DOCUMENTS_SUBMITTED"] },
    ],
  },
  {
    id: "uni-review",
    label: "Swimlane 2 - University Review",
    headerClass: "bg-purple-100 text-purple-800",
    columns: [
      { id: "submitted-to-university", label: "Submitted to University", statuses: ["SUBMITTED_TO_UNIVERSITY"] },
      { id: "conditional-offer", label: "Conditional Offer", statuses: ["CONDITIONAL_OFFER"] },
      { id: "unconditional-offer", label: "Unconditional Offer", statuses: ["UNCONDITIONAL_OFFER"] },
    ],
  },
  {
    id: "finance-cas",
    label: "Swimlane 3 - Finance and CAS",
    headerClass: "bg-green-100 text-green-800",
    columns: [
      { id: "finance-in-progress", label: "Finance In Progress", statuses: ["FINANCE_IN_PROGRESS"] },
      { id: "deposit-paid", label: "Deposit Paid", statuses: ["DEPOSIT_PAID"] },
      { id: "finance-complete", label: "Finance Complete", statuses: ["FINANCE_COMPLETE"] },
      { id: "cas-issued", label: "CAS Issued", statuses: ["CAS_ISSUED"] },
    ],
  },
  {
    id: "visa",
    label: "Swimlane 4 - Visa",
    headerClass: "bg-orange-100 text-orange-800",
    columns: [{ id: "visa-applied", label: "Visa Applied", statuses: ["VISA_APPLIED"] }],
  },
  {
    id: "completed",
    label: "Swimlane 5 - Completed",
    headerClass: "bg-green-100 text-green-800",
    columns: [{ id: "enrolled", label: "Enrolled", statuses: ["ENROLLED"] }],
  },
  {
    id: "closed",
    label: "Swimlane 6 - Closed",
    headerClass: "bg-slate-200 text-slate-700",
    columns: [{ id: "withdrawn", label: "Withdrawn", statuses: ["WITHDRAWN"] }],
  },
];

// list of all possible application statuses for bulk dropdowns
const ALL_STATUSES = [
  "APPLIED",
  "DOCUMENTS_PENDING",
  "DOCUMENTS_SUBMITTED",
  "SUBMITTED_TO_UNIVERSITY",
  "CONDITIONAL_OFFER",
  "UNCONDITIONAL_OFFER",
  "FINANCE_IN_PROGRESS",
  "DEPOSIT_PAID",
  "FINANCE_COMPLETE",
  "CAS_ISSUED",
  "VISA_APPLIED",
  "ENROLLED",
  "WITHDRAWN",
] as const;

import templates from "@/lib/email-templates"; // for dropdown options



const STATUS_COLORS: Record<string, string> = {
  APPLIED: "bg-gray-100 text-gray-800",
  DOCUMENTS_PENDING: "bg-orange-100 text-orange-800",
  DOCUMENTS_SUBMITTED: "bg-blue-100 text-blue-800",
  SUBMITTED_TO_UNIVERSITY: "bg-indigo-100 text-indigo-800",
  CONDITIONAL_OFFER: "bg-yellow-100 text-yellow-800",
  UNCONDITIONAL_OFFER: "bg-green-100 text-green-800",
  FINANCE_IN_PROGRESS: "bg-cyan-100 text-cyan-800",
  DEPOSIT_PAID: "bg-teal-100 text-teal-800",
  FINANCE_COMPLETE: "bg-emerald-100 text-emerald-800",
  CAS_ISSUED: "bg-indigo-100 text-indigo-800",
  VISA_APPLIED: "bg-purple-100 text-purple-800",
  ENROLLED: "bg-teal-100 text-teal-800",
  WITHDRAWN: "bg-slate-200 text-slate-700",
};

function feeStatusClass(status: "UNPAID" | "PENDING_APPROVAL" | "PAID" | "WAIVED" | "NOT_REQUIRED") {
  if (status === "UNPAID") return "bg-rose-100 text-rose-700";
  if (status === "PENDING_APPROVAL") return "bg-amber-100 text-amber-700";
  if (status === "PAID") return "bg-emerald-100 text-emerald-700";
  if (status === "WAIVED") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

export default function ApplicationsClient() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const [showFilters, setShowFilters] = useState(false);

  // selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkEmail, setBulkEmail] = useState<string>("");

  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const subAgentId = searchParams.get("subAgentId");
    if (!subAgentId) return;
    setFilters((prev) => ({ ...prev, subAgentId }));
  }, [searchParams]);

  // Fetch applications
  const { data: applicationsResponse, isLoading } = useQuery({
    queryKey: [
      "applications",
      searchQuery,
      JSON.stringify(filters),
      view,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      Object.entries(filters).forEach(([key, value]) => {
        // In kanban view, skip status filter – apply it client-side for visual dimming
        if (key === "status" && view === "kanban") return;
        if (value) params.append(key, value);
      });

      const res = await fetch(`/api/dashboard/applications?${params}`);
      if (!res.ok) throw new Error("Failed to fetch applications");
      return res.json();
    },
  });

  const applications = (applicationsResponse?.data || []) as Application[];
  const feeActionRequiredCount = applications.filter(
    (app) => app.fee?.feeRequired && (app.fee.displayStatus === "UNPAID" || app.fee.displayStatus === "PENDING_APPROVAL"),
  ).length;
  const feePaidOrWaivedCount = applications.filter(
    (app) => app.fee?.feeRequired && (app.fee.displayStatus === "PAID" || app.fee.displayStatus === "WAIVED"),
  ).length;
  const inProgressCount = applications.filter((app) => app.status !== "ENROLLED" && app.status !== "WITHDRAWN").length;
  const completedCount = applications.filter((app) => app.status === "ENROLLED").length;
  const swimlaneSummaries = SWIMLANES.map((swimlane) => ({
    id: swimlane.id,
    label: swimlane.label,
    count: applications.filter((app) => swimlane.columns.some((col) => col.statuses.includes(app.status))).length,
  }));

  const allSelected =
    applications.length > 0 &&
    applications.every((a) => selectedIds.has(a.id));

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      applicationId,
      newStatus,
    }: {
      applicationId: string;
      newStatus: string;
    }) => {
      const res = await fetch(
        `/api/dashboard/applications/${applicationId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (!res.ok) {
        let message = "Failed to update status";
        try {
          const body = await res.json();
          if (typeof body?.error === "string") message = body.error;
          else if (Array.isArray(body?.error)) message = body.error.map((e: { message?: string }) => e.message).join(", ");
        } catch {
          // ignore parse error
        }
        throw new Error(message);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.success("Application status updated");
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    updateStatusMutation.mutate({
      applicationId: draggableId,
      newStatus: destination.droppableId,
    });
  };



  const exportCSV = () => {
    if (applications.length === 0) return;

    const headers = [
      "Application ID",
      "Student Name",
      "University",
      "Course",
      "Intake",
      "Status",
      "Counsellor",
      "Sub-Agent",
      "Date Created",
    ];

    const rows = applications.map((app) => [
      app.id,
      `${app.student.firstName} ${app.student.lastName}`,
      app.course.university.name,
      app.course.name,
      app.nextIntake || "-",
      app.status,
      app.counsellor?.name || "-",
      app.student.subAgent?.agencyName || "-",
      new Date(app.createdAt).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `applications-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="mb-4">Loading applications...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-6 border-b bg-white">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Applications</h1>
            <p className="text-gray-500 mt-1">
              Manage all student applications
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push("/dashboard/applications/new")}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              Create Application
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <div className="flex border border-gray-300 rounded-lg">
              <button
                onClick={() => setView("kanban")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 transition",
                  view === "kanban"
                    ? "bg-gray-200 text-gray-900"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                Kanban
              </button>
              <button
                onClick={() => setView("table")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 transition border-l",
                  view === "table"
                    ? "bg-gray-200 text-gray-900"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <List className="w-4 h-4" />
                Table
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by student name, university, or application ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg border transition",
              showFilters
                ? "bg-blue-50 border-blue-300 text-blue-700"
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Filter Row */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <select
                value={filters.status || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    status: e.target.value || undefined,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Statuses</option>
                {ALL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                value={filters.counsellorId || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    counsellorId: e.target.value || undefined,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Counsellors</option>
                {/* Populate from data */}
              </select>

              <select
                value={filters.subAgentId || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    subAgentId: e.target.value || undefined,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Sub-Agents</option>
                {/* Populate from data */}
              </select>

              <input
                type="month"
                value={filters.intakeMonth || ""}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    intakeMonth: e.target.value || undefined,
                  })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />

              <button
                onClick={() => setFilters({})}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300 transition"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
            <p className="text-xs font-medium uppercase text-rose-700">Needs Fee Action</p>
            <p className="mt-1 text-2xl font-semibold text-rose-800">{feeActionRequiredCount}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-xs font-medium uppercase text-blue-700">In Progress</p>
            <p className="mt-1 text-2xl font-semibold text-blue-800">{inProgressCount}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium uppercase text-emerald-700">Completed</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-800">{completedCount}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilters((prev) => ({ ...prev, status: undefined }))}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            All ({applications.length})
          </button>
          <button
            onClick={() => setFilters((prev) => ({ ...prev, status: "APPLIED" }))}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Applied
          </button>
          <button
            onClick={() => setFilters((prev) => ({ ...prev, status: "VISA_APPLIED" }))}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Visa Stage
          </button>
          <button
            onClick={() => setFilters((prev) => ({ ...prev, status: "ENROLLED" }))}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            Enrolled
          </button>
          <span className="ml-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            Fee Cleared: {feePaidOrWaivedCount}
          </span>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          {swimlaneSummaries.map((lane) => (
            <div key={lane.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-medium uppercase text-slate-500">{lane.label.replace("Swimlane ", "")}</p>
              <p className="mt-1 text-lg font-semibold text-slate-800">{lane.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {view === "kanban" ? (
          <KanbanView
            swimlanes={SWIMLANES}
            applications={applications}
            onDragEnd={handleDragEnd}
            statusFilter={filters.status}
          />
        ) : (
          <>
            {selectedIds.size > 0 && (
              <div className="p-4 bg-yellow-50 border-b border-yellow-200 flex items-center justify-between">
                <div className="text-sm">
                  {selectedIds.size} application{selectedIds.size > 1 ? "s" : ""} selected
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Change status…</option>
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      if (!bulkStatus) return;
                      if (
                        !window.confirm(
                          `Change status of ${selectedIds.size} applications to ${bulkStatus}?`
                        )
                      )
                        return;
                      await fetch("/api/dashboard/applications/bulk", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          ids: Array.from(selectedIds),
                          status: bulkStatus,
                        }),
                      });
                      queryClient.invalidateQueries({ queryKey: ["applications"] });
                      setSelectedIds(new Set());
                      setBulkStatus("");
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
                  >
                    Apply to Selected
                  </button>
                  <select
                    value={bulkEmail}
                    onChange={(e) => setBulkEmail(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    <option value="">Send email…</option>
                    {Object.keys(templates).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={async () => {
                      if (!bulkEmail) return;
                      if (
                        !window.confirm(
                          `Send "${bulkEmail}" email to ${selectedIds.size} applications?`
                        )
                      )
                        return;
                      await fetch("/api/dashboard/applications/bulk", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          ids: Array.from(selectedIds),
                          emailTemplate: bulkEmail,
                        }),
                      });
                      setSelectedIds(new Set());
                      setBulkEmail("");
                    }}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition"
                  >
                    Send Email
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <TableView
              applications={applications}
              selectedIds={selectedIds}
              toggleSelect={(id) => {
                const copy = new Set(selectedIds);
                if (copy.has(id)) copy.delete(id);
                else copy.add(id);
                setSelectedIds(copy);
              }}
              allSelected={allSelected}
              toggleSelectAll={() => {
                if (allSelected) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(applications.map((a) => a.id)));
                }
              }}
              onStatusChange={(id, status) => updateStatusMutation.mutate({ applicationId: id, newStatus: status })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function KanbanView({
  swimlanes,
  applications,
  onDragEnd,
  statusFilter,
}: {
  swimlanes: Swimlane[];
  applications: Application[];
  onDragEnd: (result: DropResult) => void;
  statusFilter?: string;
}) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {statusFilter && (
        <div className="mx-6 mt-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">
          Filtering by status: <strong>{statusFilter.replace(/_/g, " ")}</strong> — non-matching cards are dimmed. All applications shown for drag-and-drop.
        </div>
      )}
      <div className="space-y-6 p-6">
      {swimlanes.map((swimlane) => {
        return (
          <div key={swimlane.id} className="space-y-3">
            <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${swimlane.headerClass}`}>
              {swimlane.label}
            </div>

            <div className="flex gap-6 overflow-x-auto">
              {swimlane.columns.map((column) => {
                const columnApps = applications.filter((app) => column.statuses.includes(app.status));

                return (
                  <div
                    key={column.id}
                    className="flex-shrink-0 w-80 flex flex-col bg-gray-100 rounded-lg overflow-hidden"
                  >
                    <div className="p-4 bg-gray-200 border-b border-gray-300">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900">{column.label}</h3>
                        <span className="px-2.5 py-0.5 bg-gray-300 text-gray-800 text-sm font-medium rounded-full">
                          {columnApps.length}
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex-1 p-4 space-y-3 overflow-y-auto"
                    >
                      <Droppable droppableId={column.statuses[0]}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn("min-h-12 space-y-3 rounded", snapshot.isDraggingOver && "bg-blue-50")}
                          >
                            {columnApps.length === 0 && <div className="text-center py-8 text-gray-500">No applications</div>}
                            {columnApps.map((app, index) => (
                              <ApplicationCard
                                key={app.id}
                                application={app}
                                index={index}
                                dimmed={!!statusFilter && app.status !== statusFilter}
                              />
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      </div>
    </DragDropContext>
  );
}

function ApplicationCard({
  application,
  index,
  dimmed,
}: {
  application: Application;
  index: number;
  dimmed?: boolean;
}) {
  return (
    <Draggable draggableId={application.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "p-4 bg-white rounded-lg border-2 cursor-move transition",
            dimmed && "opacity-40",
            snapshot.isDragging
              ? "opacity-70 border-blue-400 shadow-lg"
              : "border-gray-200 hover:border-gray-300 hover:shadow-md"
          )}
        >
      <div className="space-y-2">
        <div className="font-semibold text-gray-900 text-sm">
          {application.student.firstName} {application.student.lastName}
        </div>

        <div className="text-sm text-gray-600">
          <div>{application.course.university.name}</div>
          <div className="text-xs text-gray-500 mt-1">
            {application.course.name}
          </div>
        </div>

        {application.nextIntake && (
          <div className="text-xs text-gray-500">
            Intake: {application.nextIntake}
          </div>
        )}

        {application.student.subAgentId && (
          <div className="mt-2 inline-block">
            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
              {application.student.subAgent?.agencyName || "Sub-Agent"}
            </span>
          </div>
        )}

        {application.hasImmigrationUpdate && (
          <div className="mt-2">
            <span className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded">
              Financial requirements updated - re-review
            </span>
          </div>
        )}

        {application.fee?.feeRequired && (
          <div className="mt-2">
            <span
              className={cn("px-2 py-1 text-xs font-medium rounded", feeStatusClass(application.fee.displayStatus))}
            >
              Fee: {application.fee.displayStatus.replaceAll("_", " ")}
            </span>
          </div>
        )}

        {application.status === "VISA_APPLIED" && application.visaSubStatus && (
          <div className="mt-2">
            <span
              className={cn(
                "px-2 py-1 text-xs font-medium rounded",
                application.visaSubStatus === "VISA_PENDING"
                  ? "bg-blue-100 text-blue-700"
                  : application.visaSubStatus === "VISA_APPROVED"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
              )}
            >
              {application.visaSubStatus.replace("VISA_", "")}
            </span>
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-slate-200">
          <Link
            href={`/dashboard/applications/${application.id}`}
            className="inline-flex rounded border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            onClick={(event) => event.stopPropagation()}
          >
            Open Application
          </Link>
        </div>
      </div>
        </div>
      )}
    </Draggable>
  );
}

function TableView({
  applications,
  selectedIds,
  toggleSelect,
  allSelected,
  toggleSelectAll,
  onStatusChange,
}: {
  applications: Application[];
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  allSelected: boolean;
  toggleSelectAll: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  return (
    <div className="p-6">
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left text-sm font-semibold text-gray-900">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="form-checkbox h-4 w-4 text-blue-600"
                />
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Application ID
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Student Name
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                University
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Course
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Intake
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Status
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Visa Sub-Status
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Counsellor
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Sub-Agent
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Date Created
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Change Status
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {applications.length === 0 && (
              <tr>
                <td colSpan={13} className="px-6 py-12 text-center text-sm text-gray-500">
                  No applications match the current filters.
                </td>
              </tr>
            )}
            {applications.map((app) => (
              <tr key={app.id} className="hover:bg-gray-50 transition">
                <td className="px-3 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(app.id)}
                    onChange={() => toggleSelect(app.id)}
                    className="form-checkbox h-4 w-4 text-blue-600"
                  />
                </td>
                <td className="px-6 py-4 text-sm font-mono text-gray-900">
                  {app.id}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {app.student.firstName} {app.student.lastName}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {app.course.university.name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {app.course.name}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {app.nextIntake || "-"}
                </td>
                <td className="px-6 py-4 text-sm">
                  <div className="flex flex-col gap-2">
                    <span
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium w-fit",
                        STATUS_COLORS[app.status] || "bg-gray-100 text-gray-800"
                      )}
                    >
                      {app.status}
                    </span>
                    {app.hasImmigrationUpdate && (
                      <span className="px-2 py-1 rounded-full text-[11px] font-medium bg-amber-100 text-amber-800 w-fit">
                        Financial requirements updated - re-review
                      </span>
                    )}
                    {app.fee?.feeRequired && (
                      <span
                        className={cn("px-2 py-1 rounded-full text-[11px] font-medium w-fit", feeStatusClass(app.fee.displayStatus))}
                      >
                        Fee: {app.fee.displayStatus.replaceAll("_", " ")}
                      </span>
                    )}
                  </div>
                </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {app.status === "VISA_APPLIED" ? app.visaSubStatus?.replace("VISA_", "") || "PENDING" : "-"}
                  </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {app.counsellor?.name || "-"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {app.student.subAgent?.agencyName || "-"}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {new Date(app.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        onStatusChange(app.id, e.target.value);
                        e.target.value = "";
                      }
                    }}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 bg-white"
                  >
                    <option value="">Move to…</option>
                    {ALL_STATUSES.filter((s) => s !== app.status).map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 text-sm">
                  <Link
                    href={`/dashboard/applications/${app.id}`}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
