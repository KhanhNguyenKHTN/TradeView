# TradeView

Website quản lý tài chính cá nhân cho các nhóm tài sản:

- Vàng
- Tiết kiệm
- Chứng khoán
- Coin

Ứng dụng gồm:

- **Frontend:** React + Vite + TypeScript
- **Backend:** NestJS + TypeScript
- **Database:** MySQL / MariaDB + Prisma ORM
- **Deployment target:** Debian arm64

---

## 1. Tính năng hiện có

### Dashboard
- Tổng vốn đầu tư
- Tổng giá trị thị trường hiện tại
- Tổng lãi/lỗ
- Tổng hợp theo từng danh mục đầu tư

### Danh mục đầu tư
- Quản lý tài sản theo nhóm:
  - GOLD
  - SAVING
  - STOCK
  - COIN

### Quản lý mua / bán
- Nhập giao dịch mua
- Nhập giao dịch bán
- Lưu các mốc giá mua / bán theo thời gian

### Giá hiện tại
- Lưu giá theo nguồn:
  - `AUTO`
  - `MANUAL`

### API backend
- `GET /api/categories`
- `GET /api/assets`
- `POST /api/assets`
- `GET /api/assets/:id`
- `GET /api/transactions`
- `POST /api/transactions`
- `GET /api/prices/latest`
- `POST /api/prices`
- `GET /api/dashboard`

---

## 2. Cấu trúc thư mục

```text
TradeView/
├─ backend/   # NestJS + Prisma + MySQL
└─ frontend/  # React + Vite
```

---

## 3. Backend

## 3.1 Công nghệ
- NestJS
- Prisma
- MySQL / MariaDB

> Prisma hiện dùng MariaDB thông qua `provider = "mysql"` trong `schema.prisma`, không cần đổi sang provider khác.

## 3.2 Schema dữ liệu chính

### AssetCategory
Danh mục đầu tư:
- GOLD
- SAVING
- STOCK
- COIN

### Asset
Thông tin tài sản theo dõi:
- mã tài sản
- tên tài sản
- đơn vị
- ghi chú
- thuộc một danh mục đầu tư

### Transaction
Thông tin mua / bán:
- loại giao dịch: `BUY` / `SELL`
- số lượng
- giá
- phí
- thời gian giao dịch
- ghi chú

### PriceSnapshot
Giá thị trường hiện tại:
- giá
- nguồn giá: `AUTO` / `MANUAL`
- thời điểm ghi nhận

---

## 4. Frontend

Giao diện React hiện có các phần:

- Hero / tổng quan tài chính
- Dashboard tổng hợp theo danh mục
- Bảng danh sách tài sản
- Danh sách giá hiện tại
- Form nhập giao dịch mua / bán
- Form cập nhật giá hiện tại
- Form thêm tài sản theo dõi
- Danh sách hoạt động gần đây
- Preview các endpoint backend

Hiện tại frontend đang dùng **mock data** để hiển thị giao diện hoàn chỉnh. Backend API đã sẵn sàng để bước tiếp theo nối dữ liệu thật.

---

## 5. Yêu cầu môi trường

- Node.js 20+
- npm 10+
- MySQL 8+ hoặc MariaDB tương thích MySQL
- Debian arm64 hoặc môi trường local Windows/Linux/macOS

---

## 6. Chạy local

## 6.1 Tạo database MySQL

Ví dụ tạo database:

