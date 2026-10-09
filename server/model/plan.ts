// ให้ตรงกับ Stop / Route / Plan ใน src/app/models.ts
export interface Stop {
  id: number | null; // id ออเดอร์ (เป็น null ถ้าออเดอร์ถูกล้างไปแล้ว)
  seq: number; // ลำดับจุด เริ่มที่ 1
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  boxes: number;
  km: number;
  at: number; // นาทีหลังออกจากร้าน
  done: boolean;
}

export interface Route {
  id?: number;
  rider: number;
  code: string;
  color: string;
  boxes: number;
  km: number;
  fee: number;
  end: number;
  stops: Stop[];
}

export interface Plan {
  id: number;
  planDate: string;
  depart: string;
  sig: string;
  routes: Route[];
}

// สิ่งที่หน้า dispatch ส่งมาตอนกด "ยืนยัน" (server ออกรหัสเอง ไม่ต้องส่ง code)
export interface PlanPostRequest {
  sig: string;
  depart: string;
  routes: {
    rider: number;
    color: string;
    boxes: number;
    km: number;
    fee: number;
    end: number;
    stops: {
      id: number;
      name: string;
      phone: string;
      address: string;
      lat: number;
      lng: number;
      boxes: number;
      km: number;
      at: number;
    }[];
  }[];
}
