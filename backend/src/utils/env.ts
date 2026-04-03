import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z
    .string()
    .default("5000")
    .transform((val) => Number(val)),
  MODEL_PROVIDER: z.enum(["openai", "groq","mistral"]),
  EMBEDDING_PROVIDER: z.enum(["openai", "groq", "gemini","mistral"]),
  

  OPENAI_API_KEY: z.string().min(1, "openai api key is missing"),
   MISTRAL_API_KEY: z.string().min(1, "mistrai api key is missing"),
  GROQ_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1, "gemini api key is missing"),
 

  OPENAI_MODEL: z.string(),
  GROQ_MODEL: z.string(),
  OPENAI_EMBEDDING_MODEL: z.string(),
  MONGODB_URI: z.string().min(1, "mongodb uri is missing"),
  MONGODB_DB_NAME: z.string().min(1, "MONGODB DB_NAME is required"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.log(parsed.error.format())
  console.log("Invalid environment configuration");
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