```sql
CREATE DATABASE tradeview CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 6.2 Cấu hình biến môi trường backend

Tạo file:

```text
backend/.env
```

Nội dung ví dụ:

```env
DATABASE_URL="mysql://root:password@localhost:3306/tradeview"
PORT=3000
```

Có thể dùng cùng format connection string này cho MariaDB vì Prisma kết nối MariaDB qua provider `mysql`.

Ví dụ MariaDB local:

```env
DATABASE_URL="mysql://root:password@localhost:3306/tradeview"
PORT=3000
```

---

## 6.3 Cài dependencies

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

---

## 6.4 Generate Prisma client và migrate database

Trong thư mục `backend`:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Nếu muốn seed dữ liệu mẫu:

```bash
npx prisma db seed
```

---

## 6.5 Chạy backend

Trong thư mục `backend`:

```bash
npm run start:dev
```

Backend mặc định chạy tại:

```text
http://localhost:3000
```

Kiểm tra nhanh:

- `GET /`
- `GET /health`
- `GET /api/dashboard`

---

## 6.6 Chạy frontend

Trong thư mục `frontend`:

```bash
npm run dev
```

Frontend mặc định chạy tại:

```text
http://localhost:5173
```

Có thể đổi port bằng biến môi trường:

```bash
FRONTEND_PORT=4173 npm run dev
```

Trên Windows PowerShell:

```bash
$env:FRONTEND_PORT=4173; npm run dev
```

---

## 7. Build production

## 7.1 Backend
```bash
cd backend
npm run build
```

## 7.2 Frontend
```bash
cd frontend
npm run build
```

Kết quả:
- Backend output trong `backend/dist`
- Frontend output trong `frontend/dist`

## 7.3 Zip file build để deploy

Nếu muốn chỉ cần **giải nén trên server và chạy `pm2 start`**, cần đóng gói một bundle deploy duy nhất bao gồm:

- `frontend/dist`
- `backend/dist`
- `backend/prisma`
- `backend/package.json`
- `backend/package-lock.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `backend/node_modules`
- `frontend/node_modules`
- `ecosystem.config.cjs`

Quy trình đề xuất:

1. Build backend
```bash
cd backend
npm run build
```

2. Build frontend
```bash
cd ../frontend
npm run build
```

3. Cài production dependencies trên **Debian arm64** hoặc trong CI cùng kiến trúc
```bash
cd backend
npm install --omit=dev
npx prisma generate

cd ../frontend
npm install --omit=dev
```

4. Tạo file zip deploy tổng
```bash
Copy-Item "backend/dist" "deploy/backend" -Force
Copy-Item "frontend/dist" "deploy/frontend" -Force
Copy-Item "ecosystem.config.cjs" "deploy" -Force
```

```bash
powershell -Command "Compress-Archive -Path 'deploy' -DestinationPath 'deploy.zip' -Force"
```

5. Copy bundle lên server qua SSH
```bash
scp D:\MyData\Web\TradeView\deploy.zip root@server:/home/data/TaiChinh
```

6. Giải nén trên server
```bash
ssh your-user@your-server "mkdir -p /home/data/TaiChinh/app && unzip -o /home/data/TaiChinh/deploy.zip -d /home/data/TaiChinh"
```

Lưu ý quan trọng:
- Nếu file zip được tạo từ **Windows**, `node_modules` bên trong **không đảm bảo chạy được** trên Debian arm64.
- Muốn đạt đúng mô hình **chỉ giải nén rồi `pm2 start`**, bundle phải được tạo trên **Debian arm64** hoặc CI/container cùng kiến trúc với server.
- Sau khi giải nén, bạn có thể start PM2 trực tiếp bằng file `ecosystem.config.cjs` tại thư mục gốc của bundle.

---

## 8. Kết nối frontend với backend

Hiện frontend đang render dữ liệu mẫu tĩnh trong `frontend/src/App.tsx`.

Bước tiếp theo để dùng dữ liệu thật:

1. Tạo service gọi API:
   - `GET /api/dashboard`
   - `GET /api/assets`
   - `GET /api/transactions`
   - `GET /api/prices/latest`

2. Thay mock data bằng:
   - `fetch`
   - hoặc `axios`

3. Gắn submit form:
   - `POST /api/assets`
   - `POST /api/transactions`
   - `POST /api/prices`

4. Bổ sung:
   - loading state
   - error handling
   - success notification
   - validation form

---

## 9. Deploy Debian arm64

## 9.1 Cài môi trường

Trên Debian arm64:

```bash
sudo apt update
sudo apt install -y git nginx
```

Cài Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Kiểm tra:

```bash
node -v
npm -v
```

---

## 9.2 Clone source

