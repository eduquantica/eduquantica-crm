"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface RecipientData {
  email: string;
  studentName?: string;
  courseName?: string;
  universityName?: string;
  counsellorName?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface Counsellor {
  id: string;
  name: string;
}

export default function BulkEmailClient() {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // selection criteria
  const [type, setType] = useState<string>("all_students");
  const [nationality, setNationality] = useState<string>("");
  const [counsellorId, setCounsellorId] = useState<string>("");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [leadIds, setLeadIds] = useState<string[]>([]);

  const [customSearch, setCustomSearch] = useState<string>("");
  const [customStudents, setCustomStudents] = useState<{id:string; firstName:string; lastName:string; email:string;}[]>([]);
  const [customLeads, setCustomLeads] = useState<{id:string; firstName:string; lastName:string; email:string;}[]>([]);

  const [recipientsInfo, setRecipientsInfo] = useState<{ count: number; sample?: RecipientData } | null>(null);

  // template / composition
  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["emailTemplates"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/communications/templates");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      return json.templates || [];
    },
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | "">("");
  const [subject, setSubject] = useState<string>("");
  const [body, setBody] = useState<string>("");

  // load counsellors for dropdown
const { data: counsellors = [] } = useQuery<Counsellor[]>({
      queryKey: ["counsellors"],
      queryFn: async () => {
        const res = await fetch("/api/dashboard/communications/counsellors");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const json: any = await res.json();
        return json.counsellors || [];
      },
  });

  // preview query mutation
  const previewQuery = useQuery({
    queryKey: ["bulkRecipients", type, nationality, counsellorId, studentIds.join(","), leadIds.join(",")],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("type", type);
      if (nationality) params.set("nationality", nationality);
      if (counsellorId) params.set("counsellorId", counsellorId);
      if (studentIds.length) params.set("studentIds", studentIds.join(","));
      if (leadIds.length) params.set("leadIds", leadIds.join(","));
      params.set("preview", "true");
      const res = await fetch(`/api/dashboard/communications/bulk-email?${params}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      return json;
    },
    enabled: step === 2 && !!type,
  });

  // send mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = { type };
      if (nationality) payload.nationality = nationality;
      if (counsellorId) payload.counsellorId = counsellorId;
      if (studentIds.length) payload.studentIds = studentIds;
      if (leadIds.length) payload.leadIds = leadIds;
      if (selectedTemplateId) payload.templateId = selectedTemplateId;
      else {
        payload.subject = subject;
        payload.body = body;
      }
      const res = await fetch("/api/dashboard/communications/bulk-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      return json;
    },
    onSuccess: (data) => {
      alert(`Email sent to ${data.count} recipients`);
      setStep(1);
      // reset selections
      setType("all_students");
      setNationality("");
      setCounsellorId("");
      setStudentIds([]);
      setLeadIds([]);
      setSelectedTemplateId("");
      setSubject("");
      setBody("");
      setRecipientsInfo(null);
    },
  });

  useEffect(() => {
    if (previewQuery.data) {
      setRecipientsInfo({ count: previewQuery.data.count, sample: previewQuery.data.sample });
      if (previewQuery.data.count === 0) {
        alert("No recipients matching criteria");
      }
    }
  }, [previewQuery.data]);

  // custom search effect
  useEffect(() => {
    if (customSearch.trim()) {
      fetch(`/api/dashboard/students?q=${encodeURIComponent(customSearch)}`)
        .then((r) => r.json())
        .then((j) => setCustomStudents(j.data || []));
      fetch(`/api/dashboard/leads?q=${encodeURIComponent(customSearch)}`)
        .then((r) => r.json())
        .then((j) => setCustomLeads(j.data || []));
    } else {
      setCustomStudents([]);
      setCustomLeads([]);
    }
  }, [customSearch]);

  const handleNextFromStep1 = async () => {
    // trigger preview query by advancing step
    setStep(2);
  };

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id);
    if (id) {
      const t = templates.find((t) => t.id === id);
      if (t) {
        setSubject(t.subject);
        setBody(t.body);
      }
    } else {
      setSubject("");
      setBody("");
    }
  };

  const renderPreview = () => {
    if (!recipientsInfo || !recipientsInfo.sample) return null;
    const r = recipientsInfo.sample;
    let subj = subject;
    let bodyHtml = body;
    // simple replacement
    subj = subj
      .replace(/{{\s*student_name\s*}}/gi, r.studentName || "")
      .replace(/{{\s*university_name\s*}}/gi, r.universityName || "")
      .replace(/{{\s*course_name\s*}}/gi, r.courseName || "")
      .replace(/{{\s*counsellor_name\s*}}/gi, r.counsellorName || "");
    bodyHtml = bodyHtml
      .replace(/{{\s*student_name\s*}}/gi, r.studentName || "")
      .replace(/{{\s*university_name\s*}}/gi, r.universityName || "")
      .replace(/{{\s*course_name\s*}}/gi, r.courseName || "")
      .replace(/{{\s*counsellor_name\s*}}/gi, r.counsellorName || "");

    return (
      <div className="p-4 border rounded bg-white">
        <h3 className="font-semibold mb-2">Preview</h3>
        <div className="mb-2">
          <strong>To:</strong> {r.email}
        </div>
        <div className="mb-2">
          <strong>Subject:</strong> {subj}
        </div>
        <div
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </div>
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Bulk Email Sender</h1>
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="font-medium">Recipient group</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full border px-2 py-1 mt-1"
            >
              <option value="all_students">All Students</option>
              <option value="all_leads">All Leads</option>
              <option value="active_applications">Students with Active Applications</option>
              <option value="by_nationality">Students by Nationality</option>
              <option value="by_counsellor">Students by Counsellor</option>
              <option value="custom">Custom selection</option>
            </select>
          </div>

          {type === "by_nationality" && (
            <div>
              <label className="font-medium">Nationality</label>
              <input
                className="w-full border px-2 py-1 mt-1"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                placeholder="e.g. India"
              />
            </div>
          )}

          {type === "by_counsellor" && (
            <div>
              <label className="font-medium">Counsellor</label>
              <select
                value={counsellorId}
                onChange={(e) => setCounsellorId(e.target.value)}
                className="w-full border px-2 py-1 mt-1"
              >
                <option value="">(choose)</option>
                {counsellors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === "custom" && (
            <div className="space-y-2">
              <label className="font-medium">Search students or leads</label>
              <input
                className="w-full border px-2 py-1"
                placeholder="Type name or email to filter"
                value={customSearch}
                onChange={(e) => setCustomSearch(e.target.value)}
              />
              <div className="flex gap-4">
                <div className="flex-1">
                  <h4 className="font-semibold">Students</h4>
                  {customStudents.map((s) => (
                    <div key={s.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={studentIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setStudentIds((prev) => [...prev, s.id]);
                          } else {
                            setStudentIds((prev) => prev.filter((id) => id !== s.id));
                          }
                        }}
                      />
                      <span className="ml-2">
                        {s.firstName} {s.lastName} &lt;{s.email}&gt;
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold">Leads</h4>
                  {customLeads.map((l) => (
                    <div key={l.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={leadIds.includes(l.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setLeadIds((prev) => [...prev, l.id]);
                          } else {
                            setLeadIds((prev) => prev.filter((id) => id !== l.id));
                          }
                        }}
                      />
                      <span className="ml-2">
                        {l.firstName} {l.lastName} &lt;{l.email}&gt;
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                {studentIds.length + leadIds.length} recipients selected
              </div>
            </div>
          )}

          <button
            onClick={handleNextFromStep1}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Next →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <strong>Recipients:</strong> {recipientsInfo?.count ?? "..."}
          </div>

          <div>
            <label className="font-medium">Template</label>
            <select
              className="w-full border px-2 py-1 mt-1"
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
            >
              <option value="">(custom message)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-1">Subject</label>
            <input
              className="w-full border px-2 py-1"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div>
            <label className="block mb-1">Body</label>
            <ReactQuill theme="snow" value={body} onChange={setBody} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 bg-gray-300 rounded"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Preview →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div>
            <strong>Recipients:</strong> {recipientsInfo?.count}
          </div>
          {renderPreview()}
          <div className="flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 bg-gray-300 rounded"
            >
              ← Back
            </button>
            <button
              onClick={() => sendMutation.mutate()}
              className="px-4 py-2 bg-green-500 text-white rounded"
            >
              Send Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
