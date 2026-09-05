'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { resetPasswordSchema, zodErrors } from '@/lib/validation/authSchemas';

type FieldErrors = Record<string, string>;

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSuccess(false);

    if (password !== confirm) {
      setFieldErrors({ confirm: 'Passwords do not match.' });
      return;
    }

    // R1.2 — same schema the server uses.
    const parsed = resetPasswordSchema.safeParse({ token, password });
    if (!parsed.success) {
      setFieldErrors(zodErrors(parsed.error));
      return;
    }

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed.data),
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.errors) setFieldErrors(data.errors);
      setFormError(data.message ?? 'Something went wrong.');
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Password updated</h1>
          <p className="auth-subtitle">You can sign in with your new password.</p>
          <Link className="link" href="/signin">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <h1 className="auth-title">Reset password</h1>

        {!token ? (
          <p className="auth-subtitle">
            This reset link is invalid or incomplete. Please request a new one.
          </p>
        ) : (
          <p className="auth-subtitle">Choose a new password.</p>
        )}

        {formError ? <div className="alert alert-error">{formError}</div> : null}

        <div className="field">
          <label className="label" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            className={`input ${fieldErrors.password ? 'input-error' : ''}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            disabled={!token}
          />
          {fieldErrors.password ? (
            <span className="error-text">{fieldErrors.password}</span>
          ) : null}
        </div>

        <div className="field">
          <label className="label" htmlFor="confirm">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            className={`input ${fieldErrors.confirm ? 'input-error' : ''}`}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            disabled={!token}
          />
          {fieldErrors.confirm ? (
            <span className="error-text">{fieldErrors.confirm}</span>
          ) : null}
        </div>

        <button className="button" type="submit" disabled={!token}>
          Reset Password
        </button>

        <div className="link-grid">
          <Link className="link" href="/forgot-password">
            Request a new link
          </Link>
        </div>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
