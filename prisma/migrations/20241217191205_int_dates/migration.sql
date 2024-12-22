/*
  Warnings:

  - You are about to alter the column `cts` on the `Label` table. The data in that column could be lost. The data in that column will be cast from `DateTime` to `BigInt`.
  - You are about to alter the column `exp` on the `Label` table. The data in that column could be lost. The data in that column will be cast from `DateTime` to `BigInt`.
  - You are about to alter the column `createdAt` on the `Tag` table. The data in that column could be lost. The data in that column will be cast from `DateTime` to `BigInt`.
  - You are about to alter the column `updatedAt` on the `Tag` table. The data in that column could be lost. The data in that column will be cast from `DateTime` to `BigInt`.
  - You are about to alter the column `createdAt` on the `TagAlias` table. The data in that column could be lost. The data in that column will be cast from `DateTime` to `BigInt`.
  - You are about to alter the column `updatedAt` on the `TagAlias` table. The data in that column could be lost. The data in that column will be cast from `DateTime` to `BigInt`.
  - You are about to alter the column `createdAt` on the `TagImplication` table. The data in that column could be lost. The data in that column will be cast from `DateTime` to `BigInt`.
  - You are about to alter the column `updatedAt` on the `TagImplication` table. The data in that column could be lost. The data in that column will be cast from `DateTime` to `BigInt`.
  - You are about to alter the column `createdAt` on the `WikiPage` table. The data in that column could be lost. The data in that column will be cast from `DateTime` to `BigInt`.
  - You are about to alter the column `updatedAt` on the `WikiPage` table. The data in that column could be lost. The data in that column will be cast from `DateTime` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Label" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "src" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "cid" TEXT,
    "val" TEXT NOT NULL,
    "neg" BOOLEAN DEFAULT false,
    "cts" BIGINT NOT NULL,
    "exp" BIGINT,
    "sig" BLOB NOT NULL
);
INSERT INTO "new_Label" ("cid", "cts", "exp", "id", "neg", "sig", "src", "uri", "val") SELECT "cid", "cts", "exp", "id", "neg", "sig", "src", "uri", "val" FROM "Label";
DROP TABLE "Label";
ALTER TABLE "new_Label" RENAME TO "Label";
CREATE INDEX "Label_val_idx" ON "Label"("val");
CREATE TABLE "new_Tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "words" TEXT,
    "isDeprecated" BOOLEAN,
    "updatedAt" BIGINT,
    "createdAt" BIGINT,
    "category" INTEGER,
    "postCount" INTEGER
);
INSERT INTO "new_Tag" ("category", "createdAt", "id", "isDeprecated", "name", "postCount", "updatedAt", "words") SELECT "category", "createdAt", "id", "isDeprecated", "name", "postCount", "updatedAt", "words" FROM "Tag";
DROP TABLE "Tag";
ALTER TABLE "new_Tag" RENAME TO "Tag";
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");
CREATE INDEX "Tag_name_idx" ON "Tag"("name");
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
    "consequentName" TEXT,
    CONSTRAINT "TagAlias_consequentName_fkey" FOREIGN KEY ("consequentName") REFERENCES "Tag" ("name") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TagAlias" ("antecedentName", "approverId", "consequentName", "createdAt", "creatorId", "forumPostId", "forumTopicId", "id", "reason", "status", "updatedAt") SELECT "antecedentName", "approverId", "consequentName", "createdAt", "creatorId", "forumPostId", "forumTopicId", "id", "reason", "status", "updatedAt" FROM "TagAlias";
DROP TABLE "TagAlias";
ALTER TABLE "new_TagAlias" RENAME TO "TagAlias";
CREATE INDEX "TagAlias_antecedentName_idx" ON "TagAlias"("antecedentName");
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
    "consequentName" TEXT,
    CONSTRAINT "TagImplication_consequentName_fkey" FOREIGN KEY ("consequentName") REFERENCES "Tag" ("name") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TagImplication_antecedentName_fkey" FOREIGN KEY ("antecedentName") REFERENCES "Tag" ("name") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TagImplication" ("antecedentName", "approverId", "consequentName", "createdAt", "creatorId", "forumPostId", "forumTopicId", "id", "reason", "status", "updatedAt") SELECT "antecedentName", "approverId", "consequentName", "createdAt", "creatorId", "forumPostId", "forumTopicId", "id", "reason", "status", "updatedAt" FROM "TagImplication";
DROP TABLE "TagImplication";
ALTER TABLE "new_TagImplication" RENAME TO "TagImplication";
CREATE TABLE "new_WikiPage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "body" TEXT,
    "otherNames" TEXT NOT NULL,
    "isDeleted" BOOLEAN,
    "isLocked" BOOLEAN,
    "updatedAt" BIGINT,
    "createdAt" BIGINT
);
INSERT INTO "new_WikiPage" ("body", "createdAt", "id", "isDeleted", "isLocked", "otherNames", "title", "updatedAt") SELECT "body", "createdAt", "id", "isDeleted", "isLocked", "otherNames", "title", "updatedAt" FROM "WikiPage";
DROP TABLE "WikiPage";
ALTER TABLE "new_WikiPage" RENAME TO "WikiPage";
CREATE INDEX "WikiPage_title_idx" ON "WikiPage"("title");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
