import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
      You are an intelligent data extraction assistant. The user will provide a messy, unformatted text message from a parent containing student details. 
      Extract the information and return ONLY a JSON object. If a field is missing, return "N/A".
      
      Strict Formatting Instructions:
      1. Capitalize the first letter of EVERY word for all names.
      2. For contact numbers, strip out any trailing text like "(wtsp)" and provide only the clean 10-digit phone numbers.
      3. Keep Aadhaar numbers uniformly formatted as 12 digits separated by standard single spaces.
      4. Carefully extract separate regular and WhatsApp numbers if indicated.
      5. ADDRESS VALIDATION (CRITICAL): Act as an Indian geography expert. Analyze the provided address and correct any spelling mistakes to ensure it matches real, verified locations in India (e.g., correct "Prahaladhapura" to "Prahaladhapuram"). Format it cleanly with proper sentence casing.
      
      Required JSON Schema:
      {
        "childName": "string",
        "dob": "string",
        "caste": "string (OC/BC/SC only)",
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
      
      Text to process:
      ${text}
    `;

    const result = await model.generateContent(prompt);
    const parsedData = JSON.parse(result.response.text());

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error) {
    console.error("Extraction error:", error);
    return NextResponse.json({ error: "Failed to extract data" }, { status: 500 });
  }
}
