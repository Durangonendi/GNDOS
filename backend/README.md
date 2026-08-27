# GND OS Backend

Faz 0 iskeleti: JWT doğrulama + sağlık kontrolü. Faz 4'te Campaign Center,
queue/worker ve WhatsApp/Email provider'ları buraya eklenecek.

## Yerel çalıştırma

```
cd backend
cp .env.example .env   # gerçek değerleri gir
npm install
npm run dev
```

`http://localhost:8787/health` → `{ ok: true }` dönmeli.

## Railway'e deploy

1. [railway.app](https://railway.app) → New Project → bu GitHub reposunu bağla.
2. Root/Watch path'i `backend` olarak ayarla (monorepo — frontend `src/` ile karışmasın).
3. Settings → Variables kısmına `.env.example`'daki değişkenleri gerçek değerleriyle gir.
4. Deploy sonrası verilen URL'yi not al (örn. `https://gndos-backend.up.railway.app`) —
   frontend ileride bu adrese istek atacak (Faz 4+).

## Neden Railway, neden Vercel değil

Vercel'in sunucusuz fonksiyonları kısa ömürlü çalışır (saniyeler). Queue/worker
sürekli açık kalması gereken bir süreç olduğu için Railway gibi "always-on"
bir servis gerekiyor. Frontend (React) Vercel'de kalmaya devam ediyor,
sadece backend Railway'e taşınıyor.
