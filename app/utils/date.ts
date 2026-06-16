export function normalizeDOB(dob: string): string {
  if (!dob || dob === "N/A") return "N/A";
  
  const cleanDob = dob.trim();
  
  // Check if it matches D(D)/M(M)/YYYY
  const dmySlashMatch = cleanDob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmySlashMatch) {
    const [_, day, month, year] = dmySlashMatch;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }
  
  // Check if it matches YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = cleanDob.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatch) {
    const [_, year, month, day] = ymdMatch;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }

  // Check if it matches DD-MM-YYYY or DD.MM.YYYY
  const dmyOtherMatch = cleanDob.match(/^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/);
  if (dmyOtherMatch) {
    const [_, day, month, year] = dmyOtherMatch;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
  }
  
  // Try using JS Date parsing if it contains letters (like June 15, 2015)
  try {
    if (/[a-zA-Z]/.test(cleanDob)) {
      const tryDate = cleanDob.replace(/(\d+)(st|nd|rd|th)/, "$1");
      const dateObj = new Date(tryDate);
      if (!isNaN(dateObj.getTime())) {
        const day = String(dateObj.getDate()).padStart(2, "0");
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const year = dateObj.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }
  } catch (e) {
    // Ignore and fallback
  }

  return cleanDob;
}
