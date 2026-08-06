# TradeView

Website quản lý tài chính cá nhân cho các nhóm tài sản:

- Vàng
- Tiết kiệm
- Chứng khoán
- Coin

Ứng dụng gồm:

- **Frontend:** React + Vite + TypeScript
- **Backend:** NestJS + TypeScript
- **Database:** MySQL + Prisma ORM
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
- MySQL

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
- MySQL 8+
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

## 9.3 Backend deploy

```bash
cd backend
npm install
npx prisma generate
npm run build
```

Tạo file `.env` production:

```env
DATABASE_URL="mysql://user:password@host:3306/tradeview"
PORT=3000
NODE_ENV=production
```

Chạy migrate:

```bash
npx prisma migrate deploy
```

Start production:

```bash
npm run start:prod
```

Khuyến nghị dùng **PM2**:

```bash
sudo npm install -g pm2
pm2 start dist/main.js --name tradeview-api
pm2 save
pm2 startup
```

---

## 9.4 Frontend deploy

```bash
cd frontend
npm install
npm run build
```

Cấu hình Nginx phục vụ static files từ `frontend/dist`.

Ví dụ:

```nginx
server {
    listen 80;
    server_name your-domain-or-ip;

    root /path/to/TradeView/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Kiểm tra config rồi reload nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

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