"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SettingsResponse = {
  data: {
    personal: {
      firstName: string;
      lastName: string;
      email: string;
    };
    preferences: {
      preferredCurrencyDisplay: string;
      communicationLanguage: string;
      emailNotifications: boolean;
      smsNotifications: boolean;
      financePortalNotifications: boolean;
      financeEmailNotifications: boolean;
      messagePortalNotifications: boolean;
      messageEmailNotifications: boolean;
      privacyProfileVisible: boolean;
      privacyShareAnalytics: boolean;
      privacyAllowMarketing: boolean;
      requestAccountDeletion: boolean;
      accountDeletionReason: string;
      preferredDestinations: string[];
      preferredStudyLevels: string[];
      preferredFields: string[];
      preferredIntake: string;
      tuitionBudget: string;
      tuitionBudgetCurrency: string;
    };
  };
};

type SecurityResponse = {
  data: {
    twoFactorEnabled: boolean;
    twoFactorEnabledAt: string | null;
    accountDeletionRequestedAt: string | null;
    accountDeletionReason: string;
  };
};

const CURRENCIES = ["", "GBP", "USD", "CAD", "AUD", "EUR", "BDT", "INR", "NGN", "PKR", "NPR", "GHS"];
const LANGUAGES = ["English", "Bengali", "Hindi", "Urdu", "Arabic", "French"];

