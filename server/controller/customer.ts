import express from "express";
import mysql from "mysql2";
import { conn } from "../dbconnect";
import { Customer, CustomerPostRequest } from "../model/customer";

export const router = express.Router();

const SELECT_CUSTOMER =
  "SELECT id, firstname, lastname, CONCAT(firstname,' ',lastname) AS name, phone, address, lat, lng FROM customer";

// ตรวจข้อมูลลูกค้า คืนข้อความ error หรือ null ถ้าผ่าน
function validateCustomer(c: Partial<CustomerPostRequest>): string | null {
  if (!c.firstname || !c.lastname) return "ต้องระบุ firstname และ lastname";
  if (!c.phone) return "ต้องระบุ phone";
  if (typeof c.lat !== "number" || typeof c.lng !== "number") return "lat และ lng ต้องเป็นตัวเลข";
  return null;
}

// GET /customers  และ  GET /customers?phone=0812345678
router.get("/", async (req, res) => {
  try {
    if (req.query.phone) {
      const [rows] = await conn.query(SELECT_CUSTOMER + " WHERE phone = ?", [req.query.phone]);
      res.json(rows as Customer[]);
    } else {
      const [rows] = await conn.query(SELECT_CUSTOMER + " ORDER BY id");
      res.json(rows as Customer[]);
    }
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /customers/search?q=สม  (ส่วนหนึ่งของชื่อ หรือ นามสกุล)
router.get("/search", async (req, res) => {
  try {
    const q = "%" + (req.query.q || "") + "%";
    const [rows] = await conn.query(
      SELECT_CUSTOMER + " WHERE firstname LIKE ? OR lastname LIKE ? ORDER BY id",
      [q, q]
    );
    res.json(rows as Customer[]);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /customers/nearby?lat=16.249&lng=103.259&km=1  (Haversine ผลเป็นกิโลเมตร)
router.get("/nearby", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const km = Number(req.query.km || 1);
    if (!req.query.lat || !req.query.lng || isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: "ต้องระบุ lat และ lng เป็นตัวเลข" });
      return;
    }
    if (isNaN(km) || km <= 0) {
      res.status(400).json({ error: "km ต้องเป็นตัวเลขมากกว่า 0" });
      return;
    }
    const sql =
      "SELECT id, firstname, lastname, CONCAT(firstname,' ',lastname) AS name, phone, address, lat, lng, " +
      "(6371 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(lat)) * COS(RADIANS(lng) - RADIANS(?)) " +
      "+ SIN(RADIANS(?)) * SIN(RADIANS(lat))))) AS distance_km " +
      "FROM customer HAVING distance_km <= ? ORDER BY distance_km";
    const [rows] = await conn.query(sql, [lat, lng, lat, km]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /customers/:id
router.get("/:id", async (req, res) => {
  try {
    const [rows] = await conn.query(SELECT_CUSTOMER + " WHERE id = ?", [req.params.id]);
    const customers = rows as Customer[];
    if (customers.length === 0) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    res.json(customers[0]);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /customers
router.post("/", async (req, res) => {
  try {
    let customer: CustomerPostRequest = req.body;
    const invalid = validateCustomer(customer || {});
    if (invalid) {
      res.status(400).json({ error: invalid });
      return;
    }
    let sql =
      "INSERT INTO `customer`(`firstname`, `lastname`, `phone`, `address`, `lat`, `lng`) VALUES (?,?,?,?,?,?)";
    const [result] = await conn.query(sql, [
      customer.firstname,
      customer.lastname,
      customer.phone,
      customer.address,
      customer.lat,
      customer.lng,
    ]);
    const insertResult = result as any;
    res.status(201).json({
      affected_row: insertResult.affectedRows,
      last_idx: insertResult.insertId,
    });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "เบอร์โทรนี้มีอยู่แล้ว" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /customers/:id  (บท 10 แบบที่ 2: ดึงของเดิมมา merge กับของใหม่)
router.put("/:id", async (req, res) => {
  try {
    let id = +req.params.id;
    let customer: Partial<CustomerPostRequest> = req.body;

    let sql = mysql.format("SELECT * FROM customer WHERE id = ?", [id]);
    let [response] = await conn.query(sql);
    let result = response as Customer[];

    if (result.length === 0) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    let updateCustomer = { ...result[0], ...customer };
    const invalid = validateCustomer(updateCustomer);
    if (invalid) {
      res.status(400).json({ error: invalid });
      return;
    }
    sql =
      "UPDATE `customer` SET `firstname`=?, `lastname`=?, `phone`=?, `address`=?, `lat`=?, `lng`=? WHERE `id`=?";
    sql = mysql.format(sql, [
      updateCustomer.firstname,
      updateCustomer.lastname,
      updateCustomer.phone,
      updateCustomer.address,
      updateCustomer.lat,
      updateCustomer.lng,
      id,
    ]);
    const [records] = await conn.query(sql);
    const updateResult = records as any;
    res.status(200).json({ affected_row: updateResult.affectedRows });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({ error: "เบอร์โทรนี้มีอยู่แล้ว" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /customers/:id  (ออเดอร์หายตาม ON DELETE CASCADE)
router.delete("/:id", async (req, res) => {
  try {
    const [result] = await conn.query("DELETE FROM customer WHERE id = ?", [req.params.id]);
    const deleteResult = result as any;
    if (deleteResult.affectedRows === 0) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    res.status(200).json({ affected_row: deleteResult.affectedRows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
