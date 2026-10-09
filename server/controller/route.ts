import express from "express";
import { conn } from "../dbconnect";
import { Route } from "../model/plan";
import { todayBangkok } from "../util/date";
import { SELECT_ROUTE, SELECT_STOP, attachStops } from "../util/plan";

export const router = express.Router();

const isCode = (code: string) => /^\d{4}$/.test(code);

// GET /route/:code  ไรเดอร์เปิดใบงานของวันนี้
router.get("/:code", async (req, res) => {
  try {
    if (!isCode(req.params.code)) {
      res.status(400).json({ error: "รหัสใบงานต้องเป็นตัวเลข 4 หลัก" });
      return;
    }
    const [routes] = await conn.query(SELECT_ROUTE + " WHERE code = ? AND plan_date = ?", [
      req.params.code,
      todayBangkok(),
    ]);
    if ((routes as any[]).length === 0) {
      res.status(404).json({ error: "ไม่พบใบงานรหัสนี้ของวันนี้" });
      return;
    }
    const route = (routes as any[])[0];
    const [stops] = await conn.query(SELECT_STOP + " WHERE route_id = ? ORDER BY seq", [route.id]);
    res.json(attachStops([route], stops as any[])[0] as Route);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /route/:code/stops/:seq  { done: true/false }  (seq เริ่มที่ 1 = index + 1 ฝั่ง Angular)
router.put("/:code/stops/:seq", async (req, res) => {
  try {
    if (!isCode(req.params.code)) {
      res.status(400).json({ error: "รหัสใบงานต้องเป็นตัวเลข 4 หลัก" });
      return;
    }
    if (typeof req.body?.done !== "boolean") {
      res.status(400).json({ error: "done ต้องเป็น true หรือ false" });
      return;
    }
    const [result] = await conn.query(
      "UPDATE stop s JOIN route r ON r.id = s.route_id SET s.done = ? " +
        "WHERE r.code = ? AND r.plan_date = ? AND s.seq = ?",
      [req.body.done ? 1 : 0, req.params.code, todayBangkok(), req.params.seq]
    );
    const updateResult = result as any;
    // mysql2 เปิด FOUND_ROWS เป็นค่าเริ่มต้น affectedRows จึงนับแถวที่ตรงเงื่อนไข แม้ค่า done จะไม่เปลี่ยน
    if (updateResult.affectedRows === 0) {
      res.status(404).json({ error: "ไม่พบจุดส่งนี้ในใบงาน" });
      return;
    }
    res.status(200).json({ affected_row: updateResult.affectedRows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
