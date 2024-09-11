-- CreateTable
CREATE TABLE "Team" (
    "team_name" TEXT NOT NULL,
    "team_password" TEXT NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("team_name")
);

-- CreateTable
CREATE TABLE "User" (
    "EnrollNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("EnrollNo")
);

-- CreateTable
CREATE TABLE "Question" (
    "question_id" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_description" TEXT NOT NULL,
    "answer" TEXT NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "TeamProgress" (
    "progress_id" TEXT NOT NULL,
    "team_name" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL,
    "solved_at" TIMESTAMP(3),

    CONSTRAINT "TeamProgress_pkey" PRIMARY KEY ("progress_id")
);

-- CreateTable
CREATE TABLE "Hint" (
    "id" TEXT NOT NULL,
    "hintText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamProgress_team_name_question_id_key" ON "TeamProgress"("team_name", "question_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_team_name_fkey" FOREIGN KEY ("team_name") REFERENCES "Team"("team_name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamProgress" ADD CONSTRAINT "TeamProgress_team_name_fkey" FOREIGN KEY ("team_name") REFERENCES "Team"("team_name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamProgress" ADD CONSTRAINT "TeamProgress_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "Question"("question_id") ON DELETE RESTRICT ON UPDATE CASCADE;
