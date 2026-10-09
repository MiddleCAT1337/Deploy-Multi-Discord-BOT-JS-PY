# DeployBot

DeployBot เป็นโปรแกรมบรรทัดคำสั่ง (CLI) สำหรับคุมบอท Discord หลายตัวจากหน้าต่าง terminal หน้าต่างเดียว ใช้ลงทะเบียนว่าแต่ละบอทอยู่โฟลเดอร์ไหน ใครเป็นเจ้าของ หมดอายุวันไหน แล้วสั่งเปิด ปิด หรือรีสตาร์ทได้ รองรับบอทที่เขียนด้วย Node.js หรือ Python โดยระบบจะเดาวิธีรันจากไฟล์ในโฟลเดอร์บอทให้เอง การคำนวณวันหมดอายุใช้โซนเวลา Asia/Bangkok ตลอด

## คลิปตัวอย่างการใช้งาน

ถ้าอยากดูภาพรวมว่าเปิดโปรแกรมแล้วหน้าจอเป็นยังไง พิมพ์คำสั่งอะไรบ้าง ลองดูคลิปนี้ก่อนได้

[DeployBot ตัวอย่างการใช้งาน](https://youtu.be/xYw65gAZPGg)

คลิปไม่ได้แทน README ทั้งหมด แต่ช่วยให้เห็น flow จริงตอนใช้งาน ส่วนรายละเอียดวันที่ ไฟล์ log และคำสั่งแต่ละตัวอธิบายไว้ในหัวข้อด้านล่าง

## การทำงานของโปรแกรม

ภาพรวมคือ DeployBot เป็นโปรแกรมหลักที่รันค้างไว้ อ่านรายการบอทจากไฟล์ แล้วเป็นคนสร้าง process ลูก (บอท Discord) ให้แต่ละตัว เก็บ PID และสถานะลงไฟล์เดียวกัน ผู้ใช้พิมพ์คำสั่งที่ prompt DeployBot> เพื่อจัดการรายการนั้น

ลำดับตอนเปิดโปรแกรม

1. index.js เป็นจุดเข้า ถ้ายังไม่ได้ใส่ flag ปิดคำเตือน DEP0190 ของ Node จะเปิด process ตัวเองซ้ำพร้อม flag นั้น แล้วค่อยโหลด src/main.js (nodeFlags.js)
2. main.js โหลด data/bots.json ผ่าน registry.js แล้วเรียก reconcileAll ใน processManager.js เพื่อเช็คว่า PID ที่บันทึกไว้ยังมี process จริงอยู่ไหม ถ้า process ตายแล้วจะอัปเดตสถานะเป็น stopped หรือ expired ตามวันหมดอายุ
3. syncExpiredStatus ใน expiry.js ปรับสถานะ expired ให้ตรงกับวันนี้ (Bangkok)
4. startAllRegisteredBots จะ start บอททุกตัวใน registry ที่ยังไม่หมดอายุและยังไม่รัน ก่อน start แต่ละตัว depsInstall.js อาจรัน npm install ในโฟลเดอร์บอท หรือ pip จาก requirements.txt / pyproject.toml ถ้าจำเป็น
5. repl.js เปิด readline แสดงตารางจาก display.js ครั้งแรก แล้วรอคำสั่ง
6. parser.js แปลงบรรทัดที่พิมพ์เป็นคำสั่ง ส่งต่อให้ commands.js ทำงานจริง
7. processManager.js spawn บอทด้วย child_process ตั้ง cwd เป็นโฟลเดอร์บอท ส่ง stdout/stderr ไปเขียน data/logs/bot-เลขลำดับ.log เก็บ PID และ status running ลง bots.json
8. ทุก 1 นาที main.js ตรวจ expiry อีกรอบ ถ้าเลยเที่ยงคืนหลังวันหมดอายุแล้วและบอทยัง running จะ stop ให้อัตโนมัติ

พฤติกรรมหน้าจอ (สำคัญ)

- ตอนเปิดครั้งแรกจะเห็นตารางสถานะเต็มหน้า
- หลังพิมพ์คำสั่งส่วใหญ่ (start, stop, new, help, debug ฯลฯ) โปรแกรมจะพิมพ์ผลลัพธ์ต่อท้ายบรรทัดเดิม ไม่ล้างจอและไม่ดึงตารางมาใหม่
- ถ้าอยากให้ตารางอัปเดตและล้างหน้าจอ ให้พิมพ์ clear หรือ status
- เหตุการณ์พื้นหลัง เช่น บอท crash หรือถูก stop เพราะหมดอายุ จะขึ้นข้อความสั้นๆ ต่อท้าย ไม่รีเฟรชทั้งหน้า
- พิมพ์ exit หรือกด Ctrl+C จะ stop บอทที่รันอยู่ทั้งหมดแล้วปิด DeployBot

เลขลำดับบอท (คอลัมน์ # ในตาราง) มาจาก id ใน bots.json ไม่เปลี่ยนเมื่อ stop หรือ restart คำสั่งที่อ้างบอทใช้รูปแบบ bot=เลขลำดับ เสมอ ถ้า remove บอทออก เลขนั้นจะไม่ถูกนำมาใช้ซ้ำ (nextId ในไฟล์ยังเดินต่อ)

## วันหมดอายุ (อ่านก่อนใส่ date=)

รูปแบบวันที่ในคำสั่งคือ DD/MM/YYYY คือ วัน/เดือน/ปี ไม่ใช่แบบเดือน/วันแบบสหรัฐ

ตัวอย่าง date=09/10/2026 หมายถึงวันที่ 9 ตุลาคม 2026

ความหมายของวันที่ที่ใส่

- วันที่ที่ใส่คือวันสุดท้ายที่บอทยังใช้ได้ทั้งวัน (โซน Bangkok)
- หลัง 00:00 น. ของวันถัดไป ระบบถือว่าหมดอายุ สถานะเป็น EXPIRED และจะไม่ให้ start จนกว่าจะ set หรือ addday
- ถ้าวันนี้ (Bangkok) มากกว่าวันหมดอายุที่ลงทะเบียน ตารางจะขึ้น Expired ทันที แม้จะเพิ่ง new ด้วยวันที่ในอดีตก็ตาม

ตัวอย่างที่มักสับสน

- วันนี้เป็น 9 ตุลาคม 2026 ถ้าใส่ date=30/09/2026 (30 กันยายน 2026) จะหมดอายุแล้ว เพราะเลยวันสุดท้ายที่ใช้ได้ไปแล้ว
- ถ้าตั้งใจให้หมดสิ้นเดือนตุลาคม 2026 ต้องใส่ date=31/10/2026 ไม่ใช่ 30/09/2026

## ฟีเจอร์

- ลงทะเบียนบอทหลายตัว แต่ละตัวมี path โฟลเดอร์ ชื่อเจ้าของ (Owner) และวันหมดอายุ
- คำสั่ง new หลังลงทะเบียนสำเร็จจะพยายาม start บอททันที ถ้าวันหมดอายุแล้วจะลงทะเบียนอย่างเดียวไม่รัน
- start, stop, restart, remove แยกตามเลขลำดับ
- หมดอายุแล้วห้าม start จนกว่าจะ set วันหมดใหม่หรือ addday
- ปิดอัตโนมัติหลังเที่ยงคืน (Bangkok) ของวันถัดไปหลังวันหมดอายุ
- เมื่อเปิด DeployBot บอทใน registry ที่ยังไม่หมดอายุจะถูก start ให้เองถ้ายังไม่รัน
- ติดตั้ง dependency อัตโนมัติ npm install สำหรับบอท Node และ pip ตามไฟล์ requirements สำหรับ Python รวมถึงลอง pip module ที่ขาดเมื่อ Python error แล้ว restart หนึ่งครั้ง
- debug bot=เลข ดู metadata และท้ายไฟล์ log
- รองรับ Windows และ Linux (platform.js จัดการ kill process tree และวิธีเรียก npm)

## เทคโนโลยีที่ใช้

- Node.js 18 ขึ้นไป (package.json กำหนด engines) โค้ดเป็น ES module
- luxon สำหรับวันที่และโซน Asia/Bangkok
- chalk สำหรับสีข้อความบน terminal
- child_process สำหรับ spawn และหยุด process บอท

## สิ่งที่ต้องมีก่อนติดตั้ง

- Node.js เวอร์ชัน 18 ขึ้นไป ตรวจด้วยคำสั่ง node -v
- บนเครื่องที่รันบอทแต่ละตัว ต้องมี npm ถ้าเป็นบอท Node หรือ python / python3 ถ้าเป็นบอท Python และเรียกจาก terminal ได้
- โฟลเดอร์บอท Discord ที่มีอย่างน้อยหนึ่งแบบต่อไปนี้
  - Node: package.json ที่มี script start หรือมี index.js / src/index.js
  - Python: main.py หรือ bot.py หรือ app.py

## วิธีติดตั้ง

1. เปิด terminal แล้วเข้าโฟลเดอร์ DeployBot (แก้ path ให้ตรงเครื่องตัวเอง)

```bash
cd C:\Users\YourName\Documents\Project\DeployBot
```

2. ติดตั้ง dependency ของตัวควบคุม DeployBot เอง (ไม่ใช่ของบอทลูก)

```bash
npm install
```

3. รันโปรแกรม

```bash
npm start
```

หรือ

```bash
node index.js
```

ทั้งสองแบบ index.js จะจัดการ flag --disable-warning=DEP0190 ให้เมื่อจำเป็น

## วิธีใช้งาน

หลังรันแล้วจะเห็นตารางสถานะและ prompt DeployBot> ด้านล่าง พิมพ์คำสั่งแล้วกด Enter ผลลัพธ์จะโผล่ต่อจากข้อความเดิม ถ้าตารางดูเก่าให้พิมพ์ clear

### ลงทะเบียนบอทใหม่ (และรันทันที)

```text
new path=C:\bots\my-bot date=09/10/2026 name=ชื่อลูกค้า
```

- path คือโฟลเดอร์ root ของบอท บน Linux ใช้แบบ /home/user/bots/my-bot
- date ใช้ DD/MM/YYYY ตามหัวข้อวันหมดอายุด้านบน
- name แสดงในคอลัมน์ Owner
- path มีช่องว่างให้ใส่เครื่องหมายคำพูดครอบ

```text
new path="C:\my bots\shop" date=31/12/2026 name=Alice
```

ถ้าลงทะเบียนสำเร็จและวันยังไม่หมด ระบบจะ start บอทให้เลย ข้อความประมาณ added bot=... running ถ้า start ไม่ได้จะบอก added แล้วตามด้วย start failed และเหตุผล ยังไม่ต้องพิมพ์ start bot= แยก ยกเว้นอยากลอง start ใหม่หลังแก้ปัญหา

เลขลำดับใหม่ (1, 2, 3, ...) เก็บใน data/bots.json

### เปิด ปิด รีสตาร์ท ลบ

```text
start bot=1
stop bot=1
restart bot=1
remove bot=1
```

- start ใช้เมื่อบอทหยุดอยู่และยังไม่หมดอายุ
- restart ใช้หลังแก้โค้ดในโฟลเดอร์บอท ระบบจะ detect คำสั่ง start ใหม่แล้วรัน process ใหม่
- stop หยุด process บน Windows ใช้ taskkill แบบ tree บน Linux ใช้ signal กับ process group
- remove stop ก่อนแล้วลบรายการออกจาก bots.json ไฟล์ log เดิมยังอยู่ใน data/logs ถ้าไม่ลบด้วยมือ

### จัดการวันหมดอายุ

```text
set bot=1 date=15/11/2026
addday bot=1 day=30
```

- set ตั้งวันหมดอายุใหม่ทั้งก้อน (วันสุดท้ายที่ใช้ได้)
- addday บวกจำนวนวัน ถ้ายังไม่หมดจะบวกจากวันหมดเดิม ถ้าหมดแล้วจะนับจากวันนี้ (Bangkok)

### ดูตาราง ช่วยเหลือ debug ออกจากโปรแกรม

```text
status
clear
debug bot=1
debug bot=1 lines=80
help
exit
```

- status และ clear ล้างจอแล้ววาดตารางใหม่ sync PID ก่อนแสดง
- debug แสดง path, PID, runtime, คำสั่ง start, วันหมด และท้ายไฟล์ log
- help แสดงรายการคำสั่งแบบสั้น
- exit หรือ Ctrl+C ปิด DeployBot และ stop บอทที่รันอยู่ทั้งหมด

### สิ่งที่ควรรู้เวลาใช้งาน

- Log แต่ละบอทอยู่ที่ data/logs/bot-เลขลำดับ.log เปิดด้วย editor หรือใช้ debug bot=เลข
- อย่าแก้ id ใน data/bots.json ด้วยมือ ใช้คำสั่ง remove แทน
- บอท Node ที่มี package.json จะใช้ npm start ถ้ามี script start ไม่งั้น node index.js หรือ node src/index.js
- บอท Python จะลอง main.py แล้ว bot.py แล้ว app.py ตามลำดับ

## ไฟล์ข้อมูลและ log

data/bots.json เก็บรายการบอททั้งหมด โครงสร้างหลักที่ควรรู้

- nextId เลข id ถัดไปเมื่อ new (ไม่ลดลงเมื่อ remove)
- bots เป็น array แต่ละตัวมี id, name, path, expiryDate (รูปแบบ YYYY-MM-DD ในไฟล์), runtime, startCommand, pid, status

DeployBot เป็นคนเขียนไฟล์นี้ให้ ไม่ควรแก้ expiryDate หรือ id เองถ้าไม่จำเป็น ใช้ set และ addday แทน

data/logs เก็บ log การรันของแต่ละบอท ไฟล์ใหม่จะ append ต่อท้ายเมื่อ start ใหม่

## โครงสร้างโฟลเดอร์และหน้าที่ไฟล์

```text
DeployBot
  index.js                 จุดเข้า เรียก nodeFlags แล้วโหลด main
  package.json             dependency ของตัวควบคุม
  data
    bots.json              registry บอท (สร้าง/อัปเดตอัตโนมัติ)
    logs                     log ต่อบอท bot-1.log bot-2.log ...
  src
    main.js                เปิด repl, auto-start, scheduler หมดอายุ
    nodeFlags.js           re-exec พร้อม --disable-warning=DEP0190
    cli
      parser.js            แปลงบรรทัดคำสั่ง
      repl.js              readline, clear/status, append ผลคำสั่ง
      help.js              ข้อความ help
    core
      registry.js          อ่าน/เขียน bots.json, allocate id, remove
      processManager.js    spawn, stop, reconcile PID, auto-start ทั้งหมด
      expiry.js            parse วันที่, หมดอายุ, addday, scheduler logic
      runtimeDetect.js     เดา Node vs Python และคำสั่ง start
      depsInstall.js       npm install / pip ตามโฟลเดอร์บอท
      display.js           ตาราง dashboard และข้อความ ok/err
      debugBot.js          รายงาน debug และ tail log
      platform.js          Windows vs Linux kill และ spawn
      spawnUtil.js         แปลงคำสั่ง start เป็น spawn (รวม npm บน Windows)
      statusEvents.js      แจ้งเหตุการณ์บอทไป repl
      paths.js             path ไป data และ logs
```

## ตรวจสอบก่อนใช้งานจริง

- ลอง new ด้วยวันที่ยังไม่หมด แล้วดูว่าบอท online ใน Discord หรือไม่
- ถ้าไม่ขึ้น ใช้ debug bot=เลข หรือเปิด data/logs/bot-เลข.log ดู error ท้ายไฟล์
- ลอง clear ดูว่าตาราง PID และสถานะตรงกับที่คาดไหม
- ดูคลิปตัวอย่างที่ลิงก์ด้านบนเทียบกับหน้าจอตัวเองว่าขั้นตอนตรงกันไหม
