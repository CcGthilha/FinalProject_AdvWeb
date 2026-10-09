import express from "express";
import mysql from "mysql2";
import { conn } from "../dbconnect";
import { Order, OrderPostRequest } from "../model/order";
import { todayBangkok } from "../util/date";

export const router = express.Router();

// ระบุคอลัมน์เองทุกตัว ไม่ใช้ o.*, c.* เพราะ id จะชนกัน
const SELECT_ORDER =
  "SELECT o.id, o.customer_id AS customerId, o.boxes, o.order_date AS orderDate, " +
  "CONCAT(c.firstname,' ',c.lastname) AS name, c.phone, c.address, c.lat, c.lng " +
  "FROM orders o JOIN customer c ON c.id = o.customer_id";

// ?date= ไม่ใส่ = วันนี้ตามเวลาไทย, ใส่ผิดรูปแบบ = null
function getDate(q: unknown): string | null {
  if (q === undefined || q === "") return todayBangkok();
  if (typeof q === "string" && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  return null;
}

function isValidBoxes(boxes: unknown): boolean {
  return Number.isInteger(boxes) && (boxes as number) >= 1 && (boxes as number) <= 3;
}

// GET /orders?date=2026-10-09
router.get("/", async (req, res) => {
  try {
    const date = getDate(req.query.date);
    if (!date) {
      res.status(400).json({ error: "date ต้องเป็นรูปแบบ YYYY-MM-DD" });
      return;
    }
    const [rows] = await conn.query(SELECT_ORDER + " WHERE o.order_date = ? ORDER BY o.id", [date]);
    res.json(rows as Order[]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /orders/nearby?lat=&lng=&km=2&date=
router.get("/nearby", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const km = Number(req.query.km || 2);
    const date = getDate(req.query.date);
    if (!req.query.lat || !req.query.lng || isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: "ต้องระบุ lat และ lng เป็นตัวเลข" });
      return;
    }
    if (isNaN(km) || km <= 0) {
      res.status(400).json({ error: "km ต้องเป็นตัวเลขมากกว่า 0" });
      return;
    }
    if (!date) {
      res.status(400).json({ error: "date ต้องเป็นรูปแบบ YYYY-MM-DD" });
      return;
    }
    const sql =
      "SELECT o.id, o.customer_id AS customerId, o.boxes, o.order_date AS orderDate, " +
      "CONCAT(c.firstname,' ',c.lastname) AS name, c.phone, c.address, c.lat, c.lng, " +
      "(6371 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(c.lat)) * COS(RADIANS(c.lng) - RADIANS(?)) " +
      "+ SIN(RADIANS(?)) * SIN(RADIANS(c.lat))))) AS distance_km " +
      "FROM orders o JOIN customer c ON c.id = o.customer_id " +
      "WHERE o.order_date = ? HAVING distance_km <= ? ORDER BY distance_km";
    const [rows] = await conn.query(sql, [lat, lng, lat, date, km]);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /orders/simulate  { n }  ล้างออเดอร์วันนี้ แล้วสุ่มใหม่ (ลูกค้าไม่ซ้ำ กล่อง 1-3)
// ใส่ n = จำนวนเต็มตั้งแต่ 1 (ต้องไม่เกินจำนวนลูกค้า)
// ไม่ใส่ n = สุ่ม 20-30 ตาม HW-5 แต่ถ้าลูกค้ามีน้อยกว่านั้น ใช้ลูกค้าทุกคน
router.post("/simulate", async (req, res) => {
  try {
    const [countRows] = await conn.query("SELECT COUNT(*) AS cnt FROM customer");
    const total = Number((countRows as any[])[0].cnt);
    if (total === 0) {
      res.status(400).json({ error: "ยังไม่มีลูกค้าในระบบ" });
      return;
    }

    let n: number;
    if (req.body?.n === undefined || req.body?.n === null || req.body?.n === "") {
      n = Math.min(total, 20 + Math.floor(Math.random() * 11));
    } else {
      n = Number(req.body.n);
      if (!Number.isInteger(n) || n < 1) {
        res.status(400).json({ error: "n ต้องเป็นจำนวนเต็มตั้งแต่ 1" });
        return;
      }
      if (n > total) {
        res.status(400).json({ error: `มีลูกค้า ${total} คน จำลอง ${n} ออเดอร์ไม่ได้ (ลูกค้า 1 คนได้ 1 ออเดอร์)` });
        return;
      }
    }

    const [rows] = await conn.query("SELECT id FROM customer ORDER BY RAND() LIMIT ?", [n]);
    const customers = rows as { id: number }[];
    const today = todayBangkok();
    await conn.query("DELETE FROM orders WHERE order_date = ?", [today]);

    const values = customers.map((c) => [c.id, 1 + Math.floor(Math.random() * 3), today]);
    const [result] = await conn.query(
      "INSERT INTO `orders`(`customer_id`, `boxes`, `order_date`) VALUES ?",
      [values]
    );
    const insertResult = result as any;
    res.status(201).json({
      affected_row: insertResult.affectedRows,
      last_idx: insertResult.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /orders/:id
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await conn.query(SELECT_ORDER + " WHERE o.id = ?", [req.params.id]);
    const orders = rows as Order[];
    if (orders.length === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.json(orders[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /orders  { customerId, boxes }
router.post("/", async (req, res) => {
  try {
    let order: OrderPostRequest = req.body || {};
    if (!isValidBoxes(order.boxes)) {
      res.status(400).json({ error: "boxes ต้องเป็นจำนวนเต็ม 1-3" });
      return;
    }
    if (!Number.isInteger(order.customerId)) {
      res.status(400).json({ error: "ต้องระบุ customerId เป็นตัวเลข" });
      return;
    }
    const [found] = await conn.query("SELECT id FROM customer WHERE id = ?", [order.customerId]);
    if ((found as any[]).length === 0) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    const [result] = await conn.query(
      "INSERT INTO `orders`(`customer_id`, `boxes`, `order_date`) VALUES (?,?,?)",
      [order.customerId, order.boxes, todayBangkok()]
    );
    const insertResult = result as any;
    res.status(201).json({
      affected_row: insertResult.affectedRows,
      last_idx: insertResult.insertId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /orders/:id  { boxes }  แก้จำนวนกล่อง
router.put("/:id", async (req, res) => {
  try {
    const boxes = req.body?.boxes;
    if (!isValidBoxes(boxes)) {
      res.status(400).json({ error: "boxes ต้องเป็นจำนวนเต็ม 1-3" });
      return;
    }
    let sql = mysql.format("UPDATE `orders` SET `boxes`=? WHERE `id`=?", [boxes, +req.params.id]);
    const [result] = await conn.query(sql);
    const updateResult = result as any;
    if (updateResult.affectedRows === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.status(200).json({ affected_row: updateResult.affectedRows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /orders?date=  ล้างออเดอร์ทั้งหมดของวันนั้น (ไม่ใส่ = วันนี้)
router.delete("/", async (req, res) => {
  try {
    const date = getDate(req.query.date);
    if (!date) {
      res.status(400).json({ error: "date ต้องเป็นรูปแบบ YYYY-MM-DD" });
      return;
    }
    const [result] = await conn.query("DELETE FROM orders WHERE order_date = ?", [date]);
    const deleteResult = result as any;
    res.status(200).json({ affected_row: deleteResult.affectedRows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /orders/:id
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await conn.query("DELETE FROM orders WHERE id = ?", [req.params.id]);
    const deleteResult = result as any;
    if (deleteResult.affectedRows === 0) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    res.status(200).json({ affected_row: deleteResult.affectedRows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
