export interface Pt {
  lat: number;
  lng: number;
}
export interface Customer extends Pt {
  id: number;
  firstname: string;
  lastname: string;
  name: string; // firstname + ' ' + lastname (server ต่อให้)
  phone: string;
  address: string;
}
export interface Order {
  id: number;
  customerId: number;
  boxes: number;
}
export interface Settings {
  speed: number;
  road: number;
  stopMin: number;
  depart: string;
  back: boolean;
}
export interface Item extends Pt {
  id: number;
  boxes: number;
  name: string;
  phone: string;
  address: string;
}
export interface Stop extends Item {
  km: number;
  at: number;
  done: boolean;
}
export interface Route {
  rider: number;
  code: string;
  color: string;
  stops: Stop[];
  boxes: number;
  km: number;
  fee: number;
  end: number;
}
export interface Plan {
  routes: Route[];
  sig: string;
  depart: string;
}
export interface Totals {
  orders: number;
  boxes: number;
  rev: number;
  food: number;
  fee: number;
  profit: number;
  km: number;
  riders: number;
  late: number;
  end: number;
}

export const SHOP = {
  name: 'ร้านข้าวกล่องเดลิเวอรี่',
  lat: 16.249,
  lng: 103.259,
};
export const PRICE = 65,
  COST = 40,
  BASE = 15,
  PER = 2,
  LIMIT = 60,
  MAXO = 3;
export const DEF: Settings = {
  speed: 30,
  road: 1.3,
  stopMin: 2,
  depart: '11:30',
  back: false,
};
export const COLORS = [
  '#E23B1E',
  '#1F6FE0',
  '#12905A',
  '#9B3FD1',
  '#E08A00',
  '#0E9AA7',
  '#C2307A',
  '#6B7A00',
  '#5A5AE0',
  '#8C5A3C',
];
