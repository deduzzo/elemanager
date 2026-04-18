-- 0006_sezioni_lat_lng_double_precision.sql
-- Cambia lat/lng da numeric(9,6) a double precision per preservare la
-- precisione completa dei CSV (il dataset Messina ha fino a 7 decimali).
-- double precision = IEEE 754 64-bit, ~15-17 cifre significative, lossless per coord geografiche.

ALTER TABLE elemanager.sezioni
  ALTER COLUMN lat TYPE double precision USING lat::double precision,
  ALTER COLUMN lng TYPE double precision USING lng::double precision;
