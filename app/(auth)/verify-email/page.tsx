'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { verifyEmailSchema, zodErrors } from '@/lib/validation/authSchemas';

type FieldErrors = Record<string, string>;

function VerifyEmailForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [code, setCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sentMessage, setSentMessage] = useState('');

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSuccess(false);

    const parsed = verifyEmailSchema.safeParse({ email, code });
    if (!parsed.success) {
      setFieldErrors(zodErrors(parsed.error));
      return;
    }

    const res = await fetch('/api/auth/verify-email', {
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

  async function handleResend() {
    setFormError('');
    setSentMessage('');
    const parsed = verifyEmailSchema.pick({ email: true }).safeParse({ email });
    if (!parsed.success) {
      setFieldErrors({ email: parsed.error.issues[0]?.message ?? 'Enter a valid email.' });
      return;
    }

    const res = await fetch('/api/auth/resend-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      setSentMessage(data.message ?? 'Could not resend a code.');
      return;
    }
    setSentMessage(data.devCode ? `New code: ${data.devCode}` : 'A new code was sent.');
  }

  if (success) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Email verified</h1>
          <p className="auth-subtitle">You can now sign in.</p>
          <Link className="link" href="/signin">
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleVerify} noValidate>
        <h1 className="auth-title">Verify your email</h1>
        <p className="auth-subtitle">Enter the 6-digit code we sent you.</p>

        {formError ? <div className="alert alert-error">{formError}</div> : null}

        <div className="field">
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={`input ${fieldErrors.email ? 'input-error' : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {fieldErrors.email ? <span className="error-text">{fieldErrors.email}</span> : null}
        </div>

        <div className="field">
          <label className="label" htmlFor="code">
            Verification code
          </label>
          <input
            id="code"
            inputMode="numeric"
            maxLength={6}
            className={`input ${fieldErrors.code ? 'input-error' : ''}`}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            autoComplete="one-time-code"
          />
          {fieldErrors.code ? <span className="error-text">{fieldErrors.code}</span> : null}
        </div>

        <button className="button" type="submit">
          Verify
        </button>

        {sentMessage ? <div className="alert alert-success">{sentMessage}</div> : null}

        <div className="link-grid">
          <button
            className="button button-secondary"
            type="button"
            onClick={handleResend}
          >
            Resend code
          </button>
          <Link className="link" href="/signin">
            Back to sign in
          </Link>
        </div>
      </form>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
