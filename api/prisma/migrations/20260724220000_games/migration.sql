-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('family_awards', 'caption_battle');

-- CreateEnum
CREATE TYPE "GameRoundStatus" AS ENUM ('submitting', 'voting', 'closed');

-- CreateTable
CREATE TABLE "game_rounds" (
    "id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "type" "GameType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "photo_url" TEXT,
    "status" "GameRoundStatus" NOT NULL DEFAULT 'voting',
    "closes_at" TIMESTAMPTZ(6) NOT NULL,
    "closed_at" TIMESTAMPTZ(6),
    "winner_entry_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_entries" (
    "id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "subject_user_id" UUID NOT NULL,
    "text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_votes" (
    "round_id" UUID NOT NULL,
    "voter_user_id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_votes_pkey" PRIMARY KEY ("round_id","voter_user_id")
);

-- CreateIndex
CREATE INDEX "game_rounds_family_id_created_at_idx" ON "game_rounds"("family_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "game_rounds_family_id_status_idx" ON "game_rounds"("family_id", "status");

-- CreateIndex
CREATE INDEX "game_entries_round_id_idx" ON "game_entries"("round_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_entries_round_id_subject_user_id_key" ON "game_entries"("round_id", "subject_user_id");

-- CreateIndex
CREATE INDEX "game_votes_entry_id_idx" ON "game_votes"("entry_id");

-- AddForeignKey
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_rounds" ADD CONSTRAINT "game_rounds_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_entries" ADD CONSTRAINT "game_entries_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "game_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_entries" ADD CONSTRAINT "game_entries_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_votes" ADD CONSTRAINT "game_votes_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "game_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_votes" ADD CONSTRAINT "game_votes_voter_user_id_fkey" FOREIGN KEY ("voter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_votes" ADD CONSTRAINT "game_votes_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "game_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
