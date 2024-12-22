-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT
);

-- CreateTable
CREATE TABLE "Match" (
    "url" TEXT NOT NULL PRIMARY KEY,
    "similarity" REAL,
    "md5" TEXT,
    "sha1" TEXT,
    "sha256" TEXT,
    "rating" TEXT,
    "sourceUrl" TEXT,
    "pixivId" INTEGER,
    "fileSize" INTEGER,
    "tags" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Follower" (
    "did" TEXT NOT NULL PRIMARY KEY,
    "rkey" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Liker" (
    "did" TEXT NOT NULL PRIMARY KEY,
    "rkey" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Label" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "src" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "cid" TEXT,
    "val" TEXT NOT NULL,
    "neg" BOOLEAN DEFAULT false,
    "cts" DATETIME NOT NULL,
    "exp" DATETIME,
    "sig" BLOB NOT NULL
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT,
    "words" TEXT NOT NULL,
    "isDeprecated" BOOLEAN,
    "updatedAt" DATETIME,
    "createdAt" DATETIME,
    "category" INTEGER,
    "postCount" INTEGER
);

-- CreateTable
CREATE TABLE "WikiPage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT,
    "body" TEXT,
    "otherNames" TEXT NOT NULL,
    "isDeleted" BOOLEAN,
    "isLocked" BOOLEAN,
    "updatedAt" DATETIME,
    "createdAt" DATETIME
);

-- CreateTable
CREATE TABLE "TagImplication" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "forumPostId" INTEGER,
    "forumTopicId" INTEGER,
    "approverId" INTEGER,
    "creatorId" INTEGER,
    "updatedAt" DATETIME,
    "createdAt" DATETIME,
    "status" TEXT,
    "reason" TEXT,
    "antecedentName" TEXT,
    "consequentName" TEXT,
    CONSTRAINT "TagImplication_consequentName_fkey" FOREIGN KEY ("consequentName") REFERENCES "Tag" ("name") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "TagImplication_antecedentName_fkey" FOREIGN KEY ("antecedentName") REFERENCES "Tag" ("name") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TagAlias" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "forumPostId" INTEGER,
    "forumTopicId" INTEGER,
    "approverId" INTEGER,
    "creatorId" INTEGER,
    "updatedAt" DATETIME,
    "createdAt" DATETIME,
    "status" TEXT,
    "reason" TEXT,
    "antecedentName" TEXT,
    "consequentName" TEXT,
    CONSTRAINT "TagAlias_consequentName_fkey" FOREIGN KEY ("consequentName") REFERENCES "Tag" ("name") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Follower_rkey_idx" ON "Follower"("rkey");

-- CreateIndex
CREATE INDEX "Liker_rkey_idx" ON "Liker"("rkey");

-- CreateIndex
CREATE INDEX "Label_val_idx" ON "Label"("val");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "WikiPage_title_idx" ON "WikiPage"("title");

-- CreateIndex
CREATE INDEX "TagAlias_antecedentName_idx" ON "TagAlias"("antecedentName");
