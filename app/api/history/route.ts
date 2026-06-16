import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { normalizeDOB } from "../../utils/date";

// Re-use the bot credentials
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export async function GET() {
  try {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    // Fetch all rows from the spreadsheet
    const rows = await sheet.getRows();

    // Map the Google Sheet rows back into our JSON structure
    const historyData = rows.map((row) => ({
      childName: row.get("Child Name") || "N/A",
      dob: normalizeDOB(row.get("Date of birth") || "N/A"),
      caste: row.get("Caste") || "N/A",
      childAadhaar: row.get("Child Aadhaar") || "N/A",
      fatherName: row.get("Father Name") || "N/A",
      fatherContact: row.get("Father Contact") || "N/A",
      fatherWhatsapp: row.get("Father Whatsapp") || "N/A",
      fatherAadhaar: row.get("Father Aadhaar") || "N/A",
      motherName: row.get("Mother Name") || "N/A",
      motherWhatsapp: row.get("Mother Whatsapp") || "N/A",
      motherContact: row.get("Mother Contact") || "N/A",
      motherAadhaar: row.get("Mother Aadhaar") || "N/A",
      address: row.get("Address") || "N/A",
      transportMode: row.get("Transport Mode") || "N/A",
      autoDriverName: row.get("Auto Driver Name") || "N/A",
      autoDriverContact: row.get("Auto Driver Contact") || "N/A",
    }));

    // Reverse the array so newest entries show up first in the UI
    return NextResponse.json({ success: true, data: historyData.reverse() });

  } catch (error) {
    console.error("Fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch data from Google Sheets" }, { status: 500 });
  }
}
