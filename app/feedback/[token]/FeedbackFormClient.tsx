"use client";

import { useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";

interface FeedbackData {
  studentName: string;
  university: string;
  course: string;
  alreadySubmitted: boolean;
  feedback: {
    overallSatisfaction: number | null;
    counsellorHelpfulness: number | null;
    applicationProcessRating: number | null;
    wouldRecommend: boolean | null;
    comments: string | null;
  } | null;
}

function StarInput({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}>
          <Star className={`w-5 h-5 ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
        </button>
      ))}
    </div>
  );
}

export default function FeedbackFormClient({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FeedbackData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [overallSatisfaction, setOverallSatisfaction] = useState(5);
  const [counsellorHelpfulness, setCounsellorHelpfulness] = useState(5);
  const [applicationProcessRating, setApplicationProcessRating] = useState(5);
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/feedback/${token}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Unable to load feedback form");
      setLoading(false);
      return;
    }

    setData(json.data);
    setSubmitted(json.data.alreadySubmitted);
    setLoading(false);
  }

  async function submit() {
    setSaving(true);
    const res = await fetch(`/api/feedback/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        overallSatisfaction,
        counsellorHelpfulness,
        applicationProcessRating,
        wouldRecommend,
        comments,
      }),
    });
    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(json.error || "Unable to submit feedback");
      return;
    }

    setSubmitted(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (error || !data) {
    return <div className="min-h-screen flex items-center justify-center text-red-600">{error || "Invalid link"}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">EduQuantica Feedback</h1>
          <p className="text-sm text-slate-600 mt-1">
            {data.studentName} · {data.university} · {data.course}
          </p>
        </div>

        {submitted ? (
          <p className="text-emerald-700 font-medium">Thank you! Your feedback has been submitted.</p>
        ) : (
          <>
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Overall satisfaction</p>
              <StarInput value={overallSatisfaction} onChange={setOverallSatisfaction} />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Counsellor helpfulness</p>
              <StarInput value={counsellorHelpfulness} onChange={setCounsellorHelpfulness} />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Application process rating</p>
              <StarInput value={applicationProcessRating} onChange={setApplicationProcessRating} />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Would you recommend EduQuantica?</p>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={wouldRecommend === true}
                    onChange={() => setWouldRecommend(true)}
                  />
                  Yes
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={wouldRecommend === false}
                    onChange={() => setWouldRecommend(false)}
                  />
                  No
                </label>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Comments</p>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                className="w-full border rounded-md px-3 py-2 text-sm"
              />
            </div>

            <button
              onClick={submit}
              disabled={saving}
              className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm disabled:opacity-50"
            >
              {saving ? "Submitting..." : "Submit"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
