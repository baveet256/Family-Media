-- CreateEnum
CREATE TYPE "OccasionType" AS ENUM ('anniversary', 'custom');

-- CreateTable
CREATE TABLE "occasions" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "type" "OccasionType" NOT NULL,
    "title" TEXT,
    "date" DATE NOT NULL,
    "person_a_id" UUID,
    "person_b_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "occasions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "occasions_family_id_idx" ON "occasions"("family_id");

-- AddForeignKey
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_person_a_id_fkey" FOREIGN KEY ("person_a_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_person_b_id_fkey" FOREIGN KEY ("person_b_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "occasions" ADD CONSTRAINT "occasions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
