-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'BUSINESS',
    "scopeId" TEXT NOT NULL DEFAULT '',
    "value" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Setting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Setting" ("businessId", "id", "key", "scopeId", "scopeType", "updatedAt", "value") SELECT "businessId", "id", "key", coalesce("scopeId", '') AS "scopeId", "scopeType", "updatedAt", "value" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
CREATE INDEX "Setting_businessId_idx" ON "Setting"("businessId");
CREATE UNIQUE INDEX "Setting_businessId_key_scopeType_scopeId_key" ON "Setting"("businessId", "key", "scopeType", "scopeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
