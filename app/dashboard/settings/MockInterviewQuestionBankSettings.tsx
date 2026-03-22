"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type QuestionRow = {
  id: string;
  roundNumber: number;
  roundName: string;
  questionText: string;
  followUpQuestion: string | null;
  evaluationCriteria: string | null;
  redFlags: string | null;
  isActive: boolean;
  orderIndex: number;
};

type RoundGroup = {
  roundNumber: number;
  roundName: string;
  questions: QuestionRow[];
};

type FormState = {
  roundNumber: number;
  roundName: string;
  questionText: string;
  followUpQuestion: string;
  evaluationCriteria: string;
  redFlags: string;
  isActive: boolean;
};

const DEFAULT_FORM: FormState = {
  roundNumber: 1,
  roundName: "University Knowledge",
  questionText: "",
  followUpQuestion: "",
  evaluationCriteria: "",
  redFlags: "",
  isActive: true,
};

export default function MockInterviewQuestionBankSettings() {
  const [rounds, setRounds] = useState<RoundGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editingQuestion = useMemo(
    () => rounds.flatMap((round) => round.questions).find((question) => question.id === editingQuestionId) || null,
    [rounds, editingQuestionId],
  );

  async function loadQuestionBank() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/settings/mock-interview-questions", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to load question bank");
      setRounds(json.data.rounds || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load question bank");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadQuestionBank();
  }, []);

  useEffect(() => {
    const selectedRound = rounds.find((round) => round.roundNumber === form.roundNumber);
    if (selectedRound && selectedRound.roundName !== form.roundName) {
      setForm((current) => ({ ...current, roundName: selectedRound.roundName }));
    }
  }, [form.roundName, form.roundNumber, rounds]);

  async function handleCreateQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/settings/mock-interview-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to create question");

      setForm((current) => ({ ...current, questionText: "", followUpQuestion: "", evaluationCriteria: "", redFlags: "" }));
      await loadQuestionBank();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create question");
    } finally {
      setSaving(false);
    }
  }

  async function updateQuestion(questionId: string, payload: Partial<FormState>) {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/settings/mock-interview-questions/${questionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to update question");
      await loadQuestionBank();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update question");
    } finally {
      setSaving(false);
    }
  }

  async function reorderRound(roundNumber: number, orderedIds: string[]) {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/settings/mock-interview-questions/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundNumber, orderedIds }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Failed to reorder questions");
      await loadQuestionBank();
    } catch (reorderError) {
      setError(reorderError instanceof Error ? reorderError.message : "Failed to reorder questions");
    } finally {
      setSaving(false);
    }
  }

  async function moveQuestion(roundNumber: number, questions: QuestionRow[], questionId: string, direction: -1 | 1) {
    const index = questions.findIndex((question) => question.id === questionId);
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const orderedIds = [...questions.map((question) => question.id)];
    const [moved] = orderedIds.splice(index, 1);
    orderedIds.splice(targetIndex, 0, moved);

    await reorderRound(roundNumber, orderedIds);
  }

  return (
    <div className="space-y-4">
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <form onSubmit={handleCreateQuestion} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Add Question</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs text-slate-600">
            Round
            <select
              value={form.roundNumber}
              onChange={(event) => setForm((current) => ({ ...current, roundNumber: Number(event.target.value) }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {rounds.map((round) => (
                <option key={round.roundNumber} value={round.roundNumber}>
                  Round {round.roundNumber}: {round.roundName}
                </option>
              ))}
              {rounds.length === 0 && <option value={1}>Round 1</option>}
            </select>
          </label>

          <label className="text-xs text-slate-600">
            Active
            <select
              value={form.isActive ? "true" : "false"}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === "true" }))}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>

        <textarea
          value={form.questionText}
          onChange={(event) => setForm((current) => ({ ...current, questionText: event.target.value }))}
          placeholder="Question text"
          rows={2}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          required
        />
        <textarea
          value={form.followUpQuestion}
          onChange={(event) => setForm((current) => ({ ...current, followUpQuestion: event.target.value }))}
          placeholder="Follow-up question (optional)"
          rows={2}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <textarea
          value={form.evaluationCriteria}
          onChange={(event) => setForm((current) => ({ ...current, evaluationCriteria: event.target.value }))}
          placeholder="Evaluation criteria (optional)"
          rows={2}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <textarea
          value={form.redFlags}
          onChange={(event) => setForm((current) => ({ ...current, redFlags: event.target.value }))}
          placeholder="Red flags (optional)"
          rows={2}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />

        <button
          type="submit"
          disabled={saving || !form.questionText.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Add Question"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Loading question bank...</p>
      ) : (
        <div className="space-y-4">
          {rounds.map((round) => (
            <div key={round.roundNumber} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Round {round.roundNumber}: {round.roundName}</h3>
                <span className="text-xs text-slate-500">{round.questions.length} questions</span>
              </div>

              {round.questions.length === 0 ? (
                <p className="text-sm text-slate-500">No questions in this round.</p>
              ) : (
                <div className="space-y-2">
                  {round.questions.map((question, index) => {
                    const isEditing = editingQuestion?.id === question.id;
                    return (
                      <div key={question.id} className="rounded-md border border-slate-200 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900">{question.questionText}</p>
                            <p className="mt-1 text-xs text-slate-500">Order #{question.orderIndex}</p>
                            {question.followUpQuestion && <p className="mt-1 text-xs text-slate-600">Follow-up: {question.followUpQuestion}</p>}
                            {question.evaluationCriteria && <p className="mt-1 text-xs text-slate-600">Criteria: {question.evaluationCriteria}</p>}
                            {question.redFlags && <p className="mt-1 text-xs text-slate-600">Red flags: {question.redFlags}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${question.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                              {question.isActive ? "Active" : "Inactive"}
                            </span>
                            <button
                              type="button"
                              disabled={saving || index === 0}
                              onClick={() => void moveQuestion(round.roundNumber, round.questions, question.id, -1)}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              disabled={saving || index === round.questions.length - 1}
                              onClick={() => void moveQuestion(round.roundNumber, round.questions, question.id, 1)}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => setEditingQuestionId(question.id)}
                              className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void updateQuestion(question.id, { isActive: !question.isActive })}
                              className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                              {question.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        </div>

                        {isEditing && (
                          <EditQuestionForm
                            question={question}
                            rounds={rounds}
                            onCancel={() => setEditingQuestionId(null)}
                            onSave={async (payload) => {
                              await updateQuestion(question.id, payload);
                              setEditingQuestionId(null);
                            }}
                            saving={saving}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EditQuestionForm({
  question,
  rounds,
  onCancel,
  onSave,
  saving,
}: {
  question: QuestionRow;
  rounds: RoundGroup[];
  onCancel: () => void;
  onSave: (payload: Partial<FormState>) => Promise<void>;
  saving: boolean;
}) {
  const [draft, setDraft] = useState<FormState>({
    roundNumber: question.roundNumber,
    roundName: question.roundName,
    questionText: question.questionText,
    followUpQuestion: question.followUpQuestion || "",
    evaluationCriteria: question.evaluationCriteria || "",
    redFlags: question.redFlags || "",
    isActive: question.isActive,
  });

  useEffect(() => {
    const selectedRound = rounds.find((round) => round.roundNumber === draft.roundNumber);
    if (selectedRound && selectedRound.roundName !== draft.roundName) {
      setDraft((current) => ({ ...current, roundName: selectedRound.roundName }));
    }
  }, [draft.roundName, draft.roundNumber, rounds]);

  return (
    <form
      className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({
          roundNumber: draft.roundNumber,
          roundName: draft.roundName,
          questionText: draft.questionText,
          followUpQuestion: draft.followUpQuestion || "",
          evaluationCriteria: draft.evaluationCriteria || "",
          redFlags: draft.redFlags || "",
          isActive: draft.isActive,
        });
      }}
    >
      <div className="grid gap-2 md:grid-cols-2">
        <select
          value={draft.roundNumber}
          onChange={(event) => setDraft((current) => ({ ...current, roundNumber: Number(event.target.value) }))}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          {rounds.map((round) => (
            <option key={round.roundNumber} value={round.roundNumber}>
              Round {round.roundNumber}: {round.roundName}
            </option>
          ))}
        </select>
        <select
          value={draft.isActive ? "true" : "false"}
          onChange={(event) => setDraft((current) => ({ ...current, isActive: event.target.value === "true" }))}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <textarea
        value={draft.questionText}
        onChange={(event) => setDraft((current) => ({ ...current, questionText: event.target.value }))}
        rows={2}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
        required
      />
      <textarea
        value={draft.followUpQuestion}
        onChange={(event) => setDraft((current) => ({ ...current, followUpQuestion: event.target.value }))}
        rows={2}
        placeholder="Follow-up question"
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
      />
      <textarea
        value={draft.evaluationCriteria}
        onChange={(event) => setDraft((current) => ({ ...current, evaluationCriteria: event.target.value }))}
        rows={2}
        placeholder="Evaluation criteria"
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
      />
      <textarea
        value={draft.redFlags}
        onChange={(event) => setDraft((current) => ({ ...current, redFlags: event.target.value }))}
        rows={2}
        placeholder="Red flags"
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
      />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !draft.questionText.trim()}
          className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </form>
  );
}
