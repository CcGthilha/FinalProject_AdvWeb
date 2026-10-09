// วันที่ตามเวลาไทย รูปแบบ YYYY-MM-DD (Render/Aiven ใช้ UTC ห้ามใช้ CURRENT_DATE ของ MySQL)
export function todayBangkok(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}
