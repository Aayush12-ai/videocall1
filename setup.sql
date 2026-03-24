-- Run this in your local PostgreSQL database to set up the schema.
-- Replace "videocall" below with whatever database name you created.

CREATE TABLE IF NOT EXISTS "rooms" (
  "id"         TEXT        PRIMARY KEY,
  "host_name"  TEXT        NOT NULL,
  "password"   TEXT        NOT NULL,
  "created_at" TIMESTAMP   NOT NULL DEFAULT NOW()
);
