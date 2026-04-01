-- Add missing userEmail column for existing production table.
ALTER TABLE "MenuItem"
ADD COLUMN IF NOT EXISTS "userEmail" TEXT;

-- Keep list and lookup queries fast by email.
CREATE INDEX IF NOT EXISTS "MenuItem_userEmail_idx" ON "MenuItem"("userEmail");
CREATE INDEX IF NOT EXISTS "MenuItem_userEmail_name_idx" ON "MenuItem"("userEmail", "name");
