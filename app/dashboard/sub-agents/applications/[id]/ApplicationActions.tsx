"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { X, CheckCircle, XCircle, MessageSquare, ShieldOff, RotateCcw, Loader2 } from "lucide-react";

type Status = "PENDING" | "INFO_REQUESTED" | "APPROVED" | "REJECTED";
type ModalType = "approve" | "request-info" | "reject" | "revoke" | "reconsider" | null;

interface Props {
  id: string;
  status: Status;
  agentName: string;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: "success" | "error";
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm",
        type === "success"
          ? "bg-green-50 border border-green-200 text-green-800"
          : "bg-red-50 border border-red-200 text-red-800",
      )}
    >
      {type === "success" ? (
        <CheckCircle className="w-4 h-4 shrink-0 text-green-600" />
      ) : (
        <XCircle className="w-4 h-4 shrink-0 text-red-600" />
      )}
      <span>{message}</span>
      <button onClick={onClose} className="ml-auto shrink-0 opacity-60 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Action button ─────────────────────────────────────────────────────────────

function ActionButton({
  onClick,
  variant,
  icon,
  children,
}: {
  onClick: () => void;
  variant: "green" | "blue" | "red" | "orange" | "slate";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const cls = {
    green: "bg-green-600 hover:bg-green-700 text-white",
    blue: "bg-blue-600 hover:bg-blue-700 text-white",
    red: "bg-red-600 hover:bg-red-700 text-white",
    orange: "bg-amber-500 hover:bg-amber-600 text-white",
    slate: "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300",
  }[variant];

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
        cls,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ApplicationActions({ id, status, agentName }: Props) {
  const router = useRouter();
  const [modal, setModal] = useState<ModalType>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form state
  const [commissionRate, setCommissionRate] = useState("80");
  const [welcomeNote, setWelcomeNote] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [revokeReason, setRevokeReason] = useState("");

  function closeModal() {
    setModal(null);
    setCommissionRate("80");
    setWelcomeNote("");
    setInfoMessage("");
    setRejectReason("");
    setRevokeReason("");
  }

  async function callAction(
    action: string,
    body: Record<string, unknown>,
    successMsg: string,
  ) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/sub-agents/applications/${id}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setToast({ message: data?.error ?? "Something went wrong.", type: "error" });
        return;
      }

      closeModal();
      setToast({ message: successMsg, type: "success" });
      router.refresh();
    } catch {
      setToast({ message: "Network error. Please try again.", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  const isPending = status === "PENDING" || status === "INFO_REQUESTED";
  const isApproved = status === "APPROVED";
  const isRejected = status === "REJECTED";

  return (
    <>
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {isPending && (
          <>
            <ActionButton
              variant="green"
              icon={<CheckCircle className="w-4 h-4" />}
              onClick={() => setModal("approve")}
            >
              Approve
            </ActionButton>
            <ActionButton
              variant="blue"
              icon={<MessageSquare className="w-4 h-4" />}
              onClick={() => setModal("request-info")}
            >
              Request Info
            </ActionButton>
            <ActionButton
              variant="red"
              icon={<XCircle className="w-4 h-4" />}
              onClick={() => setModal("reject")}
            >
              Reject
            </ActionButton>
          </>
        )}
        {isApproved && (
          <ActionButton
            variant="orange"
            icon={<ShieldOff className="w-4 h-4" />}
            onClick={() => setModal("revoke")}
          >
            Revoke Access
          </ActionButton>
        )}
        {isRejected && (
          <ActionButton
            variant="slate"
            icon={<RotateCcw className="w-4 h-4" />}
            onClick={() => setModal("reconsider")}
          >
            Reconsider
          </ActionButton>
        )}
      </div>

      {/* ── Approve modal ── */}
      {modal === "approve" && (
        <Modal title="Approve Application" onClose={closeModal}>
          <p className="text-sm text-slate-600 mb-4">
            Approving <strong>{agentName}</strong> will send them a welcome email
            with a set-password link (expires in 48 h).
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Commission Rate (%)
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Welcome Note <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={welcomeNote}
                onChange={(e) => setWelcomeNote(e.target.value)}
                placeholder="Add a personal message to the welcome email…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              disabled={loading || !commissionRate}
              onClick={() =>
                callAction(
                  "approve",
                  { commissionRate: Number(commissionRate), welcomeNote },
                  "Application approved successfully.",
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-60 transition"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Approval
            </button>
          </div>
        </Modal>
      )}

      {/* ── Request Info modal ── */}
      {modal === "request-info" && (
        <Modal title="Request Additional Information" onClose={closeModal}>
          <p className="text-sm text-slate-600 mb-4">
            The agent will receive an email asking them to respond at their portal.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={infoMessage}
              onChange={(e) => setInfoMessage(e.target.value)}
              placeholder="Describe what information you need…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              disabled={loading || !infoMessage.trim()}
              onClick={() =>
                callAction(
                  "request-info",
                  { message: infoMessage },
                  "Information request sent.",
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-60 transition"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Send Request
            </button>
          </div>
        </Modal>
      )}

      {/* ── Reject modal ── */}
      {modal === "reject" && (
        <Modal title="Reject Application" onClose={closeModal}>
          <p className="text-sm text-slate-600 mb-4">
            The applicant will be notified by email. This action can be reversed
            using &ldquo;Reconsider&rdquo;.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this application is being rejected…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              disabled={loading || !rejectReason.trim()}
              onClick={() =>
                callAction(
                  "reject",
                  { reason: rejectReason },
                  "Application rejected.",
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-60 transition"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Rejection
            </button>
          </div>
        </Modal>
      )}

      {/* ── Revoke modal ── */}
      {modal === "revoke" && (
        <Modal title="Revoke Partner Access" onClose={closeModal}>
          <p className="text-sm text-slate-600 mb-4">
            This will immediately suspend{" "}
            <strong>{agentName}&apos;s</strong> partner access. Their agreement
            will be deactivated.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Explain why access is being revoked…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              disabled={loading || !revokeReason.trim()}
              onClick={() =>
                callAction(
                  "revoke",
                  { reason: revokeReason },
                  "Partner access revoked.",
                )
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-60 transition"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm Revoke
            </button>
          </div>
        </Modal>
      )}

      {/* ── Reconsider modal ── */}
      {modal === "reconsider" && (
        <Modal title="Reconsider Application" onClose={closeModal}>
          <p className="text-sm text-slate-600 mb-4">
            This will move <strong>{agentName}&apos;s</strong> application back
            to <strong>Pending</strong> so it can be reviewed again.
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={closeModal}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              disabled={loading}
              onClick={() =>
                callAction("reconsider", {}, "Application moved back to Pending.")
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium disabled:opacity-60 transition"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirm
            </button>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
