export const GEMINI_API_KEY =
  import.meta.env.VITE_API_KEY ?? import.meta.env.VITE_GEMINI_API_KEY;
if (!GEMINI_API_KEY) throw new Error("VITE_API_KEY missing");
