-- Setup wizard "Try with sample data": sample records are tagged so they can be removed in one click.
ALTER TABLE "contacts" ADD COLUMN "is_sample" BOOLEAN NOT NULL DEFAULT false;
ALTER TYPE "record_source" ADD VALUE IF NOT EXISTS 'sample';
