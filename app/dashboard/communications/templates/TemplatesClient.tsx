"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { Trash, Edit } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  updatedAt: string;
}

export default function TemplatesClient() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Partial<EmailTemplate> | null>(null);

  const { data, isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["emailTemplates"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/communications/templates");
      const json = await res.json();
      return json.templates || [];
    },
  });

  const createTpl = useMutation({
    mutationFn: async (tpl: Partial<EmailTemplate>) => {
      const res = await fetch("/api/dashboard/communications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tpl.name,
          subject: tpl.subject,
          body: tpl.body,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailTemplates"] });
      setEditing(null);
    },
  });

  const updateTpl = useMutation({
    mutationFn: async (tpl: Partial<EmailTemplate>) => {
      const res = await fetch(
        `/api/dashboard/communications/templates/${tpl.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tpl.name,
            subject: tpl.subject,
            body: tpl.body,
          }),
        }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailTemplates"] });
      setEditing(null);
    },
  });

  const deleteTpl = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(
        `/api/dashboard/communications/templates/${id}`,
        { method: "DELETE" }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emailTemplates"] });
    },
  });

  const handleSave = () => {
    if (!editing) return;
    if (editing.id) {
      updateTpl.mutate(editing as EmailTemplate);
    } else {
      if (!editing.name || !editing.subject || !editing.body) {
        alert("All fields are required");
        return;
      }
      createTpl.mutate(editing as EmailTemplate);
    }
  };

  const startEdit = (tpl?: EmailTemplate) => {
    if (tpl) {
      setEditing({ ...tpl });
    } else {
      setEditing({ name: "", subject: "", body: "" });
    }
  };

  if (isLoading) return <div>Loading…</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Email Templates</h1>
        <button
          onClick={() => startEdit()}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Create Template
        </button>
      </div>

      {editing && (
        <div className="mb-6 p-4 border rounded bg-white">
          <div className="mb-3">
            <label className="block mb-1">Template Name</label>
            <input
              className="w-full border px-2 py-1"
              value={editing.name || ""}
              onChange={(e) =>
                setEditing((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </div>
          <div className="mb-3">
            <label className="block mb-1">Subject Line</label>
            <input
              className="w-full border px-2 py-1"
              value={editing.subject || ""}
              onChange={(e) =>
                setEditing((prev) => ({ ...prev, subject: e.target.value }))
              }
            />
            <p className="text-sm text-gray-500 mt-1">
              You can use variables like <code>{"{{student_name}}"}</code>,{' '}
              <code>{"{{university_name}}"}</code>,{' '}
              <code>{"{{course_name}}"}</code>,{' '}
              <code>{"{{counsellor_name}}"}</code>.
            </p>
          </div>
          <div className="mb-3">
            <label className="block mb-1">Body</label>
            <ReactQuill
              theme="snow"
              value={editing.body || ""}
              onChange={(val) =>
                setEditing((prev) => ({ ...prev, body: val }))
              }
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-500 text-white rounded"
            >
              Save Template
            </button>
            <button
              onClick={() => setEditing(null)}
              className="px-4 py-2 bg-gray-300 text-gray-800 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <table className="w-full bg-white border">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Name</th>
            <th className="p-2 text-left">Subject</th>
            <th className="p-2 text-left">Last edited</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((tpl) => (
            <tr key={tpl.id} className="border-t">
              <td className="p-2">{tpl.name}</td>
              <td className="p-2">{tpl.subject}</td>
              <td className="p-2">{new Date(tpl.updatedAt).toLocaleString()}</td>
              <td className="p-2 flex gap-2 justify-center">
                <button
                  title="Edit"
                  onClick={() => startEdit(tpl)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Edit size={16} />
                </button>
                <button
                  title="Delete"
                  onClick={() => {
                    if (confirm("Delete this template?")) {
                      deleteTpl.mutate(tpl.id);
                    }
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
