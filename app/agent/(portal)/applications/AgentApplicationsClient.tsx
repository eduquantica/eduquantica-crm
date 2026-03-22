"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { toast } from "sonner";

interface Application {
  id: string;
  studentId: string;
  student: {
    firstName: string;
    lastName: string;
  };
  course: {
    name: string;
    university: {
      name: string;
    };
  };
  status: string;
  createdAt: string;
  nextIntake?: string;
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
    id: "visa-enrolment",
    label: "Swimlane 4 - Visa and Enrolment",
    headerClass: "bg-amber-100 text-amber-800",
    columns: [
      { id: "visa-applied", label: "Visa Applied", statuses: ["VISA_APPLIED"] },
      { id: "enrolled", label: "Enrolled", statuses: ["ENROLLED"] },
      { id: "withdrawn", label: "Withdrawn", statuses: ["WITHDRAWN"] },
    ],
  },
];

export default function AgentApplicationsClient() {
  const queryClient = useQueryClient();
  const [localApplications, setLocalApplications] = useState<Application[]>([]);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["agent-applications"],
    queryFn: async () => {
      const res = await fetch("/api/agent/leads");
      if (!res.ok) throw new Error("Failed to load applications");
      const json = await res.json();
      return json.data || [];
    },
  });

  useEffect(() => {
    setLocalApplications(applications);
  }, [applications]);

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
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-applications"] });
      toast.success("Status updated");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    },
  });

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    // Optimistic update
    setLocalApplications((prev) =>
      prev.map((app) =>
        app.id === draggableId ? { ...app, status: destination.droppableId } : app
      )
    );

    updateStatusMutation.mutate({
      applicationId: draggableId,
      newStatus: destination.droppableId,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading applications...
        </div>
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6 p-6">
        {SWIMLANES.map((swimlane) => {
          return (
            <div key={swimlane.id} className="space-y-3">
              <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${swimlane.headerClass}`}>
                {swimlane.label}
              </div>

              <div className="flex gap-6 overflow-x-auto">
                {swimlane.columns.map((column) => {
                  const columnApps = localApplications.filter((app) =>
                    column.statuses.includes(app.status)
                  );

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

                      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
                        <Droppable droppableId={column.statuses[0]}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={cn(
                                "min-h-12 space-y-3 rounded",
                                snapshot.isDraggingOver && "bg-blue-50"
                              )}
                            >
                              {columnApps.length === 0 && (
                                <div className="text-center py-8 text-gray-500">No applications</div>
                              )}
                              {columnApps.map((app, index) => (
                                <Draggable key={app.id} draggableId={app.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={cn(
                                        "p-4 bg-white rounded-lg border-2 cursor-move transition",
                                        snapshot.isDragging
                                          ? "opacity-70 border-blue-400 shadow-lg"
                                          : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                                      )}
                                    >
                                      <div className="space-y-2">
                                        <div className="font-semibold text-gray-900 text-sm">
                                          {app.student.firstName} {app.student.lastName}
                                        </div>

                                        <div className="text-sm text-gray-600">
                                          <div>{app.course.university.name}</div>
                                          <div className="text-xs text-gray-500">{app.course.name}</div>
                                        </div>

                                        {app.nextIntake && (
                                          <div className="text-xs text-gray-500">Intake: {app.nextIntake}</div>
                                        )}

                                        <div className="text-xs text-gray-400">
                                          {new Date(app.createdAt).toLocaleDateString()}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
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
