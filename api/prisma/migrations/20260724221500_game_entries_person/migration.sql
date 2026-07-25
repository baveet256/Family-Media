-- Nominees are people on the family tree rather than app users, so relatives
-- without an account can still be nominated (and win) in Family Awards.
ALTER TABLE "game_entries" DROP CONSTRAINT "game_entries_subject_user_id_fkey";

-- DropIndex
DROP INDEX "game_entries_round_id_subject_user_id_key";

-- AlterTable
ALTER TABLE "game_entries" DROP COLUMN "subject_user_id";
ALTER TABLE "game_entries" ADD COLUMN "person_id" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "game_entries_round_id_person_id_key" ON "game_entries"("round_id", "person_id");

-- AddForeignKey
ALTER TABLE "game_entries" ADD CONSTRAINT "game_entries_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
