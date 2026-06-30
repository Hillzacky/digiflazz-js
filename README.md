# Digiflazz Buyer REST API

REST API async untuk Digiflazz Buyer — **100% Vanilla Node.js, zero dependency**.

## Setup

```bash
cp .env.example .env

# Edit .env → isi DF_USERNAME, DF_API_KEY, DF_WEBHOOK_SECRET

node server.js
```
## Endpoints
### Method	Endpoint	Deskripsi
GET	/health -> Health check
GET	/price-list ->	Semua produk prabayar (cache 10 menit)
GET	/price-list?refresh=true -> 	Force refresh cache
GET	/price-list/search?keyword={provider} ->	Cari produk, sortir termurah
GET	/price-list/:sku	-> Detail produk by SKU
POST	/transaction	-> Transaksi + auto retry
POST	/webhook -> Endpoint webhook Digiflazz