export default function StudentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletionReason, setDeletionReason] = useState("");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [preferences, setPreferences] = useState<SettingsResponse["data"]["preferences"]>({
    preferredCurrencyDisplay: "",
    communicationLanguage: "English",
    emailNotifications: true,
    smsNotifications: false,
    financePortalNotifications: true,
    financeEmailNotifications: true,
    messagePortalNotifications: true,
    messageEmailNotifications: true,
    privacyProfileVisible: true,
    privacyShareAnalytics: true,
    privacyAllowMarketing: false,
    requestAccountDeletion: false,
    accountDeletionReason: "",
    preferredDestinations: [],
    preferredStudyLevels: [],
    preferredFields: [],
    preferredIntake: "Any",
    tuitionBudget: "",
    tuitionBudgetCurrency: "GBP",
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [profileRes, securityRes] = await Promise.all([
          fetch("/api/student/profile", { cache: "no-store" }),
          fetch("/api/student/settings/security", { cache: "no-store" }),
        ]);

        const profileJson = (await profileRes.json()) as SettingsResponse | { error: string };
        const securityJson = (await securityRes.json()) as SecurityResponse | { error: string };

        if (!profileRes.ok || !("data" in profileJson)) {
          throw new Error("error" in profileJson ? profileJson.error : "Failed to load settings");
        }

        if (!securityRes.ok || !("data" in securityJson)) {
          throw new Error("error" in securityJson ? securityJson.error : "Failed to load security settings");
        }

        if (!mounted) return;
        setEmail(profileJson.data.personal.email || "");
        setFullName(`${profileJson.data.personal.firstName || ""} ${profileJson.data.personal.lastName || ""}`.trim());
        setPreferences(profileJson.data.preferences);
        setTwoFactorEnabled(Boolean(securityJson.data.twoFactorEnabled));
        setDeletionReason(securityJson.data.accountDeletionReason || "");
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load settings");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function saveSettings() {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/student/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tab: "preferences", data: preferences }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Failed to save settings");
      }
      setMessage("Settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function submitPasswordChange() {
    setSecuritySaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!currentPassword || !newPassword) {
        throw new Error("Current and new password are required.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("New password and confirmation do not match.");
      }
      const res = await fetch("/api/student/settings/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "changePassword", currentPassword, newPassword }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to change password");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password changed successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSecuritySaving(false);
    }
  }

  async function toggleTwoFactor(enabled: boolean) {
    setSecuritySaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/student/settings/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggleTwoFactor", enabled }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to update 2FA");
      setTwoFactorEnabled(enabled);
      setMessage(enabled ? "Two-factor authentication enabled." : "Two-factor authentication disabled.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update 2FA");
    } finally {
      setSecuritySaving(false);
    }
  }

  async function requestDeletion() {
    setSecuritySaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!deletionReason.trim()) {
        throw new Error("Please provide a reason for account deletion.");
      }
      const res = await fetch("/api/student/settings/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "requestDeletion", reason: deletionReason.trim() }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to submit deletion request");
      setPreferences((prev) => ({ ...prev, requestAccountDeletion: true, accountDeletionReason: deletionReason.trim() }));
      setMessage("Deletion request submitted. The support team will contact you.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit deletion request");
    } finally {
      setSecuritySaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 px-5 py-6 sm:px-7">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-600">Manage your account and communication preferences.</p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Account</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
            <input
              value={fullName}
              readOnly
              className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
            <input
              value={email}
              readOnly
              className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/forgot-password"
            className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reset Password
          </Link>
          <Link
            href="/student/profile"
            className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit Full Profile
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Security</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void submitPasswordChange()}
            disabled={securitySaving}
            className="inline-flex h-10 items-center rounded-lg bg-[#1E3A5F] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            Change Password
          </button>
          <button
            type="button"
            onClick={() => void toggleTwoFactor(!twoFactorEnabled)}
            disabled={securitySaving}
            className="inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
          </button>
          <span className={`text-xs font-medium ${twoFactorEnabled ? "text-emerald-700" : "text-slate-500"}`}>
            2FA is {twoFactorEnabled ? "enabled" : "disabled"}
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Communication</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Preferred Language</label>
            <select
              value={preferences.communicationLanguage}
              onChange={(e) => setPreferences((prev) => ({ ...prev, communicationLanguage: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Preferred Currency Display</label>
            <select
              value={preferences.preferredCurrencyDisplay}
              onChange={(e) => setPreferences((prev) => ({ ...prev, preferredCurrencyDisplay: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Auto</option>
              {CURRENCIES.filter(Boolean).map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Notifications</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <span>Email Notifications</span>
            <input
              type="checkbox"
              checked={preferences.emailNotifications}
              onChange={(e) => setPreferences((prev) => ({ ...prev, emailNotifications: e.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <span>SMS Notifications</span>
            <input
              type="checkbox"
              checked={preferences.smsNotifications}
              onChange={(e) => setPreferences((prev) => ({ ...prev, smsNotifications: e.target.checked }))}
            />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">In App</th>
                <th className="px-3 py-2 text-left font-medium">Email</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2 text-slate-800">Finance</td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={preferences.financePortalNotifications}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, financePortalNotifications: e.target.checked }))}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={preferences.financeEmailNotifications}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, financeEmailNotifications: e.target.checked }))}
                  />
                </td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="px-3 py-2 text-slate-800">Messages</td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={preferences.messagePortalNotifications}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, messagePortalNotifications: e.target.checked }))}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={preferences.messageEmailNotifications}
                    onChange={(e) => setPreferences((prev) => ({ ...prev, messageEmailNotifications: e.target.checked }))}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void saveSettings()}
            disabled={saving}
            className="inline-flex h-11 items-center rounded-lg bg-[#1E3A5F] px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="text-base font-semibold text-slate-900">Privacy</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <span>Profile Visible to Counsellors</span>
            <input
              type="checkbox"
              checked={preferences.privacyProfileVisible}
              onChange={(e) => setPreferences((prev) => ({ ...prev, privacyProfileVisible: e.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <span>Share Analytics for Product Improvement</span>
            <input
              type="checkbox"
              checked={preferences.privacyShareAnalytics}
              onChange={(e) => setPreferences((prev) => ({ ...prev, privacyShareAnalytics: e.target.checked }))}
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
            <span>Allow Marketing Communications</span>
            <input
              type="checkbox"
              checked={preferences.privacyAllowMarketing}
              onChange={(e) => setPreferences((prev) => ({ ...prev, privacyAllowMarketing: e.target.checked }))}
            />
          </label>
        </div>

        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-800">Request Account Deletion</p>
          <p className="mt-1 text-xs text-rose-700">Submitting this request will notify support and lock your account for manual review.</p>
          <textarea
            value={deletionReason}
            onChange={(e) => setDeletionReason(e.target.value)}
            rows={3}
            placeholder="Reason for deletion request"
            className="mt-3 w-full rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void requestDeletion()}
              disabled={securitySaving}
              className="inline-flex h-10 items-center rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              Submit Deletion Request
            </button>
            {preferences.requestAccountDeletion && (
              <span className="text-xs font-medium text-rose-700">Deletion request already submitted.</span>
            )}
          </div>
        </div>
      </section>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
    </div>
  );
}
