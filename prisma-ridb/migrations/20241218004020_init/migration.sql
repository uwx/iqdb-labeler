-- CreateTable
CREATE TABLE "Cursor" (
    "serviceName" TEXT NOT NULL PRIMARY KEY,
    "cursorId" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Hashes" (
    "service" INTEGER NOT NULL,
    "id" INTEGER NOT NULL,
    "hashType" INTEGER NOT NULL,
    "hash" BLOB NOT NULL,

    PRIMARY KEY ("service", "id", "hashType")
);
