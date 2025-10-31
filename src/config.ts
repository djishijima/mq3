const env = import.meta.env;

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "string") {
    return value === "1" || value.toLowerCase() === "true";
  }
  return value === true;
};

export const GEMINI_API_KEY =
  env.VITE_API_KEY ?? env.VITE_GEMINI_API_KEY ?? "";

export const IS_AI_DISABLED =
  toBoolean(env.VITE_AI_OFF) ||
  toBoolean(env.VITE_NEXT_PUBLIC_AI_OFF) ||
  toBoolean(env.NEXT_PUBLIC_AI_OFF);

export const isGeminiConfigured = () => GEMINI_API_KEY.length > 0;
