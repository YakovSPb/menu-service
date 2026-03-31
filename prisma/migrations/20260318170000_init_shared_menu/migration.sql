-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "carbsPer100g" DOUBLE PRECISION NOT NULL,
    "caloriesPer100g" DOUBLE PRECISION,
    "defaultPortionGrams" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "proteinPer100g" DOUBLE PRECISION,
    "fatPer100g" DOUBLE PRECISION,
    "recipeText" TEXT,
    "barcode" TEXT,
    "barcodeAliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MenuItem_userEmail_idx" ON "MenuItem"("userEmail");

-- CreateIndex
CREATE INDEX "MenuItem_userEmail_name_idx" ON "MenuItem"("userEmail", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItem_userEmail_barcode_key" ON "MenuItem"("userEmail", "barcode");
