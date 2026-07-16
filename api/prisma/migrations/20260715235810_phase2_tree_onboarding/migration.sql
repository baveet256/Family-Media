-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('parent_of', 'spouse_of', 'sibling_of');

-- CreateEnum
CREATE TYPE "RelationshipSource" AS ENUM ('onboarding', 'admin', 'inferred');

-- CreateTable
CREATE TABLE "persons" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "user_id" UUID,
    "display_name" TEXT NOT NULL,
    "phone" TEXT,
    "birth_date" DATE,
    "death_date" DATE,
    "gender" TEXT,
    "avatar_url" TEXT,
    "is_placeholder" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationships" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "from_person_id" UUID NOT NULL,
    "to_person_id" UUID NOT NULL,
    "type" "RelationshipType" NOT NULL,
    "source" "RelationshipSource" NOT NULL DEFAULT 'onboarding',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_answers" (
    "id" UUID NOT NULL,
    "join_request_id" UUID NOT NULL,
    "question_key" TEXT NOT NULL,
    "answer_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "persons_family_id_idx" ON "persons"("family_id");

-- CreateIndex
CREATE INDEX "persons_user_id_idx" ON "persons"("user_id");

-- CreateIndex
CREATE INDEX "relationships_family_id_type_idx" ON "relationships"("family_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "relationships_family_id_from_person_id_to_person_id_type_key" ON "relationships"("family_id", "from_person_id", "to_person_id", "type");

-- CreateIndex
CREATE INDEX "onboarding_answers_join_request_id_idx" ON "onboarding_answers"("join_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_answers_join_request_id_question_key_key" ON "onboarding_answers"("join_request_id", "question_key");

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "persons" ADD CONSTRAINT "persons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_from_person_id_fkey" FOREIGN KEY ("from_person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_to_person_id_fkey" FOREIGN KEY ("to_person_id") REFERENCES "persons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_answers" ADD CONSTRAINT "onboarding_answers_join_request_id_fkey" FOREIGN KEY ("join_request_id") REFERENCES "join_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
