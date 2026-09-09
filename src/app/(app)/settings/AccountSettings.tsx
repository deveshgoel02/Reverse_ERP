"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [values, setValues] = useState({ name, email });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not update profile.");
        return;
      }
      setSuccess(true);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Profile" subtitle="Your name and email — email doubles as your login." />
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="profile-name" className="mb-1 block text-xs font-medium text-text">
              Name
            </label>
            <input
              id="profile-name"
              type="text"
              required
              value={values.name}
              onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="profile-email" className="mb-1 block text-xs font-medium text-text">
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              required
              autoComplete="email"
              value={values.email}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
        {error && <p className="text-sm text-[var(--status-critical-text)]">{error}</p>}
        {success && <p className="text-sm text-[var(--status-healthy-text)]">Profile updated.</p>}
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? "Saving..." : "Save Profile"}
        </Button>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Could not change password.");
        return;
      }
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Change Password" subtitle="Requires your current password." />
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="current-password" className="mb-1 block text-xs font-medium text-text">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="new-password" className="mb-1 block text-xs font-medium text-text">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-xs font-medium text-text">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
        {error && <p className="text-sm text-[var(--status-critical-text)]">{error}</p>}
        {success && <p className="text-sm text-[var(--status-healthy-text)]">Password changed.</p>}
        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? "Changing..." : "Change Password"}
        </Button>
      </form>
    </Card>
  );
}
