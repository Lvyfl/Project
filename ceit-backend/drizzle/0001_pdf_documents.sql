-- Migration: store uploaded PDFs in Vercel Blob

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "pdf_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "filename" text NOT NULL,
  "mimetype" text NOT NULL,
  "size" integer NOT NULL,
  "url" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pdf_documents_created_at_idx" ON "pdf_documents" ("created_at" DESC);
