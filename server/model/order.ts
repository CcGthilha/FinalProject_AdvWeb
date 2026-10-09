// ออเดอร์ที่ join ข้อมูลลูกค้ามาแล้ว (ชื่อฟิลด์ตาม src/app/models.ts)
export interface Order {
  id: number;
  customerId: number;
  boxes: number;
  orderDate: string; // "YYYY-MM-DD"
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
}

export interface OrderPostRequest {
  customerId: number;
  boxes: number;
}
