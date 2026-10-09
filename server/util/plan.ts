import { Route, Stop } from "../model/plan";

export const MAX_BOXES = 10; // กล่องต่อคัน
export const LIMIT_MIN = 60; // ต้องถึงภายใน 60 นาที (ก่อน 12:30)

export const SELECT_ROUTE =
  "SELECT id, rider_no AS rider, code, color, boxes, km, fee, end_min AS end FROM route";

export const SELECT_STOP =
  "SELECT route_id AS routeId, order_id AS id, seq, name, phone, address, lat, lng, boxes, km, at_min AS at, done FROM stop";

// ประกอบ stops เข้าไปใน route แต่ละคัน และแปลง done 0/1 เป็น boolean
export function attachStops(routes: any[], stops: any[]): Route[] {
  return routes.map((r) => ({
    ...r,
    stops: stops
      .filter((s) => s.routeId === r.id)
      .map(({ routeId, ...s }) => ({ ...s, done: !!s.done }) as Stop),
  }));
}
