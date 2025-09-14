import { GoogleGenAI } from "@google/genai";
import { Tone } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const systemInstruction = `You are an expert thought translator. Your task is to take any user input—fragmented sentences, broken grammar, slang, multilingual text, or messy thoughts—and rewrite it into clear, natural, and fluent text in a specified output language. You must adhere to the following rules strictly:
1.  **Preserve Core Meaning:** The rewritten text must have the exact same meaning, intent, and nuance as the original. Do not add any new information, ideas, or interpretations.
2.  **Match Tone and Style:** Mirror the original tone (e.g., informal, humorous, professional). If the user uses slang, keep the conversational feel but make it understandable. The desired tone is specified by the user.
3.  **Specified Language Output:** Always provide the output in the language specified by the user. If the input is in that language, refine it in the same language.
4.  **Maintain Flow:** The length and structure should be similar to the original input. Do not expand short thoughts into long paragraphs or condense long sentences unnecessarily.
5.  **Silent Correction:** Correct all spelling, grammar, and punctuation errors silently without drawing attention to them.
6.  **Clarification:** If the user's input is too ambiguous or nonsensical to understand, respond ONLY with the phrase: "I'm not quite sure what you mean. Could you please provide a little more detail?"
7.  **Direct Output:** Your entire response should ONLY be the refined text. Do not include any preambles, apologies, or explanations like "Here is the refined version:".`;

export async function translateThought(text: string, tone: Tone, language: string, onChunk: (chunk: string) => void): Promise<string> {
  if (!text.trim()) {
    return "";
  }
  
  const userPrompt = `Tone: ${tone}\nOutput Language: ${language}\nTranslate the following thought:\n---\n${text}`;

  try {
    const responseStream = await ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
            topP: 0.95,
            thinkingConfig: { thinkingBudget: 0 },
        }
    });

    let fullResponse = "";
    for await (const chunk of responseStream) {
        const chunkText = chunk.text;
        if(chunkText) {
            fullResponse += chunkText;
            onChunk(chunkText);
        }
    }
    return fullResponse.trim();

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Sorry, something went wrong while translating. Please try again.");
  }
}
