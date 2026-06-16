import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { normalizeDOB } from "../../utils/date";

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export async function POST(req: Request) {
  try {
    // We now expect an array of formatted JSON objects
    const { dataArray } = await req.json();

    if (!dataArray || !Array.isArray(dataArray)) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    // Format the array to match the exact column headers
    const rowsToInsert = dataArray.map((data: Record<string, string>) => ({
      "Child Name": data.childName,
      "Date of birth": normalizeDOB(data.dob),
      "Caste": data.caste,
      "Child Aadhaar": data.childAadhaar,
      "Father Name": data.fatherName,
      "Father Contact": data.fatherContact,
      "Father Whatsapp": data.fatherWhatsapp,
      "Father Aadhaar": data.fatherAadhaar,
      "Mother Name": data.motherName,
      "Mother Whatsapp": data.motherWhatsapp,
      "Mother Contact": data.motherContact,
      "Mother Aadhaar": data.motherAadhaar,
      "Address": data.address,
      "Transport Mode": data.transportMode,
      "Auto Driver Name": data.autoDriverName,
      "Auto Driver Contact": data.autoDriverContact,
    }));

    // Bulk insert all rows at once
    await sheet.addRows(rowsToInsert);

    return NextResponse.json({ success: true, count: rowsToInsert.length });

  } catch (error) {
    console.error("Bulk Save error:", error);
    return NextResponse.json({ error: "Failed to save to Google Sheets" }, { status: 500 });
  }
}
