/*
  Warnings:

  - Added the required column `currency` to the `p2ptransfer` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `p2ptransfer` ADD COLUMN `currency` VARCHAR(191) NOT NULL;
