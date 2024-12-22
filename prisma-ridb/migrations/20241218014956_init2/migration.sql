/*
  Warnings:

  - You are about to drop the `Hashes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Hashes";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Hash" (
    "hash" BLOB NOT NULL,
    "hashType" INTEGER NOT NULL,
    "service" INTEGER NOT NULL,
    "id" INTEGER NOT NULL,

    PRIMARY KEY ("hash", "service", "hashType")
);

-- CreateTable
CREATE TABLE "ScraperEntry" (
    "service" INTEGER NOT NULL,
    "id" INTEGER NOT NULL,
    "md5" TEXT,
    "sha1" TEXT,

    PRIMARY KEY ("id", "service")
);

-- CreateTable
CREATE TABLE "Post" (
    "service" INTEGER NOT NULL,
    "id" INTEGER NOT NULL,
    "missing" BOOLEAN NOT NULL,
    "deleted" BOOLEAN NOT NULL,
    "image" TEXT,
    "thumbnailImage" TEXT,
    "rating" TEXT,
    "tags" TEXT,
    "artist" TEXT,
    "source" TEXT,
    "createdAt" TEXT,
    "ext" TEXT,
    "md5" TEXT,
    "sha1" TEXT,

    PRIMARY KEY ("id", "service")
);

-- CreateTable
CREATE TABLE "PostError" (
    "service" INTEGER NOT NULL,
    "id" INTEGER NOT NULL,
    "error" TEXT NOT NULL,

    PRIMARY KEY ("id", "service")
);
