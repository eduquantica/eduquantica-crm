import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, AlertCircle, Check } from "lucide-react";
import { toast } from "sonner";

interface LogCallModalProps {
  studentId: string;
  studentName: string;
  isOpen: boolean;
  onClose: () => void;
  entityType?: "student" | "lead";
}

type Direction = "OUTBOUND" | "INBOUND";
type Outcome =
  | "ANSWERED"
  | "NO_ANSWER"
  | "VOICEMAIL"
  | "BUSY"
  | "WRONG_NUMBER";

export function LogCallModal({
  studentId,
  studentName,
  isOpen,
  onClose,
  entityType = "student",
}: LogCallModalProps) {
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    callDateTime: new Date().toISOString().slice(0, 16),
    duration: 5,
    direction: "OUTBOUND" as Direction,
    outcome: "ANSWERED" as Outcome,
    notes: "",
    followUpNeeded: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const logCallMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const endpoint = entityType === "lead"
        ? `/api/leads/${studentId}/calls`
        : `/api/students/${studentId}/calls`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callDateTime: new Date(data.callDateTime).toISOString(),
          duration: data.duration,
          outcome: data.outcome,
          notes: data.notes,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to log call");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Call logged successfully");
      queryClient.invalidateQueries({ queryKey: ["student", studentId] });
      queryClient.invalidateQueries({ queryKey: ["activityLogs"] });
      onClose();
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log call");
    },
  });

  const resetForm = () => {
    setFormData({
      callDateTime: new Date().toISOString().slice(0, 16),
      duration: 5,
      direction: "OUTBOUND",
      outcome: "ANSWERED",
      notes: "",
      followUpNeeded: false,
    });
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: Record<string, string> = {};

    if (!formData.callDateTime) {
      newErrors.callDateTime = "Date and time are required";
    }

    if (formData.duration <= 0) {
      newErrors.duration = "Duration must be greater than 0";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      logCallMutation.mutate(formData);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6">
          <h2 className="text-xl font-semibold text-gray-900">Log Call</h2>
          <button
            onClick={onClose}
            disabled={logCallMutation.isPending}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Student Name (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Student
            </label>
            <input
              type="text"
              value={studentName}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
            />
          </div>

          {/* Call Date & Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date & Time
            </label>
            <input
              type="datetime-local"
              value={formData.callDateTime}
              onChange={(e) =>
                setFormData({ ...formData, callDateTime: e.target.value })
              }
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.callDateTime
                  ? "border-red-500"
                  : "border-gray-300"
              }`}
            />
            {errors.callDateTime && (
              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.callDateTime}
              </p>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e) =>
                setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })
              }
              min="1"
              className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.duration ? "border-red-500" : "border-gray-300"
              }`}
            />
            {errors.duration && (
              <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.duration}
              </p>
            )}
          </div>

          {/* Direction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Direction
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="direction"
                  value="OUTBOUND"
                  checked={formData.direction === "OUTBOUND"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      direction: e.target.value as Direction,
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Outbound</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="direction"
                  value="INBOUND"
                  checked={formData.direction === "INBOUND"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      direction: e.target.value as Direction,
                    })
                  }
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Inbound</span>
              </label>
            </div>
          </div>

          {/* Outcome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Outcome
            </label>
            <select
              value={formData.outcome}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  outcome: e.target.value as Outcome,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ANSWERED">Answered</option>
              <option value="NO_ANSWER">No Answer</option>
              <option value="VOICEMAIL">Voicemail</option>
              <option value="BUSY">Busy</option>
              <option value="WRONG_NUMBER">Wrong Number</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Call summary, key points discussed..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Follow-up Toggle */}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.followUpNeeded}
              onChange={(e) =>
                setFormData({ ...formData, followUpNeeded: e.target.checked })
              }
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Schedule follow-up task</span>
          </label>

          {formData.followUpNeeded && (
            <p className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
              ✓ A follow-up task will be created with a 2-day due date
            </p>
          )}
        </form>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={logCallMutation.isPending}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={logCallMutation.isPending || logCallMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
          >
            {logCallMutation.isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Logging...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Log Call
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
