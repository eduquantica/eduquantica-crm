"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface Counsellor {
  id: string;
  name: string | null;
  email: string;
}

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  user: { id: string; name: string | null; email?: string };
  student: { id: string; firstName: string; lastName: string } | null;
  lead: { id: string; firstName: string; lastName: string } | null;
  userId: string;
  createdAt: string;
}

interface TasksClientProps {
  counsellors: Counsellor[];
}

interface Filters {
  status: string;
  priority: string;
  assignedTo: string;
  from: string;
  to: string;
  hideCompleted: boolean;
  search: string;
}

const DEFAULT_FILTERS: Filters = {
  status: "",
  priority: "",
  assignedTo: "",
  from: "",
  to: "",
  hideCompleted: false,
  search: "",
};

const PRIORITY_CLASSES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-gray-100 text-gray-700",
};

export default function TasksClient({ counsellors }: TasksClientProps) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<TaskRow | null>(null);
  const [form, setForm] = useState<{
    title: string;
    description?: string;
    studentId?: string;
    leadId?: string;
    assignedTo?: string;
    priority: string;
    dueDate?: string;
    status?: string;
  }>({
    title: "",
    priority: "MEDIUM",
  });

  const { data, isLoading } = useQuery<TaskRow[]>({
    queryKey: ["tasks", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.priority) params.set("priority", filters.priority);
      if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.hideCompleted) params.set("hideCompleted", "1");
      if (filters.search) params.set("search", filters.search);
      const res = await fetch(`/api/dashboard/tasks?${params.toString()}`);
      const json = await res.json();
      return json.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/dashboard/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setShowCreate(false);
    },
  });

  const patchTask = async (id: string, updates: Record<string, unknown>): Promise<TaskRow> => {
    const res = await fetch(`/api/dashboard/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update");
    const json = await res.json();
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    return json.data;
  };

  const deleteTask = async (id: string) => {
    const res = await fetch(`/api/dashboard/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete");
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  // utility for due date colour
  function dueClass(due?: string | null) {
    if (!due) return "text-gray-600";
    const date = new Date(due);
    const now = new Date();
    const diff = date.setHours(0,0,0,0) - now.setHours(0,0,0,0);
    if (diff < 0) return "text-red-600";
    if (diff === 0) return "text-amber-600";
    return "text-gray-600";
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* header */}
      <div className="p-6 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 mt-1">Manage tasks across the team</p>
        </div>
        <button
          onClick={() => {
            setForm({
              title: "",
              description: "",
              studentId: "",
              leadId: "",
              assignedTo: "",
              priority: "MEDIUM",
              dueDate: "",
            });
            setShowCreate(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus className="w-4 h-4" />
          Create Task
        </button>
      </div>

      {/* filters */}
      <div className="p-4 bg-white border-b">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            placeholder="Search"
            value={filters.search}
            onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
            className="px-3 py-2 border rounded w-full"
          />
          <select
            value={filters.status}
            onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border rounded w-full"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <select
            value={filters.priority}
            onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value }))}
            className="px-3 py-2 border rounded w-full"
          >
            <option value="">All Priorities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            value={filters.assignedTo}
            onChange={(e) => setFilters(f => ({ ...f, assignedTo: e.target.value }))}
            className="px-3 py-2 border rounded w-full"
          >
            <option value="">All Counsellors</option>
            {counsellors.map(c => (
              <option key={c.id} value={c.id}>{c.name || c.email}</option>
            ))}
          </select>
          <div>
            <label className="block text-xs">Due from</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
              className="px-3 py-2 border rounded w-full"
            />
          </div>
          <div>
            <label className="block text-xs">Due to</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
              className="px-3 py-2 border rounded w-full"
            />
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={filters.hideCompleted}
              onChange={(e) => setFilters(f => ({ ...f, hideCompleted: e.target.checked }))}
              id="hideCompleted"
              className="mr-2"
            />
            <label htmlFor="hideCompleted" className="text-sm">Hide Completed</label>
          </div>
        </div>
      </div>

      {/* table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Linked To</th>
              <th className="px-4 py-2">Assigned To</th>
              <th className="px-4 py-2">Priority</th>
              <th className="px-4 py-2">Due Date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Created By</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="p-4 text-center"><Loader2 className="animate-spin w-6 h-6 mx-auto" /></td></tr>
            )}
            {!isLoading && data && data.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-gray-500">No tasks</td></tr>
            )}
            {!isLoading && data && data.map(task => (
              <tr key={task.id} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(task)}>
                <td className="px-4 py-2 text-blue-600 underline">{task.title}</td>
                <td className="px-4 py-2">
                  {task.student ? (
                    <a href={`/dashboard/students/${task.student.id}`} className="text-blue-600 hover:underline">
                      {task.student.firstName} {task.student.lastName}
                    </a>
                  ) : task.lead ? (
                    <a href={`/dashboard/leads/${task.lead.id}`} className="text-blue-600 hover:underline">
                      {task.lead.firstName} {task.lead.lastName}
                    </a>
                  ) : (
                    <span>General</span>
                  )}
                </td>
                <td className="px-4 py-2">{task.user.name || task.user.email}</td>
                <td className="px-4 py-2">
                  <span className={cn("px-2 py-1 rounded-full text-xs font-medium", PRIORITY_CLASSES[task.priority] ?? "bg-gray-100 text-gray-700")}>{task.priority}</span>
                </td>
                <td className={`px-4 py-2 ${dueClass(task.dueDate)}`}>{task.dueDate ? new Date(task.dueDate).toLocaleString() : "-"}</td>
                <td className="px-4 py-2">
                  <span className={cn("px-2 py-1 rounded-full text-xs font-medium",
                    task.status === "PENDING" ? "bg-gray-100 text-gray-700" :
                    task.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                    task.status === "COMPLETED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                  )}>{task.status.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-2">{task.user.name || task.user.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* create slide-over */}
      {showCreate && (
        <div>
          <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setShowCreate(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-40 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">New Task</h3>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Link to Student or Lead</label>
                <input
                  placeholder="Paste student or lead id"
                  value={form.studentId || form.leadId || ""}
                  onChange={(e) => {
                    setForm(f => ({ ...f, studentId: e.target.value, leadId: "" }));
                  }}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-400 mt-1">(Type an ID for now)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assigned To</label>
                <select
                  value={form.assignedTo}
                  onChange={(e) => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Creator</option>
                  {counsellors.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <input
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
              <button
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                disabled={!form.title || (createMutation as any).isLoading}
                onClick={() => createMutation.mutate(form)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60 transition"
              >
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {(createMutation as any).isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* detail slide-over */}
      {selected && (
        <TaskDetail
          task={selected}
          onClose={() => setSelected(null)}
          onSave={patchTask}
          onDelete={deleteTask}
          counsellors={counsellors}
        />
      )}
    </div>
  );
}

interface TaskDetailProps {
  task: TaskRow;
  onClose: () => void;
  onSave: (id: string, updates: Record<string, unknown>) => Promise<TaskRow>;
  onDelete: (id: string) => Promise<void>;
  counsellors: Counsellor[];
}

function TaskDetail({ task, onClose, onSave, onDelete, counsellors }: TaskDetailProps) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...task, assignedTo: task.userId });
  const [logs, setLogs] = useState<Array<{ id: string; action: string; details?: string; createdAt: string; user: { name: string | null; email: string } }>>([]);

  useEffect(() => {
    fetch(`/api/dashboard/activity?entityType=task&entityId=${task.id}`)
      .then(r => r.json())
      .then(d => setLogs(d.data || []))
      .catch(() => {});
  }, [task.id]);

  return (
    <div>
      <div className="fixed inset-0 bg-black/20 z-30" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-40 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">Task Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {editing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={form.description ?? ""}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assigned To</label>
                <select
                  value={form.assignedTo}
                  onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Creator</option>
                  {counsellors.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                <input
                  type="datetime-local"
                  value={form.dueDate || ""}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="PENDING">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold text-slate-900 text-lg">{task.title}</p>
              {task.description && <p className="text-slate-700">{task.description}</p>}
              <p className="text-sm text-slate-500">Assigned to: {task.user.name || task.user.email}</p>
              <p className="text-sm text-slate-500">Priority: {task.priority}</p>
              <p className="text-sm text-slate-500">Status: {task.status}</p>
              <p className="text-sm text-slate-500">Due: {task.dueDate ? new Date(task.dueDate).toLocaleString() : "-"}</p>
            </>
          )}

          <div className="border-t border-slate-100 pt-4">
            <h4 className="font-semibold text-slate-900 mb-2">Activity</h4>
            {logs.length === 0 && <p className="text-sm text-slate-500">No activity</p>}
            {logs.map(l => (
              <div key={l.id} className="text-xs text-slate-600 mb-1">
                {new Date(l.createdAt).toLocaleString()} – {l.user.name || l.user.email} – {l.action} {l.details && `(${l.details})`}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
              <button
                onClick={() => onSave(task.id, form).then(() => setEditing(false))}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
              >Save</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="px-4 py-2 text-sm text-blue-600 hover:underline">Edit</button>
              {task.status !== "COMPLETED" && (
                <button
                  onClick={() => onSave(task.id, { status: "COMPLETED" })}
                  className="px-4 py-2 text-sm text-green-600 hover:underline"
                >Mark Complete</button>
              )}
              <button
                onClick={() => {
                  if (confirm("Delete task?")) onDelete(task.id).then(onClose);
                }}
                className="px-4 py-2 text-sm text-red-600 hover:underline"
              >Delete</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}