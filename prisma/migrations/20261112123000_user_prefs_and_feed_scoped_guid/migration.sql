-- DropIndex
DROP INDEX "articles_guid_key";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT,
    "nickname" TEXT,
    "avatar" TEXT,
    "bio" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "email_verified" DATETIME,
    "phone_verified" DATETIME,
    "kindle_email" TEXT,
    "notify_new_articles" BOOLEAN NOT NULL DEFAULT true,
    "email_digest" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_users" ("avatar", "bio", "created_at", "email", "email_verified", "id", "kindle_email", "nickname", "password_hash", "phone", "phone_verified", "status", "updated_at") SELECT "avatar", "bio", "created_at", "email", "email_verified", "id", "kindle_email", "nickname", "password_hash", "phone", "phone_verified", "status", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "articles_link_idx" ON "articles"("link");

-- CreateIndex
CREATE UNIQUE INDEX "articles_feed_id_guid_key" ON "articles"("feed_id", "guid");

