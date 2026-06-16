import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeDOB } from "../../utils/date";

// Gather all keys from the environment variables into an array, removing duplicates and undefined values
const apiKeys = Array.from(
  new Set([
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY,
  ].filter(Boolean))
) as string[];

export async function POST(req: Request) {
  try {
    const { items } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

    const promptParts = items.map((item: any) => {
      if (item.type === "image") {
        return {
          inlineData: {
            data: item.base64,
            mimeType: item.mimeType,
          },
        };
      }
      return `Text Message: ${item.text}`;
    });

    const systemInstruction = `
      You are a bulk data extraction assistant. The user will provide a mix of text messages and images (which may contain handwritten notes or screenshots of forms).
      Extract the details for EACH student found in the texts and images, and return a JSON ARRAY containing multiple objects.
      
      Strict Formatting Instructions:
      1. Capitalize the first letter of EVERY word for all names.
      2. For contact numbers, provide only the clean 10-digit numbers.
      3. Keep Aadhaar numbers uniformly formatted as 12 digits (e.g., "1234 5678 9012").
      4. Correct spelling for Indian addresses (e.g., "Prahaladhapuram").
      5. If a field is missing or illegible in the handwriting, return "N/A" for that specific field.
      
      CRITICAL: You MUST return a valid JSON ARRAY of objects.
      Array Schema:
      [
        {
          "childName": "string",
          "dob": "string",
          "caste": "string",
          "childAadhaar": "string",
          "fatherName": "string",
          "fatherContact": "string",
          "fatherWhatsapp": "string",
          "fatherAadhaar": "string",
          "motherName": "string",
          "motherWhatsapp": "string",
          "motherContact": "string",
          "motherAadhaar": "string",
          "address": "string",
          "transportMode": "string",
          "autoDriverName": "string",
          "autoDriverContact": "string"
        }
      ]
    `;

    let lastError: any = null;

    if (apiKeys.length === 0) {
      return NextResponse.json(
        { error: "No Gemini API keys configured. Please check your .env.local file." },
        { status: 500 }
      );
    }

    // THE ROTATION LOOP: Try each key one by one
    for (let i = 0; i < apiKeys.length; i++) {
      try {
        console.log(`Attempting extraction with API Key ${i + 1}...`);
        
        // Initialize Gemini specifically with the current key in the loop
        const genAI = new GoogleGenerativeAI(apiKeys[i]);
        const model = genAI.getGenerativeModel({
          model: "gemini-3.5-flash",
          generationConfig: {
            responseMimeType: "application/json",
          },
        });

        // Fire the request
        const result = await model.generateContent([systemInstruction, ...promptParts]);
        const parsedDataArray = JSON.parse(result.response.text());

        // Normalize extracted date formats (DOB) if successfully parsed
        if (Array.isArray(parsedDataArray)) {
          for (const item of parsedDataArray) {
            if (item && typeof item.dob === "string") {
              item.dob = normalizeDOB(item.dob);
            }
          }
        }

        // If successful, immediately return the data and break out of the loop
        return NextResponse.json({ success: true, data: parsedDataArray });

      } catch (error) {
        console.warn(`API Key ${i + 1} failed. Moving to next key if available.`);
        lastError = error;
        // The loop continues to the next key automatically
      }
    }

    // If the code reaches here, ALL keys in the array failed.
    console.error("All API keys exhausted. Final error:", lastError);
    return NextResponse.json(
      { error: "Servers are busy. Please wait a moment and try again." }, 
      { status: 500 }
    );

  } catch (error) {
    console.error("Payload processing error:", error);
    return NextResponse.json({ error: "Failed to process request data" }, { status: 400 });
  }
}
