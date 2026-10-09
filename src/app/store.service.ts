import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { lastValueFrom } from 'rxjs';
import { API_ENDPOINT } from './config/api';
import { Customer, DEF, Item, Order, Plan, Route, Settings } from './models';

/** ข้อความ error จาก API ({ error: '...' }) หรือข้อความทั่วไปถ้าต่อ server ไม่ได้ */
export const apiError = (e: any): string =>
  e?.error?.error ??
  (e?.status === 0
    ? 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจว่า server เปิดอยู่'
    : 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');

/** ชั้นข้อมูลทั้งหมดอยู่ที่นี่ที่เดียว — ทุกเมธอดเรียก Web API (server/) แล้วค่อยอัปเดต signal */
@Injectable({ providedIn: 'root' })
export class Store {
  private http = inject(HttpClient);

  customers = signal<Customer[]>([]);
  orders = signal<Order[]>([]);
  settings = signal<Settings>({ ...DEF });
  plan = signal<Plan | null>(null);
  err = signal(''); // error ล่าสุด แสดงที่ layout

  items = computed<Item[]>(() =>
    this.orders().flatMap((o) => {
      const c = this.customers().find((x) => x.id === o.customerId);
      return c
        ? [
            {
              id: o.id,
              lat: c.lat,
              lng: c.lng,
              boxes: o.boxes,
              name: c.name,
              phone: c.phone,
              address: c.address,
            },
          ]
        : [];
    }),
  );

  constructor() {
    // แผนของวันนี้ใช้ทั้งฝั่งร้านและหน้าไรเดอร์ จึงโหลดทันที
    this.refreshPlan();
  }

  private get = <T>(path: string) =>
    lastValueFrom(this.http.get<T>(API_ENDPOINT + path));
  private post = <T>(path: string, body: unknown) =>
    lastValueFrom(this.http.post<T>(API_ENDPOINT + path, body));
  private put = <T>(path: string, body: unknown) =>
    lastValueFrom(this.http.put<T>(API_ENDPOINT + path, body));
  private del = <T>(path: string) =>
    lastValueFrom(this.http.delete<T>(API_ENDPOINT + path));

  /** ฝั่งเจ้าของร้านเรียกครั้งเดียวตอนเข้าแอป (layout.ts) */
  async init() {
    try {
      const [customers, orders, settings] = await Promise.all([
        this.get<Customer[]>('/customers'),
        this.get<Order[]>('/orders'),
        this.get<Settings>('/settings'),
      ]);
      this.customers.set(customers);
      this.orders.set(orders);
      this.settings.set({ ...DEF, ...settings });
      this.err.set('');
    } catch (e) {
      this.err.set(apiError(e));
    }
  }
  async loadCustomers() {
    this.customers.set(await this.get<Customer[]>('/customers'));
  }
  async loadOrders() {
    this.orders.set(await this.get<Order[]>('/orders'));
  }
  /** GET /plan/latest — ไม่มีแผนของวันนี้ (404) = null */
  async refreshPlan() {
    try {
      this.plan.set(await this.get<Plan>('/plan/latest'));
    } catch (e: any) {
      if (e?.status === 404) this.plan.set(null);
      else this.err.set(apiError(e));
    }
  }

  // ---------- ลูกค้า ----------
  /** เพิ่ม (id = 0) หรือแก้ไข — ถ้าเบอร์ซ้ำ server ตอบ 409 แล้ว throw ให้หน้าจอแสดงข้อความ */
  async saveCustomer(c: Customer) {
    const body = {
      firstname: c.firstname,
      lastname: c.lastname,
      phone: c.phone,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
    };
    if (c.id) await this.put(`/customers/${c.id}`, body);
    else await this.post('/customers', body);
    await this.loadCustomers();
  }
  async delCustomer(id: number) {
    await this.del(`/customers/${id}`);
    await Promise.all([this.loadCustomers(), this.loadOrders()]); // ออเดอร์หายตาม CASCADE
  }

  // ---------- ออเดอร์ ----------
  async addOrder(customerId: number, boxes: number) {
    try {
      await this.post('/orders', { customerId, boxes });
      await this.loadOrders();
    } catch (e) {
      this.err.set(apiError(e));
    }
  }
  async setBoxes(id: number, boxes: number) {
    boxes = Math.min(3, Math.max(1, boxes));
    try {
      await this.put(`/orders/${id}`, { boxes });
      this.orders.update((l) => l.map((o) => (o.id === id ? { ...o, boxes } : o)));
    } catch (e) {
      this.err.set(apiError(e));
    }
  }
  async delOrder(id: number) {
    try {
      await this.del(`/orders/${id}`);
      this.orders.update((l) => l.filter((o) => o.id !== id));
    } catch (e) {
      this.err.set(apiError(e));
    }
  }
  async simulate(n: number) {
    try {
      await this.post('/orders/simulate', { n });
      await this.loadOrders();
    } catch (e) {
      this.err.set(apiError(e));
    }
  }
  /** ล้างออเดอร์ทั้งหมดของวันนี้ */
  async clearOrders() {
    try {
      await this.del('/orders');
      this.orders.set([]);
    } catch (e) {
      this.err.set(apiError(e));
    }
  }

  // ---------- ตั้งค่า ----------
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  /** อัปเดตทันทีบนหน้าจอ แล้วบันทึกลง server หลังหยุดพิมพ์ 0.5 วินาที */
  updateSettings(patch: Partial<Settings>) {
    this.settings.update((o) => ({ ...o, ...patch }));
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      try {
        await this.put('/settings', this.settings());
      } catch (e) {
        this.err.set(apiError(e));
      }
    }, 500);
  }

  // ---------- แผน / ใบงาน ----------
  /** POST /plan — server ออกรหัสใบงานเองแล้วคืนแผนทั้งก้อน (400/409 จะ throw) */
  async confirm(routes: Route[], sig: string) {
    const plan = await this.post<Plan>('/plan', {
      sig,
      depart: this.settings().depart,
      routes,
    });
    this.plan.set(plan);
  }
  /** ไรเดอร์กด "ส่งแล้ว" / ยกเลิก — i คือ index ของจุด (seq = i + 1) */
  async toggleDone(code: string, i: number) {
    const r = this.plan()?.routes.find((x) => x.code === code);
    const s = r?.stops[i];
    if (!s) return;
    try {
      await this.put(`/route/${code}/stops/${i + 1}`, { done: !s.done });
      this.plan.update(
        (p) =>
          p && {
            ...p,
            routes: p.routes.map((x) =>
              x.code === code
                ? { ...x, stops: x.stops.map((y, k) => (k === i ? { ...y, done: !y.done } : y)) }
                : x,
            ),
          },
      );
    } catch (e) {
      this.err.set(apiError(e));
    }
  }
}
