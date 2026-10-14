import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load server/.env first (authoritative backend config)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 2. Fallback to workspace root .env if present
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: false });

// 3. Fallback to client/.env for any frontend-shared keys (e.g. AI keys)
if (!process.env.GROQ_API_KEY && !process.env.VITE_GROQ_API_KEY) {
  dotenv.config({ path: path.resolve(__dirname, '../../client/.env'), override: false });
}
