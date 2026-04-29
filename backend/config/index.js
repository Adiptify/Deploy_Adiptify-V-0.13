import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

export const config = {
    port: process.env.PORT || 4000,
    mongoUri: process.env.MONGO_URI || "mongodb://localhost:27017/adiptify",
    mongoDb: process.env.MONGO_DB || "adiptify",
    jwtSecret: process.env.JWT_SECRET || "adiptify-casestudy1-secret-key-2026",
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL || "deepseek-v3.1:671b-cloud",
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
};

export default config;
