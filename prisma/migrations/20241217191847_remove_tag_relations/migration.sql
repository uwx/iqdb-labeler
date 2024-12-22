-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TagAlias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "forumPostId" INTEGER,
    "forumTopicId" INTEGER,
    "approverId" INTEGER,
    "creatorId" INTEGER,
    "updatedAt" BIGINT,
    "createdAt" BIGINT,
    "status" TEXT,
    "reason" TEXT,
    "antecedentName" TEXT,
    "consequentName" TEXT
);
INSERT INTO "new_TagAlias" ("antecedentName", "approverId", "consequentName", "createdAt", "creatorId", "forumPostId", "forumTopicId", "id", "reason", "status", "updatedAt") SELECT "antecedentName", "approverId", "consequentName", "createdAt", "creatorId", "forumPostId", "forumTopicId", "id", "reason", "status", "updatedAt" FROM "TagAlias";
DROP TABLE "TagAlias";
ALTER TABLE "new_TagAlias" RENAME TO "TagAlias";
CREATE INDEX "TagAlias_antecedentName_idx" ON "TagAlias"("antecedentName");
CREATE INDEX "TagAlias_consequentName_idx" ON "TagAlias"("consequentName");
CREATE TABLE "new_TagImplication" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "forumPostId" INTEGER,
    "forumTopicId" INTEGER,
    "approverId" INTEGER,
    "creatorId" INTEGER,
    "updatedAt" BIGINT,
    "createdAt" BIGINT,
    "status" TEXT,
    "reason" TEXT,
    "antecedentName" TEXT,
    "consequentName" TEXT
);
INSERT INTO "new_TagImplication" ("antecedentName", "approverId", "consequentName", "createdAt", "creatorId", "forumPostId", "forumTopicId", "id", "reason", "status", "updatedAt") SELECT "antecedentName", "approverId", "consequentName", "createdAt", "creatorId", "forumPostId", "forumTopicId", "id", "reason", "status", "updatedAt" FROM "TagImplication";
DROP TABLE "TagImplication";
ALTER TABLE "new_TagImplication" RENAME TO "TagImplication";
CREATE INDEX "TagImplication_antecedentName_idx" ON "TagImplication"("antecedentName");
CREATE INDEX "TagImplication_consequentName_idx" ON "TagImplication"("consequentName");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
