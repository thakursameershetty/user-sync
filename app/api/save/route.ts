import { NextResponse } from "next/server";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

export async function POST(req: Request) {
  try {
    const { data, forceUpdate } = await req.json();

    if (!data) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 });
    }

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID!, serviceAccountAuth);
    await doc.loadInfo(); 
    const sheet = doc.sheetsByIndex[0]; 

    // 1. Fetch all existing rows to look for duplicates
    const rows = await sheet.getRows();
    const existingRow = rows.find(
      (row) => row.get("Child Name")?.toString().trim().toLowerCase() === data.childName.trim().toLowerCase()
    );

    const sheetPayload = {
      "Child Name": data.childName,
      "Date of birth": data.dob,
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
    };

    // 2. Duplicate Check Conditional Flow
    if (existingRow) {
      if (!forceUpdate) {
        // Stop here and tell the frontend a duplicate exists
        return NextResponse.json({ exists: true });
      } else {
        // Mom confirmed the update, overwrite the existing row matching the child's name
        existingRow.assign(sheetPayload);
        await existingRow.save();
        return NextResponse.json({ success: true, updated: true });
      }
    }

    // 3. No duplicate found, proceed with a clean insert
    await sheet.addRow(sheetPayload);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Save error:", error);
    return NextResponse.json({ error: "Failed to save to Google Sheets" }, { status: 500 });
  }
}
