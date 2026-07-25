-- AlterTable
ALTER TABLE "connection_invites" ADD COLUMN "from_person_id" UUID;

-- AddForeignKey
ALTER TABLE "connection_invites" ADD CONSTRAINT "connection_invites_from_person_id_fkey" FOREIGN KEY ("from_person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
