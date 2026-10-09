import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapPin, MapView } from './map';
import { Customer, SHOP } from './models';
import { km } from './optimizer';
import { Store, apiError } from './store.service';

const blank = (): Customer => ({
  id: 0,
  firstname: '',
  lastname: '',
  name: '',
  phone: '',
  address: '',
  lat: 0,
  lng: 0,
});

@Component({
  imports: [FormsModule, MapView],
  template: ` <header class="page">
      <div>
        <h1>ลูกค้า</h1>
        <p class="sub">
          มี {{ s.customers().length }} ราย กดบนแผนที่เพื่อปักหมุดบ้านลูกค้า
        </p>
      </div>
      <button class="btn go" (click)="edit(null)">เพิ่มลูกค้าใหม่</button>
    </header>
    <div class="two">
      <section class="card">
        <input
          class="search"
          placeholder="ค้นหาชื่อ เบอร์โทร หรือที่อยู่"
          [ngModel]="q()"
          (ngModelChange)="q.set($event)"
        />
        @if (!list().length) {
          <p class="empty">
            ไม่พบลูกค้า ลองค้นหาด้วยคำอื่น หรือกด “เพิ่มลูกค้าใหม่”
          </p>
        } @else {
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>ชื่อและที่อยู่</th>
                  <th>เบอร์โทร</th>
                  <th>ห่างร้าน</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (c of list(); track c.id) {
                  <tr [class.sel]="c.id === f().id" (click)="edit(c)">
                    <td>
                      <b>{{ c.name }}</b
                      ><small>{{ c.address }}</small>
                    </td>
                    <td>{{ c.phone }}</td>
                    <td [class.warn]="far(c)">{{ dist(c).toFixed(1) }} กม.</td>
                    <td>
                      <button
                        class="btn ghost sm"
                        (click)="del(c); $event.stopPropagation()"
                      >
                        ลบ
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
      <div class="stack">
        <section class="card form">
          <h2>{{ f().id ? 'แก้ไขข้อมูลลูกค้า' : 'ลูกค้าใหม่' }}</h2>
          <div class="grid2">
            <label
              >ชื่อ<input
                [ngModel]="f().firstname"
                (ngModelChange)="set('firstname', $event)"
            /></label>
            <label
              >นามสกุล<input
                [ngModel]="f().lastname"
                (ngModelChange)="set('lastname', $event)"
            /></label>
          </div>
          <label
            >เบอร์โทร<input
              inputmode="tel"
              [ngModel]="f().phone"
              (ngModelChange)="set('phone', $event)"
          /></label>
          <label
            >ที่อยู่สำหรับส่ง<input
              [ngModel]="f().address"
              (ngModelChange)="set('address', $event)"
          /></label>
          <p class="ll">
            {{
              f().lat
                ? 'พิกัด ' + f().lat.toFixed(5) + ', ' + f().lng.toFixed(5)
                : 'ยังไม่ได้ปักหมุด กดบนแผนที่ด้านล่าง'
            }}
          </p>
          @if (tried()) {
            @for (e of errs(); track e) {
              <p class="err">{{ e }}</p>
            }
          }
          @if (apiErr()) {
            <p class="err">{{ apiErr() }}</p>
          }
          <div class="acts">
            <button class="btn go" [disabled]="busy()" (click)="save()">
              {{ busy() ? 'กำลังบันทึก…' : 'บันทึก' }}
            </button>
            @if (f().id) {
              <button class="btn ghost" (click)="edit(null)">ยกเลิก</button>
            }
          </div>
        </section>
        <div class="card mapbox sm">
          <app-map [pins]="pins()" [fit]="false" (pick)="at($event)" />
        </div>
      </div>
    </div>`,
})
export class CustomersPage {
  s = inject(Store);
  q = signal('');
  f = signal<Customer>(blank());
  tried = signal(false);
  busy = signal(false);
  apiErr = signal('');
  list = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.s
      .customers()
      .filter(
        (c) => !q || (c.name + c.phone + c.address).toLowerCase().includes(q),
      );
  });
  errs = computed(() => {
    const c = this.f(),
      e: string[] = [];
    if (!c.firstname.trim()) e.push('กรอกชื่อลูกค้า');
    if (!c.lastname.trim()) e.push('กรอกนามสกุลลูกค้า');
    if (!/^0\d{8,9}$/.test(c.phone.replace(/\D/g, '')))
      e.push('เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก ขึ้นต้นด้วย 0');
    if (!c.lat) e.push('ปักหมุดบ้านลูกค้าบนแผนที่');
    return e;
  });
  pins = computed<MapPin[]>(() => {
    const c = this.f();
    return [
      ...this.s
        .customers()
        .map((x) => ({
          lat: x.lat,
          lng: x.lng,
          text: '',
          color: x.id === c.id ? '#E23B1E' : '#7A8C85',
          small: true,
          tip: x.name,
        })),
      ...(c.lat
        ? [{ lat: c.lat, lng: c.lng, text: '', color: '#E23B1E' }]
        : []),
    ];
  });
  dist = (c: Customer) => km(SHOP, c);
  far = (c: Customer) => this.dist(c) > 3;
  set = (k: keyof Customer, v: string) =>
    this.f.update((o) => ({ ...o, [k]: v }));
  at = (p: { lat: number; lng: number }) =>
    this.f.update((o) => ({
      ...o,
      lat: +p.lat.toFixed(5),
      lng: +p.lng.toFixed(5),
    }));
  edit(c: Customer | null) {
    this.f.set(c ? { ...c } : blank());
    this.tried.set(false);
    this.apiErr.set('');
  }
  async save() {
    this.tried.set(true);
    if (this.errs().length) return;
    const c = this.f();
    this.busy.set(true);
    this.apiErr.set('');
    try {
      await this.s.saveCustomer({
        ...c,
        firstname: c.firstname.trim(),
        lastname: c.lastname.trim(),
        phone: c.phone.replace(/\D/g, ''),
      });
      this.edit(null);
    } catch (e) {
      this.apiErr.set(apiError(e)); // เช่น 409 เบอร์โทรนี้มีอยู่แล้ว
    } finally {
      this.busy.set(false);
    }
  }
  async del(c: Customer) {
    if (!confirm(`ลบ ${c.name}? ออเดอร์ของลูกค้ารายนี้จะถูกลบด้วย`)) return;
    try {
      await this.s.delCustomer(c.id);
      if (this.f().id === c.id) this.edit(null);
    } catch (e) {
      this.apiErr.set(apiError(e));
    }
  }
}
