# DeployBot

DeployBot เป็น CLI สำหรับคุมบอท Discord หลายตัวจาก terminal หน้าต่างเดียว ลงทะเบียน path โฟลเดอร์บอท ชื่อเจ้าของ และวันหมดอายุ แล้วสั่งเปิด ปิด รีสตาร์ทได้ รองรับบอท Node.js และ Python (เดาวิธีรันจากไฟล์ในโฟลเดอร์) คำนวณวันหมดอายุด้วยโซน **Asia/Bangkok** เท่านั้น

---

## คลิปตัวอย่างการใช้งาน

[DeployBot ตัวอย่างการใช้งาน](https://youtu.be/xYw65gAZPGg)

ดูภาพรวมหน้าจอและ flow จริงได้จากคลิป รายละเอียดคำสั่งและวันหมดอายุอยู่ใน README นี้

---

## การทำงานของโปรแกรม

โปรแกรมหลักรันค้างไว้ อ่านรายการจาก `data/bots.json` แล้ว spawn process บอทแต่ละตัว เก็บ PID และสถานะ ผู้ใช้พิมพ์ที่ `DeployBot>`

```
เปิด index.js → nodeFlags (DEP0190) → main.js
  → โหลด registry → reconcile PID
  → auto-start บอทที่ยังไม่หมดอายุ
  → repl แสดงตาราง → รอคำสั่ง

พิมพ์คำสั่ง → parser → commands → processManager / registry / expiry
```

| ไฟล์ / โมดูล | หน้าที่ |
| --- | --- |
| `index.js` | จุดเข้า เช็ก Node >= 18 โหลด main |
| `src/main.js` | auto-start, scheduler หมดอายุทุก 1 นาที, เปิด REPL |
| `src/core/registry.js` | อ่าน/เขียน `bots.json`, id ถาวร |
| `src/core/processManager.js` | spawn, stop, reconcile, log |
| `src/core/expiry.js` | วันหมด, `day=` สำหรับ new, `addday`, auto-stop |
| `src/cli/repl.js` | ตารางครั้งแรก, append ผลคำสั่ง, `clear`/`status` รีเฟรช |
| `src/core/depsInstall.js` | `npm install` / pip ก่อน start บอท |

### พฤติกรรมหน้าจอ

- เปิดครั้งแรก → ตารางสถานะเต็มหน้า
- หลังคำสั่งส่วใหญ่ → ข้อความ `[OK]` / `[ERR]` **ต่อท้าย** ไม่ล้างจอ
- อยากอัปเดตตาราง → พิมพ์ **`clear`** หรือ **`status`**
- บอท crash / หมดอายุ → ข้อความสั้นต่อท้าย (ไม่รีเฟรชทั้งหน้า)
- **`exit`** หรือ Ctrl+C → stop บอททั้งหมดแล้วปิด DeployBot

> เลข `#` ในตาราง = `id` ใน `bots.json` ไม่เปลี่ยนเมื่อ stop/restart หลัง `remove` เลขนั้นไม่ถูกใช้ซ้ำ (`nextId` เดินต่อ)

---

## วันหมดอายุ (Bangkok)

| คำสั่ง | รูปแบบ | ความหมาย |
| --- | --- | --- |
| `new` | `day=<จำนวนเต็ม ≥ 1>` | นับจาก**วันนี้** (Bangkok) → วันสุดท้ายที่ใช้ได้ = วันนี้ + day วัน |
| `set` | `date=DD/MM/YYYY` | ตั้งวันหมดเป็นวันนั้น (วันสุดท้ายที่ใช้ได้) |
| `addday` | `day=<n>` | บวกวัน — จากวันหมดเดิม หรือจากวันนี้ถ้าหมดแล้ว |

- หลัง **00:00 น.** ของวันถัดไปหลังวันหมด → สถานะ **EXPIRED**, ห้าม `start` จนกว่าจะ `set` / `addday`
- ตัวอย่าง: วันนี้ 10/10/2026, `new ... day=30` → วันหมดแสดงประมาณ **09/11/2026**

---

## ฟีเจอร์

- ลงทะเบียนหลายบอท (path, Owner, วันหมด)
- **`new`** สำเร็จแล้ว **start ทันที** (ถ้ายังไม่หมดอายุ)
- `start` / `stop` / `restart` / `remove` ตาม `bot=<id>`
- เปิด DeployBot → auto-start บอทใน registry ที่ยังไม่หมดและยังไม่รัน
- auto `npm install` / pip; Python ขาด module → pip แล้ว retry หนึ่งครั้ง
- `debug bot=<id>` ดู metadata + tail log
- Windows และ Linux (`platform.js`, npm บน Windows ผ่าน `cmd.exe`)

---

## เทคโนโลยีที่ใช้

- Node.js **18+** (ES module) — ตรวจที่ `index.js`
- luxon (Asia/Bangkok), chalk, child_process

---

## สิ่งที่ต้องมีก่อนติดตั้ง

- **Node.js 18 ขึ้นไป** (`node -v`) — Node 12/14 รันไม่ได้
- บอท Node: **npm** | บอท Python: **python3** / **python**
- โฟลเดอร์บอท: `package.json` + script `start` หรือ `index.js` / `main.py` / `bot.py` / `app.py`

> DeployBot **ไม่**ใส่ Discord token ให้ — แต่ละบอทต้องมี `.env` / config ของตัวเอง ถ้า log ขึ้น `invalid token` ให้แก้ที่โฟลเดอร์บอท ไม่ใช่ที่ DeployBot

---

## วิธีติดตั้ง

1. เข้าโฟลเดอร์โปรเจกต

```bash
cd /path/to/DeployBot
```

2. ติดตั้ง dependency ตัวควบคุม

```bash
npm install
```

3. รัน

```bash
npm start
```

หรือ `node index.js` (จัดการ `--disable-warning=DEP0190` ให้เมื่อจำเป็น)

---

## วิธีใช้งาน

หลังรัน → ตาราง + `DeployBot>` พิมพ์คำสั่งแล้ว Enter

### ลงทะเบียน + รัน

```text
new path=/root/bots/my-bot day=30 name=ชื่อลูกค้า
new path="C:\my bots\shop" day=90 name=Alice
```

- **path** = root โฟลเดอร์บอท
- **day** = จำนวนวันเต็มจากวันนี้ (Bangkok)
- **name** = คอลัมน์ Owner

### ควบคุมบอท

```text
start bot=1
stop bot=1
restart bot=1
remove bot=1
```

### วันหมดอายุ

```text
set bot=1 date=15/11/2026
addday bot=1 day=30
adddayall day=1
```

- `adddayall` — บวกวันหมดให้**ทุกตัว**ใน registry (กติกาเดียวกับ `addday` ต่อบอท)

(`date` = DD/MM/YYYY)

### อื่นๆ

```text
clear
status
debug bot=1
debug bot=1 lines=80
help
exit
```

| คำสั่ง | ทำอะไร |
| --- | --- |
| `clear` / `status` | ล้างจอ + วาดตารางใหม่ (sync PID) |
| `debug` | path, PID, start command, expiry, tail log |
| `help` | สรุปคำสั่ง |
| `exit` | stop บอททั้งหมดแล้วออก |

### Log และข้อมูล

- Log: `data/logs/bot-<id>.log`
- Registry: `data/bots.json` — อย่าแก้ `id` มือ ใช้ `remove` / `set` / `addday`

---

## โครงสร้างโฟลเดอร์

```text
DeployBot
  index.js
  package.json
  data
    bots.json
    logs
  src
    main.js
    nodeFlags.js
    cli          parser, repl, help
    core         registry, processManager, expiry, display, deps, debug, platform, ...
```

---

## ตรวจก่อนใช้งานจริง

- ✓ `node -v` ได้ 18+
- ✓ `new ... day=30` แล้วบอท online ใน Discord (token ถูกในโฟลเดอร์บอท)
- ✓ ไม่ขึ้น → `debug bot=1` หรือเปิด log ท้ายไฟล์
- ✓ `clear` แล้ว PID/สถานะตรงความจริง

---

## ประวัติการแก้ไข (Changelog)

อิงเวอร์ชันใน `package.json` และการพัฒนาล่าสุดของโปรเจกต (README สะท้อนฟีเจอร์ปัจจุบัน)

### 1.1.1 — 2026-10-10

- **เพิ่ม:** `adddayall day=<n>` บวกวันหมดให้บอททุกตัวใน registry

### 1.1.0 — 2026-10-10

- **เพิ่ม:** คำสั่ง `new` ใช้ `day=` คำนวณวันหมดจากวันนี้ (Bangkok) แทน `date=` ตอนลงทะเบียน
- **เพิ่ม:** หลัง `new` สำเร็จ start บอททันที
- **เพิ่ม:** `remove bot=<id>` ลบออกจาก registry
- **เปลี่ยน:** ผลคำสั่งพิมพ์ต่อท้าย ไม่ล้างจอ — ใช้ `clear` / `status` เพื่อตารางใหม่
- **เปลี่ยน:** ยกเลิก refresh ตารางอัตโนมัติทุก 30 วินาที
- **แก้ไข:** `index.js` ไม่ใช้ top-level await + แจ้งชัดเมื่อ Node ต่ำกว่า 18
- **แก้ไข:** spawn `npm` บน Windows ผ่าน `cmd.exe` (ลด EINVAL / DEP0190)
- **เอกสาร:** README + คลิปตัวอย่าง [YouTube](https://youtu.be/xYw65gAZPGg)

### 1.0.0 — 2026-10-09

- **เพิ่ม:** CLI หลายบอท, registry `bots.json`, วันหมด Bangkok, auto-start, deps auto-install
- **เพิ่ม:** `start` / `stop` / `restart`, `set`, `addday`, `debug`, auto-stop หลังเที่ยงคืนวันหลังหมดอายุ
- **เพิ่ม:** รองรับ Windows และ Linux
