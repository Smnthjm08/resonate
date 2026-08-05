import dotenv from "dotenv";

// root. import.meta.dir is apps/server/src, so ../../.. is the repo root.
dotenv.config({ path: `${import.meta.dir}/../../../.env` });
