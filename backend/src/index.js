// GND OS Backend — Faz 0 iskeleti.
// Şu an sadece: sağlık kontrolü + JWT doğrulamalı "kimim ben" ucu.
// Faz 4'te Campaign Center, queue/worker ve provider'lar buraya eklenecek.

import "dotenv/config";
import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/auth.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "gndos-backend", phase: 0 });
});

// Örnek korumalı uç — frontend'in JWT'yi doğru gönderip göndermediğini
// test etmek için. Faz 4+'ta gerçek iş mantığı bu şekildeki uçlara taşınacak.
app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`gndos-backend listening on :${port}`);
});
