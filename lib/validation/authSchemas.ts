import { z } from 'zod';
import { PASSWORD_MAX_BYTES } from '@/lib/auth/password';

// R1.2 — One shared Zod schema set, used by BOTH the client pages and the
// server route handlers. There is deliberately no second validation
// implementation on either side, so client and server agree on the rules.
// The client may use these for instant feedback; the server never trusts it.

export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254, 'Email is too long');

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(PASSWORD_MAX_BYTES, `Password must be at most ${PASSWORD_MAX_BYTES} characters`);

export const nameSchema = z
  .string({ required_error: 'Name is required' })
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be at most 50 characters');

export const codeSchema = z
  .string({ required_error: 'Verification code is required' })
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

export const resetTokenSchema = z
  .string({ required_error: 'Reset token is required' })
  .min(1);

export const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const signinSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: resetTokenSchema,
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: codeSchema,
});

export const resendCodeSchema = z.object({
  email: emailSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendCodeInput = z.infer<typeof resendCodeSchema>;

// Convert a ZodError into a flat { field: message } map for the client.
export function zodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path[0];
    if (typeof path === 'string' && !out[path]) {
      out[path] = issue.message;
    }
  }
  return out;
}
