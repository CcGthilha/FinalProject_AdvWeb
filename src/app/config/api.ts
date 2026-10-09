// URL ของ Web API (โฟลเดอร์ server/)
// - เปิดเว็บจากเครื่องตัวเอง (ng serve: localhost:4200) → เรียก server ในเครื่อง
// - เปิดจาก Vercel (finalprojectadvweb.vercel.app) → เรียก server บน Render
// หลัง deploy Render แล้ว ให้แก้ RENDER_URL เป็น URL จริง (ไม่มี / ปิดท้าย)
const RENDER_URL = 'https://<ชื่อ-service>.onrender.com';

const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

export const API_ENDPOINT = isLocal ? 'http://localhost:3000' : RENDER_URL;
