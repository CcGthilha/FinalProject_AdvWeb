import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MapLine, MapPin, MapView } from './map';
import { LIMIT, MAXO, Route, SHOP, Settings, Totals } from './models';
import { build, solveMany, totals } from './optimizer';
import { Store } from './store.service';
import { baht, clock } from './util';

interface Alt {
  sig: string;
  routes: Route[];
  tot: Totals;
}
const chunks = (a: number[]) =>
  Array.from({ length: Math.ceil(a.length / MAXO) }, (_, i) =>
    a.slice(i * MAXO, (i + 1) * MAXO),
  );

@Component({
  imports: [MapView, RouterLink, FormsModule],
  template: ` <header class="page">
      <div>
        <h1>เส้นทางส่ง</h1>
        <p class="sub">
          ออกจากร้าน {{ t(0) }} ต้องถึงลูกค้าทุกคนก่อน {{ t(60) }}
        </p>
      </div>
      <div class="acts">
        <button class="btn go big" (click)="run()">จัดเส้นทางตอนนี้</button>
        @if (pool().length) {
          <button class="btn ghost" (click)="run(true)">
            คำนวณใหม่ ดูเส้นทางอื่น
          </button>
        }
      </div>
    </header>
    @if (msg()) {
      <p class="note warnbox">{{ msg() }}</p>
    }
    <details class="card set">
      <summary>ตั้งค่าการคำนวณ</summary>
      <div class="grid4">
        <label
          >ความเร็วไรเดอร์ (กม./ชม.)<input
            type="number"
            min="5"
            [ngModel]="s.settings().speed"
            (ngModelChange)="setSet('speed', +$event || 30)"
        /></label>
        <label
          >ตัวคูณถนนคดเคี้ยว<input
            type="number"
            step="0.1"
            min="1"
            [ngModel]="s.settings().road"
            (ngModelChange)="setSet('road', +$event || 1.3)"
        /></label>
        <label
          >เวลาส่งต่อจุด (นาที)<input
            type="number"
            min="0"
            [ngModel]="s.settings().stopMin"
            (ngModelChange)="setSet('stopMin', +$event || 0)"
        /></label>
        <label
          >เวลาออกจากร้าน<input
            type="time"
            [ngModel]="s.settings().depart"
            (ngModelChange)="setSet('depart', $event || '11:30')"
        /></label>
        <label class="chk"
          ><input
            type="checkbox"
            [ngModel]="s.settings().back"
            (ngModelChange)="setSet('back', $event)"
          />คิดค่าส่งรวมขากลับร้านด้วย</label
        >
      </div>
      <p class="hint">
        ระยะทางคำนวณจากเส้นตรงคูณตัวคูณถนนคดเคี้ยว ค่าส่ง = 15 บาท + 2 ×
        จำนวนกล่อง × กม. ทั้งรอบ เปลี่ยนค่าแล้วต้องกดจัดเส้นทางใหม่
      </p>
    </details>

    @if (!routes().length) {
      <section class="card hero">
        <h2>รอให้อาหารเสร็จ แล้วกดปุ่มเดียว</h2>
        <p>
          ตอนนี้มี {{ s.items().length }} ออเดอร์ รวม {{ boxCount() }} กล่อง
          ระบบจะแบ่งให้ไรเดอร์คนละไม่เกิน {{ MAXO }} ออเดอร์ (ต้องใช้อย่างน้อย
          {{ minRiders() }} คน) เรียงจุดส่ง
          และเลือกกลุ่มที่ค่าส่งรวมต่ำสุดโดยยังส่งทันเวลา
        </p>
      </section>
    } @else {
      @if (tot().late) {
        <p class="note bad">
          มี {{ tot().late }} จุดที่ถึงหลัง
          {{ t(60) }} กดคำนวณใหม่เพื่อดูทางเลือกอื่น หรือเพิ่มไรเดอร์ในร้าน
        </p>
      } @else if (tot().profit < 0) {
        <p class="note bad">
          เส้นทางนี้ขาดทุน
          {{ baht(-tot().profit) }} กดคำนวณใหม่เพื่อหาทางเลือกที่ค่าส่งต่ำลง
        </p>
      } @else {
        <p class="note ok">
          ส่งทันทุกจุด จุดสุดท้ายถึงประมาณ {{ t(tot().end) }}
          @if (saving() > 0) {
            และประหยัดค่าส่ง
            {{
              baht(saving())
            }}
            เมื่อเทียบกับให้ไรเดอร์ไปตามลำดับออเดอร์ที่เข้ามา
          }
        </p>
      }

      <section class="stats">
        <div>
          <b>{{ tot().orders }}</b
          ><span>ออเดอร์ ({{ tot().boxes }} กล่อง)</span>
        </div>
        <div>
          <b>{{ tot().riders }}</b
          ><span>ไรเดอร์ที่ใช้</span>
        </div>
        <div>
          <b>{{ tot().km.toFixed(1) }}</b
          ><span>กม. รวมทุกคน</span>
        </div>
        <div>
          <b>{{ baht(tot().rev) }}</b
          ><span>รายได้</span>
        </div>
        <div>
          <b>{{ baht(tot().food) }}</b
          ><span>ต้นทุนอาหาร</span>
        </div>
        <div>
          <b>{{ baht(tot().fee) }}</b
          ><span>ค่าส่งไรเดอร์</span>
        </div>
        <div class="profit" [class.neg]="tot().profit < 0">
          <b>{{ baht(tot().profit) }}</b
          ><span>กำไรสุทธิ</span>
        </div>
      </section>

      @if (pool().length > 1) {
        <div class="alts">
          @for (a of pool(); track a.sig; let i = $index) {
            <button [class.on]="i === sel()" (click)="sel.set(i)">
              ทางเลือก {{ i + 1 }} กำไร {{ baht(a.tot.profit) }}
              @if (i === best()) {
                <em>ดีที่สุด</em>
              }
            </button>
          }
        </div>
      }

      <div class="dgrid">
        <div class="card mapbox">
          <app-map [pins]="pins()" [lines]="lines()" [fit]="focus() === null" />
        </div>
        <div class="riders">
          <div class="axisrow">
            <span>{{ t(0) }}</span
            ><span [style.left.%]="x(60)">{{ t(60) }}</span>
          </div>
          @for (r of routes(); track r.rider) {
            <article
              class="rider"
              [class.dim]="focus() !== null && focus() !== r.rider"
              (click)="focus.set(focus() === r.rider ? null : r.rider)"
            >
              <div class="rh">
                <i class="dot" [style.background]="r.color"></i
                ><b>ไรเดอร์ {{ r.rider }}</b>
                <span
                  >{{ r.stops.length }} จุด {{ r.boxes }} กล่อง
                  {{ r.km.toFixed(1) }} กม.</span
                ><strong>{{ baht(r.fee) }}</strong>
              </div>
              <div class="lane">
                <span class="over" [style.left.%]="x(60)"></span>
                @for (p of r.stops; track p.id; let i = $index) {
                  <span
                    class="tick"
                    [class.late]="p.at > LIMIT"
                    [style.left.%]="x(p.at)"
                    [style.background]="r.color"
                    >{{ i + 1 }}</span
                  >
                }
              </div>
              <ol class="stops">
                @for (p of r.stops; track p.id) {
                  <li>
                    {{ p.name }}
                    <small>{{ p.boxes }} กล่อง ถึง {{ t(p.at) }}</small>
                  </li>
                }
              </ol>
              @if (confirmed()) {
                <div class="code">
                  รหัสใบงาน <b>{{ r.code }}</b>
                  <a
                    [routerLink]="['/rider', r.code]"
                    target="_blank"
                    (click)="$event.stopPropagation()"
                    >เปิดหน้าไรเดอร์</a
                  >
                  <small>ส่งแล้ว {{ done(r) }}/{{ r.stops.length }}</small>
                </div>
              }
            </article>
          }
        </div>
      </div>
      <div class="confirm">
        @if (confirmed()) {
          <p>
            สร้างใบงานแล้ว แจ้งรหัส 4 หลักให้ไรเดอร์แต่ละคน
            แล้วให้เปิดหน้าไรเดอร์เพื่อกรอกรหัส
          </p>
        } @else {
          <p>ถ้าพอใจกับเส้นทางนี้ ยืนยันเพื่อออกรหัสใบงานให้ไรเดอร์</p>
          <button
            class="btn go big"
            [disabled]="tot().late > 0"
            (click)="confirmPlan()"
          >
            ยืนยันและสร้างใบงาน
          </button>
        }
      </div>
    }`,
})
export class DispatchPage {
  s = inject(Store);
  baht = baht;
  LIMIT = LIMIT;
  MAXO = MAXO;
  pool = signal<Alt[]>(
    this.s.plan()
      ? [
          {
            sig: this.s.plan()!.sig,
            routes: this.s.plan()!.routes,
            tot: totals(this.s.plan()!.routes),
          },
        ]
      : [],
  );
  sel = signal(0);
  focus = signal<number | null>(null);
  msg = signal('');
  cur = computed(() => this.pool()[this.sel()]);
  confirmed = computed(
    () => !!this.cur() && this.s.plan()?.sig === this.cur().sig,
  );
  routes = computed(() =>
    this.confirmed() ? this.s.plan()!.routes : (this.cur()?.routes ?? []),
  );
  tot = computed(() => totals(this.routes()));
  axis = computed(() => Math.max(75, Math.ceil(this.tot().end) + 5));
  boxCount = computed(() => this.s.items().reduce((a, i) => a + i.boxes, 0));
  minRiders = computed(() => Math.ceil(this.s.items().length / MAXO));
  saving = computed(() => {
    const it = this.s.items();
    return (
      totals(build(chunks(it.map((i) => i.id)), it, this.s.settings(), true))
        .fee - this.tot().fee
    );
  });
  best = computed(() => {
    let b = -1,
      v = -Infinity;
    this.pool().forEach((a, i) => {
      const x = a.tot.profit - a.tot.late * 2000;
      if (x > v) {
        v = x;
        b = i;
      }
    });
    return b;
  });
  pins = computed<MapPin[]>(() =>
    this.routes().flatMap((r) =>
      r.stops.map((p, i) => ({
        lat: p.lat,
        lng: p.lng,
        text: String(i + 1),
        color: r.color,
        on: this.on(r.rider),
        tip: `${p.name} ${p.boxes} กล่อง ถึง ${this.t(p.at)}`,
      })),
    ),
  );
  lines = computed<MapLine[]>(() =>
    this.routes().map((r) => ({
      color: r.color,
      on: this.on(r.rider),
      pts: [
        [SHOP.lat, SHOP.lng],
        ...r.stops.map((p) => [p.lat, p.lng]),
        ...(this.s.settings().back ? [[SHOP.lat, SHOP.lng]] : []),
      ] as [number, number][],
    })),
  );

