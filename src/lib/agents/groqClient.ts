import { ChatGroq } from "@langchain/groq";

export function getGroqModel() {
  if (!process.env.GROQ_API_KEY) return null;

  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    temperature: 0
  });
}
