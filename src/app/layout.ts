import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Store } from './store.service';

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
<div class="shell">
  <aside>
    <div class="brand"><b>ข้าวกล่อง<br>เดลิเวอรี่</b><span>ศูนย์จัดส่งช่วงเที่ยง</span></div>
    <nav>
      <a routerLink="/customers" routerLinkActive="on">ลูกค้า</a>
      <a routerLink="/orders" routerLinkActive="on">ออเดอร์</a>
      <a routerLink="/dispatch" routerLinkActive="on">จัดเส้นทางส่ง</a>
    </nav>
    <a class="rlink" routerLink="/rider" target="_blank">เปิดหน้าสำหรับไรเดอร์</a>
  </aside>
  <main>
    @if (s.err()) {
      <p class="note bad">{{ s.err() }} <button class="btn ghost sm" (click)="s.err.set(''); s.init()">ลองใหม่</button></p>
    }
    <router-outlet />
  </main>
</div>`,
})
export class Layout {
  s = inject(Store);
  constructor() {
    this.s.init(); // โหลดลูกค้า ออเดอร์ ตั้งค่า จาก API ครั้งเดียวตอนเข้าแอปฝั่งร้าน
  }
}
