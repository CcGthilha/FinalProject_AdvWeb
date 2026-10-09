import express from "express";
import { conn } from "../dbconnect";
import { Plan, PlanPostRequest } from "../model/plan";
import { todayBangkok } from "../util/date";
import { LIMIT_MIN, MAX_BOXES, SELECT_ROUTE, SELECT_STOP, attachStops } from "../util/plan";

export const router = express.Router();

function randomCode(used: Set<string>): string {
  let code: string;
  do {
    code = String(Math.floor(1000 + Math.random() * 9000));
  } while (used.has(code));
  used.add(code);
  return code;
}

// อ่านแผนของวันที่กำหนด พร้อม routes + stops (ไม่มี = null)
async function getPlan(date: string): Promise<Plan | null> {
  const [plans] = await conn.query(
    "SELECT id, plan_date AS planDate, depart, sig FROM plan WHERE plan_date = ?",
    [date]
  );
  const plan = (plans as any[])[0];
  if (!plan) return null;
  const [routes] = await conn.query(SELECT_ROUTE + " WHERE plan_id = ? ORDER BY rider_no", [plan.id]);
  const [stops] = await conn.query(
    SELECT_STOP + " WHERE route_id IN (SELECT id FROM route WHERE plan_id = ?) ORDER BY route_id, seq",
    [plan.id]
  );
  plan.routes = attachStops(routes as any[], stops as any[]);
  return plan as Plan;
}

// ตรวจแผนที่ส่งมา คืนข้อความ error หรือ null ถ้าผ่าน
function validatePlan(plan: PlanPostRequest): string | null {
  if (!plan || !Array.isArray(plan.routes) || plan.routes.length === 0) return "ต้องมี routes อย่างน้อย 1 คัน";
  if (typeof plan.depart !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(plan.depart)) return "depart ต้องเป็นรูปแบบ HH:MM";
  for (const r of plan.routes) {
    if (!Array.isArray(r.stops) || r.stops.length === 0) return `ไรเดอร์ ${r.rider} ไม่มีจุดส่ง`;
    // นับกล่องจากจุดส่งจริง ไม่เชื่อค่า boxes ที่ส่งมาอย่างเดียว
    const boxes = r.stops.reduce((a, s) => a + Number(s.boxes || 0), 0);
    if (boxes > MAX_BOXES || r.boxes > MAX_BOXES) return `ไรเดอร์ ${r.rider} มี ${boxes} กล่อง เกิน ${MAX_BOXES}`;
    if (r.stops.some((s) => !(s.at <= LIMIT_MIN))) return `ไรเดอร์ ${r.rider} มีจุดที่ถึงเกิน ${LIMIT_MIN} นาที`;
  }
  return null;
}

// GET /plan/latest  แผนของวันนี้ (หน้า dispatch ดึงซ้ำทุก 15 วินาที)
router.get("/latest", async (req, res) => {
  try {
    const plan = await getPlan(todayBangkok());
    if (!plan) {
      res.status(404).json({ error: "ยังไม่มีแผนของวันนี้" });
      return;
    }
    res.json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /plan  ยืนยันแผน (แทนที่แผนเดิมของวันนี้) คืนแผนพร้อมรหัสใบงาน
router.post("/", async (req, res) => {
  let plan: PlanPostRequest = req.body;
  const invalid = validatePlan(plan);
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }

  const today = todayBangkok();
  let c;
  try {
    c = await conn.getConnection();
    await c.beginTransaction();

    const [doneRows] = await c.query(
      "SELECT COUNT(*) AS cnt FROM stop s JOIN route r ON r.id = s.route_id " +
        "WHERE r.plan_date = ? AND s.done = 1",
      [today]
    );
    if ((doneRows as any[])[0].cnt > 0) {
      await c.rollback();
      res.status(409).json({ error: "ไรเดอร์เริ่มส่งแล้ว ยืนยันแผนใหม่ไม่ได้" });
      return;
    }

    // ลบแผนเดิมของวันนี้ (route/stop หายตาม CASCADE) รหัสเก่าจึงใช้ไม่ได้อีก
    await c.query("DELETE FROM plan WHERE plan_date = ?", [today]);

    const [planResult] = await c.query(
      "INSERT INTO `plan`(`plan_date`, `depart`, `sig`) VALUES (?,?,?)",
      [today, plan.depart, plan.sig || null]
    );
    const planId = (planResult as any).insertId;

    const used = new Set<string>();
    for (const r of plan.routes) {
      const code = randomCode(used); // ไม่ซ้ำในแผนนี้ + แผนเดียวต่อวัน → ไม่ซ้ำในวันนี้ (UNIQUE กันอีกชั้น)
      const boxes = r.stops.reduce((a, s) => a + Number(s.boxes || 0), 0);
      const [routeResult] = await c.query(
        "INSERT INTO `route`(`plan_id`, `plan_date`, `rider_no`, `code`, `color`, `boxes`, `km`, `fee`, `end_min`) " +
          "VALUES (?,?,?,?,?,?,?,?,?)",
        [planId, today, r.rider, code, r.color, boxes, r.km, r.fee, r.end]
      );
      const routeId = (routeResult as any).insertId;

      for (let i = 0; i < r.stops.length; i++) {
        const s = r.stops[i];
        // order_id ใส่เฉพาะเมื่อมีออเดอร์นี้จริงใน DB ไม่งั้นเป็น NULL (กัน foreign key error)
        await c.query(
          "INSERT INTO `stop`(`route_id`, `seq`, `order_id`, `name`, `phone`, `address`, `lat`, `lng`, `boxes`, `km`, `at_min`) " +
            "VALUES (?,?,(SELECT id FROM orders WHERE id = ?),?,?,?,?,?,?,?,?)",
          [routeId, i + 1, s.id, s.name, s.phone, s.address, s.lat, s.lng, s.boxes, s.km, s.at]
        );
      }
    }

    await c.commit();
    res.status(201).json(await getPlan(today));
  } catch (error) {
    console.error(error);
    if (c) await c.rollback();
    res.status(500).json({ error: "Internal server error" });
  } finally {
    if (c) c.release(); // ต้องคืน connection ทุกครั้ง ไม่งั้น pool หมดแล้ว API ค้างทั้งระบบ
  }
});
