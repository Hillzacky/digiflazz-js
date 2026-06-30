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
![Console View](https://novellum-filestore-mcp.s3.us-east-2.amazonaws.com/atxp:atxp_acct_78TS9cPSrbIGAzfBZ1OSv/25c99e92-7b96-49cd-9cd5-907e96e97f9e.png)
```javascript
const RC = {
  SUCCESS         : '00',
  TIMEOUT         : '01',
  FAILED          : '02',
  PENDING         : '03',
  PENDING_ROUTER  : '99',  // DF Router Issue → treated as pending
  // RC yang boleh di-retry ke alternatif berikutnya
  RETRYABLE: new Set([
    '01', // Timeout
    '02', // Transaksi Gagal
    '53', // Produk Seller Sedang Tidak Tersedia
    '55', // Produk Sedang Gangguan
    '62', // Seller sedang mengalami gangguan
    '66', // Cut Off (Perbaikan Sistem Seller)
    '68', // Stok habis
    '70', // Timeout Dari Biller
    '71', // Produk Sedang Tidak Stabil
  ]),
  // RC yang TIDAK boleh di-retry (masalah di sisi buyer / nomor tujuan)
  NO_RETRY: new Set([
    '40', // Payload Error
    '41', // Signature tidak valid
    '42', // Gagal memproses API Buyer
    '43', // SKU tidak ditemukan/Non-Aktif
    '44', // Saldo tidak cukup
    '45', // IP tidak dikenali
    '49', // Ref ID tidak unik
    '51', // Nomor Tujuan Diblokir
    '52', // Prefix tidak sesuai operator
    '54', // Nomor Tujuan Salah
    '57', // Jumlah Digit Kurang/Lebih
    '80', // Akun diblokir oleh Seller
    '82', // Akun belum terverifikasi
    '84', // Nominal tidak valid
    '85', // Limit transaksi
  ]),
};
```