-- Add unique constraint on PasswordResetToken.tokenHash
-- Enables R1.7 (single-use token) to be looked up uniquely by its hash.
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
