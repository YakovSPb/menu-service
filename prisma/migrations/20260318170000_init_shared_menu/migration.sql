-- Create table for email-based identity across client apps
CREATE TABLE "UserRef" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserRef_pkey" PRIMARY KEY ("id")
);

-- Shared menu/recipe storage for all apps
CREATE TABLE "MenuItem" (
  "id" TEXT NOT NULL,
  "userRefId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "carbsPer100g" DOUBLE PRECISION NOT NULL,
  "caloriesPer100g" DOUBLE PRECISION NOT NULL,
  "proteinPer100g" DOUBLE PRECISION NOT NULL,
  "fatPer100g" DOUBLE PRECISION NOT NULL,
  "defaultPortionGrams" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "hasSugar" BOOLEAN NOT NULL DEFAULT false,
  "recipeText" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserRef_email_key" ON "UserRef"("email");
CREATE INDEX "MenuItem_userRefId_idx" ON "MenuItem"("userRefId");
CREATE INDEX "MenuItem_userRefId_name_idx" ON "MenuItem"("userRefId", "name");

ALTER TABLE "MenuItem"
ADD CONSTRAINT "MenuItem_userRefId_fkey"
FOREIGN KEY ("userRefId") REFERENCES "UserRef"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
