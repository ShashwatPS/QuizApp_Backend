-- CreateTable
CREATE TABLE "teams" (
    "team_name" TEXT NOT NULL,
    "team_password" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("team_name")
);

-- CreateTable
CREATE TABLE "users" (
    "EnrollNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("EnrollNo")
);

-- CreateTable
CREATE TABLE "questions" (
    "question_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_description" TEXT NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "team_progress" (
    "progress_id" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL,
    "solved_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_progress_pkey" PRIMARY KEY ("progress_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_progress_team_name_question_id_key" ON "team_progress"("team_name", "question_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_team_name_fkey" FOREIGN KEY ("team_name") REFERENCES "teams"("team_name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_progress" ADD CONSTRAINT "team_progress_team_name_fkey" FOREIGN KEY ("team_name") REFERENCES "teams"("team_name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_progress" ADD CONSTRAINT "team_progress_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("question_id") ON DELETE RESTRICT ON UPDATE CASCADE;
