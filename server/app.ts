import express from "express";
import cors from "cors";
import { router as index } from "./controller/index";
import { router as customer } from "./controller/customer";

export const app = express();

// CORS แนวทางที่ 2 (whitelist) วางไว้เป็นคำสั่งแรก
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.use("/", index);
app.use("/customers", customer);
// เฟสถัดไปจะเพิ่ม:
// app.use("/orders", order);
// app.use("/settings", setting);
// app.use("/plan", plan);
// app.use("/route", route);
