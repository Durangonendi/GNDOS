// Faz 0 — JWT doğrulama.
// Supabase'in kendi Auth servisine (GoTrue) bearer token'ı sorarak doğrular.
// Kendi imza doğrulaması yazmak yerine bu yöntem seçildi: basit, güvenli,
// ve Supabase tarafında kullanıcı silinir/banlanırsa anında geçersiz olur.

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Yetkilendirme gerekli." });
  }

  try {
    const resp = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resp.ok) {
      return res.status(401).json({ error: "Geçersiz veya süresi dolmuş oturum." });
    }
    const user = await resp.json();
    req.user = { id: user.id, email: user.email };
    req.userToken = token;
    next();
  } catch (e) {
    res.status(502).json({ error: "Kimlik doğrulama servisine ulaşılamadı." });
  }
}
