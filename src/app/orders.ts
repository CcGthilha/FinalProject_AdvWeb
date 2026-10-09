import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PRICE } from './models';
import { Store } from './store.service';
import { baht } from './util';

@Component({
  imports: [FormsModule],
  template: ` <header class="page">
      <div>
        <h1>ออเดอร์</h1>
        <p class="sub">
          {{ rows().length }} ออเดอร์ {{ boxes() }} กล่อง คิดเป็นรายได้
          {{ baht(boxes() * PRICE) }}
        </p>
      </div>
      <div class="acts">
        <label class="inl"
          >จำนวนออเดอร์<input
            type="number"
            min="1"
            [max]="s.customers().length"
            [ngModel]="n()"
            (ngModelChange)="n.set(+$event || 1)"
        /></label>
        <button class="btn go" (click)="s.simulate(n())">
          จำลองออเดอร์ที่เข้ามาพร้อมกัน
        </button>
        <button class="btn ghost" (click)="clear()">ล้างทั้งหมด</button>
      </div>
    </header>
    <section class="card">
      <div class="add">
        <label
          >ลูกค้า<select [ngModel]="cid()" (ngModelChange)="cid.set(+$event)">
            <option [ngValue]="0">เลือกลูกค้า</option>
            @for (c of s.customers(); track c.id) {
              <option [ngValue]="c.id">{{ c.name }}</option>
            }
          </select></label
        >
        <label
          >จำนวน<select [ngModel]="nb()" (ngModelChange)="nb.set(+$event)">
            @for (k of [1, 2, 3]; track k) {
              <option [ngValue]="k">{{ k }} กล่อง</option>
            }
          </select></label
        >
        <button class="btn go" [disabled]="!cid()" (click)="add()">
          เพิ่มออเดอร์
        </button>
        <p class="hint">หนึ่งออเดอร์สั่งได้ไม่เกิน 3 กล่อง</p>
      </div>
      @if (!rows().length) {
        <p class="empty">
          ยังไม่มีออเดอร์ เพิ่มทีละรายการ หรือกด “จำลองออเดอร์ที่เข้ามาพร้อมกัน”
          เพื่อทดสอบระบบ
        </p>
      } @else {
        <div class="scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>ลูกค้า</th>
                <th>จำนวน</th>
                <th>ยอดขาย</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (o of rows(); track o.id) {
                <tr>
                  <td>{{ o.id }}</td>
                  <td>
                    <b>{{ o.name }}</b
                    ><small>{{ o.address }}</small>
                  </td>
                  <td>
                    <select
                      [ngModel]="o.boxes"
                      (ngModelChange)="s.setBoxes(o.id, +$event)"
                    >
                      @for (k of [1, 2, 3]; track k) {
                        <option [ngValue]="k">{{ k }} กล่อง</option>
                      }
                    </select>
                  </td>
                  <td>{{ baht(o.boxes * PRICE) }}</td>
                  <td>
                    <button class="btn ghost sm" (click)="s.delOrder(o.id)">
                      ลบ
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>`,
})
export class OrdersPage {
  s = inject(Store);
  baht = baht;
  PRICE = PRICE;
  n = signal(25);
  cid = signal(0);
  nb = signal(1);
  rows = computed(() =>
    this.s.orders().flatMap((o) => {
      const c = this.s.customers().find((x) => x.id === o.customerId);
      return c ? [{ ...o, name: c.name, address: c.address }] : [];
    }),
  );
  boxes = computed(() => this.rows().reduce((a, o) => a + o.boxes, 0));
  add() {
    this.s.addOrder(this.cid(), this.nb());
    this.cid.set(0);
    this.nb.set(1);
  }
  clear() {
    if (confirm('ลบออเดอร์ทั้งหมดของวันนี้?')) this.s.clearOrders();
  }
}
