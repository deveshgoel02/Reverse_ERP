-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "salesmanId" TEXT;

-- CreateTable
CREATE TABLE "Salesman" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Salesman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Allotment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "salesmanId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "targetQuantity" INTEGER NOT NULL,
    "incentiveAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deadlineDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Allotment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Salesman_businessId_idx" ON "Salesman"("businessId");

-- CreateIndex
CREATE INDEX "Allotment_businessId_idx" ON "Allotment"("businessId");

-- CreateIndex
CREATE INDEX "Allotment_salesmanId_idx" ON "Allotment"("salesmanId");

-- CreateIndex
CREATE INDEX "Allotment_businessId_deadlineDate_idx" ON "Allotment"("businessId", "deadlineDate");

-- CreateIndex
CREATE INDEX "Sale_salesmanId_idx" ON "Sale"("salesmanId");

-- AddForeignKey
ALTER TABLE "Salesman" ADD CONSTRAINT "Salesman_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allotment" ADD CONSTRAINT "Allotment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allotment" ADD CONSTRAINT "Allotment_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "Salesman"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allotment" ADD CONSTRAINT "Allotment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Allotment" ADD CONSTRAINT "Allotment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_salesmanId_fkey" FOREIGN KEY ("salesmanId") REFERENCES "Salesman"("id") ON DELETE SET NULL ON UPDATE CASCADE;
