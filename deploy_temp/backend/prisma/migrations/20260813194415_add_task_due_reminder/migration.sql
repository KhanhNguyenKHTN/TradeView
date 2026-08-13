-- AlterTable
ALTER TABLE `tasks` ADD COLUMN `dueReminderSentAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `tasks_dueReminderSentAt_dueDate_idx` ON `tasks`(`dueReminderSentAt`, `dueDate`);
