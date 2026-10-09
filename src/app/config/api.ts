// URL ของ Web API (โฟลเดอร์ server/)
// - เปิดเว็บจากเครื่องตัวเอง (ng serve: localhost:4200) → เรียก server ในเครื่อง
// - เปิดจาก Vercel (finalprojectadvweb.vercel.app) → เรียก server บน Render
const RENDER_URL = 'https://finalproject-advweb.onrender.com';

const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

export const API_ENDPOINT = isLocal ? 'http://localhost:3000' : RENDER_URL;
