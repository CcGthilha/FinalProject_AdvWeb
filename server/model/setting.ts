// ตรงกับ Settings ใน src/app/models.ts
export interface Setting {
  speed: number; // กม./ชม.
  road: number; // ตัวคูณระยะถนน
  stopMin: number; // นาทีที่จอดต่อจุด
  depart: string; // "HH:MM"
  back: boolean; // นับเที่ยวกลับร้านด้วยไหม
}