  t = (m: number) => clock(this.s.settings().depart, m);
  x = (m: number) => Math.min(100, (m / this.axis()) * 100);
  on = (r: number) => this.focus() === null || this.focus() === r;
  done = (r: Route) => r.stops.filter((p) => p.done).length;
  setSet(k: keyof Settings, v: number | string | boolean) {
    this.s.settings.update((o) => ({ ...o, [k]: v }));
    this.pool.set([]);
    this.sel.set(0);
    this.focus.set(null);
    this.msg.set('');
  }

  run(more = false) {
    const items = this.s.items();
    this.msg.set('');
    this.focus.set(null);
    if (!items.length) {
      this.msg.set('ยังไม่มีออเดอร์ ไปเพิ่มที่หน้าออเดอร์ก่อน');
      return;
    }
    const st = this.s.settings(),
      have = new Set(this.pool().map((p) => p.sig)),
      add = more && this.pool().length > 0;
    const found = solveMany(items, st, Math.floor(Math.random() * 1e6), 20)
      .filter((a) => !have.has(a.sig))
      .slice(0, add ? 3 : 6)
      .map((a) => {
        const routes = build(a.g, items, st);
        return { sig: a.sig, routes, tot: totals(routes) };
      });
    if (!add) {
      this.pool.set(found);
      this.sel.set(0);
    } else if (found.length) {
      const n = this.pool().length;
      this.pool.update((p) => [...p, ...found]);
      this.sel.set(n);
    } else {
      this.sel.update((i) => (i + 1) % this.pool().length);
      this.msg.set(
        'ไม่พบเส้นทางใหม่ที่ต่างจากเดิมแล้ว แสดงทางเลือกถัดไปที่เคยคำนวณไว้',
      );
    }
  }
  confirmPlan() {
    const c = this.cur();
    this.s.confirm(c.routes, c.sig);
  }
}
