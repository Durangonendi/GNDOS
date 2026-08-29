// Vercel serverless function — GND OS Send Queue icin gercek e-posta gonderimi.
// info@gndmachinery.com SMTP hesabini kullanir (daha once GND email
// kampanyasinda da kullanilan ayni kurumsal e-posta kutusu). Kimlik bilgileri
// sadece burada, Vercel Environment Variables'ta - tarayiciya hic inmiyor.

import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    res.status(500).json({ error: "Sunucu yapılandırma hatası (SMTP bilgisi eksik)." });
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(400).json({ error: "Geçersiz istek." });
    return;
  }

  const { to, subject, text } = body || {};
  if (!to || typeof to !== "string" || !text || typeof text !== "string") {
    res.status(400).json({ error: "Alıcı ve mesaj metni gerekli." });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 465,
      secure: true,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"GND İş Makineleri" <${SMTP_USER}>`,
      to,
      subject: subject || "GND İş Makineleri",
      text,
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "E-posta gönderilemedi: " + err.message });
  }
}
