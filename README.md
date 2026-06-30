# Digiflazz Buyer REST API

REST API async untuk Digiflazz Buyer — **100% Vanilla Node.js, zero dependency**.

## Setup

```bash
cp .env.example .env

# Edit .env → isi DF_USERNAME, DF_API_KEY, DF_WEBHOOK_SECRET

node server.js
```
## Endpoints
```
Method	Endpoint	Deskripsi
GET	/health	Health check
GET	/price-list	Semua produk prabayar (cache 10 menit)
GET	/price-list?refresh=true	Force refresh cache
GET	/price-list/search?keyword=XL	Cari produk, sortir termurah
GET	/price-list/:sku	Detail produk by SKU
POST	/transaction	Transaksi + auto retry
POST	/webhook	Endpoint webhook Digiflazz
```
## Contoh Transaksi
```bash
curl -X POST http://localhost:3000/transaction \
  -H "Content-Type: application/json" \
  -d '{"keyword":"XL 10.000","customer_no":"08161234567","max_retry":5}'
```
## Alur Auto Retry
```
findProducts(keyword) → sortir termurah
   → coba produk[0]
     ✅ Sukses   → return 200
     ⏳ Pending  → return 202 (tunggu webhook)
     🚫 No-retry → return 422 (masalah nomor/saldo)
     ❌ Gagal    → coba produk[1] → dst
```
## Log
Semua log tersimpan di _logs/app.log_ dalam format JSON per baris.
## Webhook Setup
```
Di Digiflazz → Atur Koneksi → API → Webhook
URL: https://domain-kamu.com/webhook
Isi DF_WEBHOOK_SECRET di .env sesuai secret yang diset di Digiflazz
```
[https://novellum-filestore-mcp.s3.us-east-2.amazonaws.com/atxp:atxp_acct_78TS9cPSrbIGAzfBZ1OSv/25c99e92-7b96-49cd-9cd5-907e96e97f9e.png]