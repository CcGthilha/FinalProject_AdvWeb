import express from "express";
import { conn } from "../dbconnect";
import { Setting } from "../model/setting";

export const router = express.Router();

// GET /settings
router.get("/", async (req, res) => {
  try {
    const [rows] = await conn.query(
      "SELECT speed, road, stop_min AS stopMin, depart, back FROM setting WHERE id = 1"
    );
    const setting = (rows as any[])[0];
    if (!setting) {
      res.status(404).json({ error: "ยังไม่มีค่าตั้งต้น (รัน seed.sql)" });
      return;
    }
    res.json({ ...setting, back: !!setting.back } as Setting);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /settings  { speed, road, stopMin, depart, back }
router.put("/", async (req, res) => {
  try {
    let setting: Setting = req.body || {};
    if (!(setting.speed > 0) || !(setting.road > 0)) {
      res.status(400).json({ error: "speed และ road ต้องเป็นตัวเลขมากกว่า 0" });
      return;
    }
    if (!Number.isInteger(setting.stopMin) || setting.stopMin < 0) {
      res.status(400).json({ error: "stopMin ต้องเป็นจำนวนเต็มตั้งแต่ 0" });
      return;
    }
    if (typeof setting.depart !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(setting.depart)) {
      res.status(400).json({ error: "depart ต้องเป็นรูปแบบ HH:MM" });
      return;
    }
    const [result] = await conn.query(
      "UPDATE `setting` SET `speed`=?, `road`=?, `stop_min`=?, `depart`=?, `back`=? WHERE `id`=1",
      [setting.speed, setting.road, setting.stopMin, setting.depart, setting.back ? 1 : 0]
    );
    const updateResult = result as any;
    if (updateResult.affectedRows === 0) {
      res.status(404).json({ error: "ยังไม่มีค่าตั้งต้น (รัน seed.sql)" });
      return;
    }
    res.status(200).json({ affected_row: updateResult.affectedRows });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});
