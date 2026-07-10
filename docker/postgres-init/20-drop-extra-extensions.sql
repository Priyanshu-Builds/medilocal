-- The postgis/postgis image pre-installs extensions the app doesn't use
-- (tiger geocoder, topology, fuzzystrmatch) and postgis itself. Prisma
-- migrations own our extensions (postgis, pg_trgm), so drop the image's
-- copies to keep `prisma migrate dev` drift-free on fresh volumes.
-- Runs after the image's own 10_postgis.sh during first initdb.
DROP EXTENSION IF EXISTS postgis_tiger_geocoder CASCADE;
DROP EXTENSION IF EXISTS postgis_topology CASCADE;
DROP EXTENSION IF EXISTS fuzzystrmatch CASCADE;
DROP EXTENSION IF EXISTS postgis CASCADE;
DROP SCHEMA IF EXISTS tiger CASCADE;
DROP SCHEMA IF EXISTS tiger_data CASCADE;
DROP SCHEMA IF EXISTS topology CASCADE;
