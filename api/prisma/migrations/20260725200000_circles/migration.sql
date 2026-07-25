-- CreateEnum
CREATE TYPE "ChatScope" AS ENUM ('family', 'custom', 'congregation');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('admin', 'member');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "status" VARCHAR(140) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "chats" ADD COLUMN "scope" "ChatScope" NOT NULL DEFAULT 'custom',
  ADD COLUMN "created_by_user_id" UUID,
  ADD COLUMN "connection_id" UUID,
  ADD COLUMN "subset_key" TEXT;

-- AlterTable
ALTER TABLE "chat_participants" ADD COLUMN "role" "ChatRole" NOT NULL DEFAULT 'member';

-- Existing auto-created family rooms keep their special scope.
UPDATE "chats" SET "scope" = 'family' WHERE "type" = 'group' AND "name" = 'Family';

-- CreateIndex
CREATE UNIQUE INDEX "chats_connection_id_subset_key_key" ON "chats"("connection_id", "subset_key");

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chats" ADD CONSTRAINT "chats_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
