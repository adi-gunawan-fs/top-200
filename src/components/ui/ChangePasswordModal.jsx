import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { changePassword } from "../../lib/auth";

export function ChangePasswordModal({ onClose }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await changePassword(newPassword);
      setSuccess(true);
    } catch (err) {
      setError(err.message ?? "Failed to change password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Change Password" onClose={onClose} size="sm">
      <div className="p-4">
        {success ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Password changed successfully.
            </p>
            <Button onClick={onClose} className="w-full">Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">New Password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                placeholder="••••••••"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-700">Confirm Password</span>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={loading}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50"
                placeholder="••••••••"
              />
            </label>
            {error && (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" variant="tonal" tone="info" disabled={loading} className="flex-1">
                {loading ? "Saving…" : "Change Password"}
              </Button>
              <Button type="button" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
