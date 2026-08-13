-- AlterTable
ALTER TABLE `tasks` ADD COLUMN `financialCurrentAmount` DECIMAL(20, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `financialTargetAmount` DECIMAL(20, 2) NOT NULL DEFAULT 0;
