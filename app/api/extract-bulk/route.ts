import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeDOB } from "../../utils/date";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    // We now expect an array of raw strings
    const { texts } = await req.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
      You are a bulk data extraction assistant. The user will provide an array of unformatted text messages.
      Extract the details for EACH student and return a JSON ARRAY containing multiple objects.
      
      Strict Formatting Instructions:
      1. Capitalize the first letter of EVERY word for all names.
      2. For contact numbers, provide only the clean 10-digit numbers.
      3. Keep Aadhaar numbers uniformly formatted as 12 digits (e.g., "1234 5678 9012").
      4. Correct spelling for Indian addresses (e.g., "Prahaladhapuram").
      5. If a field is missing in a message, return "N/A" for that specific object.
      
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
      
      Messages to process:
      ${JSON.stringify(texts)}
    `;

    const result = await model.generateContent(prompt);
    const parsedDataArray = JSON.parse(result.response.text());

    if (Array.isArray(parsedDataArray)) {
      for (const item of parsedDataArray) {
        if (item && typeof item.dob === "string") {
          item.dob = normalizeDOB(item.dob);
        }
      }
    }

    return NextResponse.json({ success: true, data: parsedDataArray });

  } catch (error) {
    console.error("Bulk Extraction error:", error);
    return NextResponse.json({ error: "Failed to extract data" }, { status: 500 });
  }
}