```bash
git clone https://github.com/KhanhNguyenKHTN/TradeView.git
cd TradeView
```

---

## 9.3 Deploy bundle bằng PM2

Mô hình deploy đơn giản nhất:

- build trên máy local
- zip thành **1 file duy nhất**
- copy lên server
- giải nén
- chạy `pm2 start ecosystem.config.cjs`

### Cấu trúc bundle deploy
Bundle chứa:
- `backend/dist`
- `backend/prisma`
- `backend/package.json`
- `backend/package-lock.json`
- `backend/node_modules`
- `frontend/dist`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/node_modules`
- `ecosystem.config.cjs`

### Chuẩn bị trên server
Cài PM2:
```bash
sudo npm install -g pm2
```

Tạo file môi trường backend trên server:
```text
/home/data/TaiChinh/app/backend/.env
```

Ví dụ:
```env
DATABASE_URL="mysql://user:password@host:3306/tradeview"
PORT=3000
NODE_ENV=production
```

Nếu frontend có `.env.production` riêng thì cũng có thể đặt thêm trong:
```text
/home/data/TaiChinh/app/frontend/
```

### Giải nén bundle
```bash
mkdir -p /home/data/TaiChinh/app
unzip -o /home/data/TaiChinh/tradeview-deploy.zip -d /home/data/TaiChinh/app
```

### Tạo file môi trường và migrate database
```bash
cd /home/data/TaiChinh/app/backend
npx prisma generate
npx prisma migrate deploy
```

### Start bằng PM2
```bash
cd /home/data/TaiChinh/app
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### Quản lý app mà không ảnh hưởng service khác
```bash
pm2 logs tradeview-backend
pm2 logs tradeview-frontend

pm2 restart tradeview-backend
pm2 restart tradeview-frontend

pm2 stop tradeview-backend
pm2 stop tradeview-frontend

pm2 delete tradeview-backend
pm2 delete tradeview-frontend
```

Không dùng:
```bash
pm2 restart all
pm2 stop all
pm2 delete all
```

### Port để expose qua Cloudflare Tunnel
- Backend: `127.0.0.1:3000`
- Frontend: `127.0.0.1:4173`

### Lưu ý về path và kiến trúc
File `ecosystem.config.cjs` gộp đang dùng đường dẫn tương đối:
- backend: `./backend`
- frontend: `./frontend`

Vì vậy chỉ cần:
```bash
cd /home/data/TaiChinh/app
pm2 start ecosystem.config.cjs
```

là đủ, không cần sửa path nếu giữ nguyên cấu trúc thư mục sau khi giải nén.

Tuy nhiên:
- nếu muốn bundle chứa sẵn `node_modules` để khỏi chạy `npm install` trên server,
- thì bundle đó phải được build trên **Debian arm64** hoặc môi trường tương thích với server đích.

---

## 10. Trạng thái hiện tại

Đã hoàn thành:
- Scaffold frontend React
- Scaffold backend NestJS
- Prisma schema cho MySQL
- API quản lý tài sản / giao dịch / giá / dashboard
- UI dashboard tài chính
- Build backend thành công
- Build frontend thành công

Chưa hoàn thiện:
- Frontend chưa gọi API thật
- Form frontend chưa submit thật xuống backend
- Chưa bổ sung auth / phân quyền
- Chưa có cron/job lấy giá tự động từ nguồn bên ngoài
- Chưa có Docker / CI/CD

---

## 11. Hướng mở rộng đề xuất

- Kết nối API giá chứng khoán / coin / vàng
- Thêm biểu đồ NAV / PnL theo ngày
- Thêm thống kê dòng tiền
- Export CSV / Excel
- Đăng nhập người dùng
- Multi-user / multi-portfolio
- Docker compose cho MySQL + backend + frontend
- Deploy qua Nginx + PM2 + systemd

---

## 12. Kiểm tra nhanh sau khi setup

### Backend
```bash
cd backend
npm run build
```

### Frontend
```bash
cd frontend
npm run build
```

Cả hai hiện đang build thành công.