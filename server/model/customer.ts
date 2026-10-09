export interface Customer {
  id: number;
  firstname: string;
  lastname: string;
  name: string; // CONCAT(firstname,' ',lastname) ให้หน้าจอเดิมใช้
  phone: string;
  address: string;
  lat: number;
  lng: number;
}

export interface CustomerPostRequest {
  firstname: string;
  lastname: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
}
