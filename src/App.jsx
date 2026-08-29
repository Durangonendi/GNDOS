import { useState, useMemo, useEffect, useCallback } from "react";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// ─── AUTH (Supabase Auth — paylaşılan şifrenin yerini alıyor) ─────────────────
const SESSION_KEY = "gndos_session";

function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
  catch(e) { return null; }
}
function setSession(s) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch(e) {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
}

async function authLogin(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.msg || "Giriş başarısız");
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user: { id: data.user?.id, email: data.user?.email }
  };
  setSession(session);
  return session;
}

async function authRefresh(refresh_token) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token })
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Oturum yenilenemedi");
  const session = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user: { id: data.user?.id, email: data.user?.email }
  };
  setSession(session);
  return session;
}

// Her istekten önce çağrılır: token süresi dolmuşsa sessizce yeniler.
async function authToken() {
  let s = getSession();
  if (!s) return null;
  if (Date.now() > s.expires_at - 30000) {
    try { s = await authRefresh(s.refresh_token); }
    catch(e) { clearSession(); return null; }
  }
  return s.access_token;
}

function authHeaders(token) {
  return { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` };
}

// ─── NORMALİZASYON (Faz 2 — Import Center'da kullanılıyor) ────────────────────
const TR_MAP = { ç:"c",ğ:"g",ı:"i",ö:"o",ş:"s",ü:"u",Ç:"c",Ğ:"g",İ:"i",Ö:"o",Ş:"s",Ü:"u" };
function nameSearchable(s) {
  if (!s) return "";
  return s.toString().split("").map(ch => TR_MAP[ch] || ch).join("")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function normalizePhone(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d+]/g, "");
  if (!digits) return null;
  if (!digits.startsWith("+")) {
    digits = digits.startsWith("0") ? "+90" + digits.slice(1) : "+" + digits;
  }
  return digits;
}
function normalizeEmail(raw) {
  if (!raw) return null;
  const e = String(raw).trim().toLowerCase();
  return e.includes("@") ? e : null;
}
// Esnek sütun eşleştirme: farklı Excel şablonlarında başlıklar değişebilir.
const COLUMN_ALIASES = {
  company: ["firma", "company", "şirket", "sirket", "firma adı", "firma/saha", "company name"],
  country: ["ülke", "ulke", "country"],
  region: ["bölge", "bolge", "region", "il", "il/ilçe", "şehir", "sehir"],
  sector: ["sektör", "sektor", "sector"],
  contact: ["kişi", "kisi", "contact", "yetkili", "yetkili kişi"],
  phone: ["telefon", "phone", "tel"],
  whatsapp: ["whatsapp"],
  email: ["email", "e-posta", "eposta"],
  notes: ["not", "notlar", "notes", "açıklama", "aciklama"],
};
function findColumn(headerRow, aliases) {
  const idx = headerRow.findIndex(h => aliases.includes(String(h || "").trim().toLowerCase()));
  return idx;
}

// ─── AI (Faz 7 — backend /api/ai üzerinden, anahtar tarayıcıya hiç inmiyor) ───
async function callAI(system, userMessage) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, messages: [{ role: "user", content: userMessage }] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "AI hatası");
  return data.reply || "";
}

// ─── AUDIT LOG (Faz 0 — kim ne zaman ne değiştirdi) ───────────────────────────
async function writeAudit(token, user, action, tableName, recordId, before, after) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/audit_log`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({
        actor_user_id: user?.id || null, actor_email: user?.email || null,
        action, table_name: tableName, record_id: String(recordId ?? ""),
        before: before ?? null, after: after ?? null
      })
    });
  } catch(e) { /* audit hatası ana işlemi engellemez */ }
}

async function dbGetLeads() {
  const token = await authToken();
  if (!token) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=*&order=id.desc`, {
      headers: authHeaders(token)
    });
    const data = await res.json();
    return Array.isArray(data) ? data.map(l => ({
      ...l, value: Number(l.value) || 0,
      productType: l.product_type || ""
    })) : [];
  } catch(e) { return []; }
}

async function dbInsertLead(lead, user) {
  const token = await authToken();
  if (!token) return;
  const body = { company: lead.company, contact: lead.contact, country: lead.country, region: lead.region, sector: lead.sector, product_type: lead.productType, product: lead.product, value: lead.value || 0, stage: lead.stage || "Lead", whatsapp: lead.whatsapp, email: lead.email, phone: lead.phone, notes: lead.notes };
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify(body)
    });
    writeAudit(token, user, "insert", "leads", null, null, body);
  } catch(e) {}
}

async function dbUpdateLead(id, lead, user) {
  const token = await authToken();
  if (!token) return;
  const body = { company: lead.company, contact: lead.contact, country: lead.country, region: lead.region, sector: lead.sector, product_type: lead.productType, product: lead.product, value: lead.value || 0, stage: lead.stage, whatsapp: lead.whatsapp, email: lead.email, phone: lead.phone, notes: lead.notes };
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    writeAudit(token, user, "update", "leads", id, null, body);
  } catch(e) {}
}

async function dbUpdateStage(id, stage, user) {
  const token = await authToken();
  if (!token) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ stage })
    });
    writeAudit(token, user, "update_stage", "leads", id, null, { stage });
  } catch(e) {}
}

async function dbDeleteLead(id, user) {
  const token = await authToken();
  if (!token) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "DELETE",
      headers: authHeaders(token)
    });
    writeAudit(token, user, "delete", "leads", id, null, null);
  } catch(e) {}
}

const C = {
  bg:"#F4F6F8", navy:"#EDF1F4", iron:"#E4E9ED", panel:"#EBEFF2",
  card:"#FFFFFF", amber:"#F0A500", amberDim:"#F0A50015",
  green:"#1DB954", greenDim:"#1DB95415",
  rust:"#E63946", rustDim:"#E6394615",
  blue:"#2196F3", blueDim:"#2196F315",
  orange:"#FF6B35",
  ghost:"#16222E", smoke:"#5B6B7A", muted:"#8996A2",
  border:"#DCE2E7",
  onAccent:"#12202E",
};

const SC = {
  "Lead":"#6B8299","İletişime Geçildi":"#2196F3",
  "Teklif Verildi":"#F0A500","Müzakere":"#FF6B35",
  "Kazanıldı":"#1DB954","Kaybedildi":"#E63946",
};

const STAGES = ["Lead","İletişime Geçildi","Teklif Verildi","Müzakere","Kazanıldı","Kaybedildi"];
const SECTORS = ["Hafriyat","Madencilik","İnşaat","Yol Yapım","Liman & Lojistik","Petrol & Gaz","Tarım","Diğer"];
const PRODUCT_TYPES = ["Yeni Makine","İkinci El Makine","Yedek Parça","Servis & Bakım","Kiralık Ekipman"];
const REGIONS = ["Türkiye","Orta Doğu","Kuzey Afrika","Sahra Altı Afrika","Avrupa","Orta Asya","Güney Asya","Diğer"];
const TR_ILLER = ["Adana","Ankara","Antalya","Bursa","Diyarbakır","Erzurum","Eskişehir","Gaziantep","İstanbul","İzmir","Kahramanmaraş","Kayseri","Kocaeli","Konya","Malatya","Mersin","Samsun","Şanlıurfa","Trabzon","Van","Zonguldak"];
const ULKELER = {
  "Orta Doğu":["Suudi Arabistan","BAE","Katar","Kuveyt","Irak","Umman"],
  "Kuzey Afrika":["Mısır","Libya","Fas","Cezayir","Tunus"],
  "Sahra Altı Afrika":["Gana","Nijerya","Kenya","Güney Afrika","Zambia"],
  "Avrupa":["Almanya","Polonya","Romanya","Sırbistan","Ukrayna"],
  "Orta Asya":["Kazakistan","Özbekistan","Türkmenistan","Azerbaycan"],
  "Güney Asya":["Pakistan","Hindistan","Bangladeş"],
};

const MODULES = [
  {key:"crm",icon:"🌍",label:"Global CRM"},
  {key:"companies",icon:"🏢",label:"Companies"},
  {key:"campaigns",icon:"📣",label:"Campaigns"},
  {key:"queue",icon:"📤",label:"Send Queue"},
  {key:"import",icon:"📥",label:"Import Center"},
  {key:"marketplace",icon:"🏪",label:"Marketplace/Admin"},
  {key:"makine",icon:"🏗️",label:"Equipment Center"},
  {key:"stok",icon:"📦",label:"Inventory"},
  {key:"finans",icon:"💰",label:"Finance"},
  {key:"analiz",icon:"📊",label:"Intelligence"},
  {key:"ai",icon:"🤖",label:"AI Copilot"},
  {key:"teklif",icon:"📄",label:"Proposal Center"},
  {key:"dokuman",icon:"📁",label:"Knowledge Base"},
];

const fmt = n => n>=1000000?`$${(n/1e6).toFixed(2)}M`:n>=1000?`$${(n/1000).toFixed(0)}K`:`$${n}`;
const today = () => new Date().toISOString().split("T")[0];

const bs = (bg,color,ex={}) => ({background:bg,color,border:"none",borderRadius:6,padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:700,...ex});
const ob = (color) => ({background:"transparent",color,border:`1px solid ${color}33`,borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:600});
const cardSt = (ex={}) => ({background:C.card,border:`1px solid ${C.border}`,borderRadius:10,...ex});
const pill = (color) => ({background:color+"20",color,border:`1px solid ${color}40`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap",display:"inline-block"});

const inpStyle = {background:C.navy,color:C.ghost,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",fontSize:14,width:"100%",boxSizing:"border-box",outline:"none"};

// ─── LOGIN (Supabase Auth — Faz 0) ─────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function tryLogin() {
    if (!email || !pass) return;
    setLoading(true); setError("");
    try {
      const session = await authLogin(email, pass);
      onLogin(session);
    } catch(e) {
      setError(e.message || "Giriş başarısız");
    }
    setLoading(false);
  }

  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:40,width:340,textAlign:"center"}}>
        <img src="/logo.png" alt="GND" style={{height:56,marginBottom:8}}/>
        <div style={{fontSize:11,color:C.smoke,letterSpacing:2,marginBottom:32}}>GLOBAL OPS PLATFORM</div>
        <input type="email" placeholder="E-posta" value={email} autoComplete="username"
          onChange={e=>setEmail(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&tryLogin()}
          style={{...inpStyle,marginBottom:10,border:`1px solid ${error?C.rust:C.border}`}}
        />
        <input type="password" placeholder="Şifre" value={pass} autoComplete="current-password"
          onChange={e=>setPass(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&tryLogin()}
          style={{...inpStyle,marginBottom:12,border:`1px solid ${error?C.rust:C.border}`}}
        />
        {error && <div style={{color:C.rust,fontSize:12,marginBottom:8}}>{error}</div>}
        <button onClick={tryLogin} disabled={loading} style={{...bs(C.amber,C.onAccent),width:"100%",padding:11,fontSize:14,opacity:loading?0.7:1}}>{loading?"Giriş yapılıyor...":"Giriş Yap"}</button>
        <div style={{fontSize:11,color:C.muted,marginTop:16}}>Sadece yetkili erişim</div>
      </div>
    </div>
  );
}

// ─── LEAD FORM MODAL ─────────────────────────────────────────────────────────
function LeadFormModal({ editLead, onClose, onSave }) {
  const [company, setCompany] = useState(editLead?.company || "");
  const [contact, setContact] = useState(editLead?.contact || "");
  const [country, setCountry] = useState(editLead?.country || "");
  const [region, setRegion] = useState(editLead?.region || "Türkiye");
  const [sector, setSector] = useState(editLead?.sector || "Hafriyat");
  const [productType, setProductType] = useState(editLead?.productType || "Yeni Makine");
  const [product, setProduct] = useState(editLead?.product || "");
  const [value, setValue] = useState(editLead?.value || "");
  const [stage, setStage] = useState(editLead?.stage || "Lead");
  const [whatsapp, setWhatsapp] = useState(editLead?.whatsapp || "");
  const [email, setEmail] = useState(editLead?.email || "");
  const [phone, setPhone] = useState(editLead?.phone || "");
  const [notes, setNotes] = useState(editLead?.notes || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!company) return;
    setSaving(true);
    await onSave({ company, contact, country, region, sector, productType, product, value: Number(value) || 0, stage, whatsapp, email, phone, notes });
    setSaving(false);
  }

  const row = {display:"flex",flexDirection:"column",gap:5};
  const lbl = {fontSize:11,color:C.smoke,fontWeight:600,letterSpacing:0.5};
  const sel = {...inpStyle,cursor:"pointer"};

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{...cardSt({padding:28}),width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <div style={{fontSize:17,fontWeight:800,color:C.amber}}>{editLead?"Lead Düzenle":"Yeni Lead Ekle"}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.smoke,cursor:"pointer",fontSize:22}}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
          <div style={{...row,gridColumn:"1/-1"}}><label style={lbl}>FİRMA ADI *</label><input style={inpStyle} value={company} onChange={e=>setCompany(e.target.value)} placeholder="Firma adı"/></div>
          <div style={row}><label style={lbl}>İLETİŞİM KİŞİSİ</label><input style={inpStyle} value={contact} onChange={e=>setContact(e.target.value)}/></div>
          <div style={row}><label style={lbl}>ÜLKE</label><input style={inpStyle} value={country} onChange={e=>setCountry(e.target.value)}/></div>
          <div style={row}><label style={lbl}>BÖLGE</label><select style={sel} value={region} onChange={e=>setRegion(e.target.value)}>{REGIONS.map(r=><option key={r}>{r}</option>)}</select></div>
          <div style={row}><label style={lbl}>SEKTÖR</label><select style={sel} value={sector} onChange={e=>setSector(e.target.value)}>{SECTORS.map(s=><option key={s}>{s}</option>)}</select></div>
          <div style={{...row,gridColumn:"1/-1"}}><label style={lbl}>ÜRÜN / TALEP</label><input style={inpStyle} value={product} onChange={e=>setProduct(e.target.value)}/></div>
          <div style={row}><label style={lbl}>ÜRÜN TİPİ</label><select style={sel} value={productType} onChange={e=>setProductType(e.target.value)}>{PRODUCT_TYPES.map(p=><option key={p}>{p}</option>)}</select></div>
          <div style={row}><label style={lbl}>DEĞER ($)</label><input style={inpStyle} type="number" value={value} onChange={e=>setValue(e.target.value)}/></div>
          <div style={row}><label style={lbl}>AŞAMA</label><select style={sel} value={stage} onChange={e=>setStage(e.target.value)}>{STAGES.map(s=><option key={s}>{s}</option>)}</select></div>
          <div style={{...row,gridColumn:"1/-1"}}><label style={lbl}>WHATSAPP</label><input style={inpStyle} value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="+90..."/></div>
          <div style={row}><label style={lbl}>E-POSTA</label><input style={inpStyle} value={email} onChange={e=>setEmail(e.target.value)}/></div>
          <div style={row}><label style={lbl}>TELEFON</label><input style={inpStyle} value={phone} onChange={e=>setPhone(e.target.value)}/></div>
          <div style={{...row,gridColumn:"1/-1"}}><label style={lbl}>NOTLAR</label><textarea style={{...inpStyle,minHeight:70,resize:"vertical"}} value={notes} onChange={e=>setNotes(e.target.value)}/></div>
        </div>
        <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:20}}>
          <button onClick={onClose} style={ob(C.smoke)}>İptal</button>
          <button onClick={handleSave} disabled={saving} style={bs(C.amber,C.onAccent,{opacity:saving?0.7:1})}>{saving?"⏳ Kaydediliyor...":"💾 Kaydet"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── WORLD MAP ────────────────────────────────────────────────────────────────
function WorldMap({ leads }) {
  const toX = lng => ((lng+180)/360)*860;
  const toY = lat => ((90-lat)/180)*400;
  const stageColor = {"Lead":C.smoke,"İletişime Geçildi":C.blue,"Teklif Verildi":C.amber,"Müzakere":C.orange,"Kazanıldı":C.green,"Kaybedildi":C.rust};
  return (
    <div style={{...cardSt({padding:20,marginBottom:20})}}>
      <div style={{fontSize:12,fontWeight:700,color:C.amber,letterSpacing:1,marginBottom:12}}>🗺️ GLOBAL OPERASYON HARİTASI</div>
      <div style={{background:"#060E18",borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
        <svg viewBox="0 0 860 400" style={{width:"100%",display:"block"}}>
          <rect width="860" height="400" fill="#060E18"/>
          <path d="M90,65 L175,60 L190,85 L205,125 L190,165 L170,195 L150,210 L135,230 L115,225 L95,200 L80,170 L75,130 L80,95 Z" fill="#0F2035" stroke="#162030" strokeWidth="0.5"/>
          <path d="M170,245 L205,235 L220,265 L225,305 L215,355 L195,385 L175,390 L155,370 L145,330 L145,290 L155,258 Z" fill="#0F2035" stroke="#162030" strokeWidth="0.5"/>
          <path d="M390,55 L450,50 L465,70 L455,95 L440,105 L420,110 L405,100 L390,85 Z" fill="#0F2035" stroke="#162030" strokeWidth="0.5"/>
          <path d="M405,115 L460,110 L480,135 L490,185 L485,245 L470,305 L445,330 L420,330 L400,305 L390,255 L385,195 L390,150 Z" fill="#0F2035" stroke="#162030" strokeWidth="0.5"/>
          <path d="M460,50 L640,45 L690,65 L710,95 L700,135 L670,155 L630,160 L590,150 L550,140 L510,130 L480,110 L465,85 Z" fill="#0F2035" stroke="#162030" strokeWidth="0.5"/>
          <path d="M480,125 L530,120 L545,140 L540,170 L515,180 L490,170 L478,150 Z" fill="#0F2035" stroke="#162030" strokeWidth="0.5"/>
          <path d="M640,220 L710,215 L735,240 L740,280 L720,305 L680,310 L650,290 L630,260 L630,235 Z" fill="#0F2035" stroke="#162030" strokeWidth="0.5"/>
          {leads.filter(l=>l.lat&&l.lng).map(l => {
            const x=toX(l.lng), y=toY(l.lat), color=stageColor[l.stage]||C.smoke;
            return (<g key={l.id}><circle cx={x} cy={y} r="10" fill={color} opacity="0.15"/><circle cx={x} cy={y} r="5" fill={color} opacity="0.6"/><circle cx={x} cy={y} r="3" fill={color}/></g>);
          })}
        </svg>
      </div>
    </div>
  );
}

// ─── COMMAND CENTER ───────────────────────────────────────────────────────────
function CommandCenter({ leads, setActive, loadLeads }) {
  const [briefing, setBriefing] = useState("");
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [priorities, setPriorities] = useState("");
  const [prioLoading, setPrioLoading] = useState(false);
  const [prioOpen, setPrioOpen] = useState(false);
  const [funnel, setFunnel] = useState(null);

  useEffect(() => {
    (async () => {
      const token = await authToken();
      if (!token) return;
      const h = { ...authHeaders(token), Prefer: "count=exact", Range: "0-0" };
      const count = async (path) => {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: h });
        const cr = r.headers.get("Content-Range");
        return cr ? Number(cr.split("/")[1]) : 0;
      };
      const [totalCompanies, withPhone, withWhatsapp, withEmail, sentToday, activeCampaigns, leadsCount] = await Promise.all([
        count("companies?select=id"),
        count("contact_methods?select=id&type=eq.phone"),
        count("contact_methods?select=id&type=eq.whatsapp"),
        count("contact_methods?select=id&type=eq.email"),
        count(`outbound_messages?select=id&status=eq.sent&sent_at=gte.${new Date().toISOString().slice(0,10)}`),
        count("campaigns?select=id&status=eq.active"),
        count("leads?select=id"),
      ]);
      setFunnel({ totalCompanies, withPhone, withWhatsapp, withEmail, sentToday, activeCampaigns, leadsCount });
    })();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour<12?"Günaydın":hour<18?"İyi öğleden sonralar":"İyi akşamlar";
  const totalVal = leads.reduce((a,l)=>a+l.value,0);
  const hotLeads = leads.filter(l=>["Teklif Verildi","Müzakere"].includes(l.stage));

  async function getAIBriefing() {
    setBriefingLoading(true);
    const prompt = `Günaydın Duran. ile başla. Global iş makinesi satışı için kısa sabah brifing yaz (Türkçe, 5-6 madde, emoji kullan). Leadler: ${leads.map(l=>`${l.company}(${l.country},${l.stage},$${l.value})`).join(", ")}`;
    try {
      setBriefing(await callAI(null, prompt));
    } catch(e){setBriefing("Bağlantı hatası: " + e.message);}
    setBriefingLoading(false);
  }

  async function getPriorities() {
    setPrioLoading(true); setPrioOpen(true);
    const prompt = `İş makinesi satış uzmanısın. Bu leadleri öncelik sırasına koy: ${leads.map(l=>`${l.company}(${l.country},${l.stage},$${l.value})`).join(", ")}. Türkçe, kısa.`;
    try {
      setPriorities(await callAI(null, prompt));
    } catch(e){setPriorities("Bağlantı hatası: " + e.message);}
    setPrioLoading(false);
  }

  return (
    <div>
      <div style={{marginBottom:28,display:"flex",justifyContent:"space-between",alignItems:"flex-end",flexWrap:"wrap",gap:16}}>
        <div>
          <div style={{fontSize:11,color:C.smoke,letterSpacing:2,marginBottom:6}}>GNDOS COMMAND CENTER</div>
          <div style={{fontSize:28,fontWeight:900,lineHeight:1.1}}>{greeting}, <span style={{color:C.amber}}>Duran</span></div>
          <div style={{fontSize:13,color:C.smoke,marginTop:4}}>{new Date().toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</div>
        </div>
        <button onClick={getPriorities} style={{background:`linear-gradient(135deg,${C.amber},#E08C00)`,color:C.onAccent,border:"none",borderRadius:10,padding:"14px 28px",cursor:"pointer",fontSize:15,fontWeight:900,boxShadow:`0 4px 24px ${C.amber}40`}}>
          🎯 Bugün Ne Yapmalıyım?
        </button>
      </div>

      {prioOpen && (
        <div style={{...cardSt({padding:20,marginBottom:20,border:`1px solid ${C.amber}44`,background:C.amberDim})}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.amber}}>🎯 AI ÖNCELİK ANALİZİ</div>
            <button onClick={()=>setPrioOpen(false)} style={{background:"none",border:"none",color:C.smoke,cursor:"pointer",fontSize:18}}>✕</button>
          </div>
          {prioLoading?<div style={{color:C.smoke}}>⏳ Analiz yapılıyor...</div>:<div style={{fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{priorities}</div>}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
        {[
          {l:"AKTİF LEAD",v:leads.filter(l=>!["Kazanıldı","Kaybedildi"].includes(l.stage)).length,c:C.blue,icon:"🎯"},
          {l:"SICAK FIRSAT",v:hotLeads.length,c:C.orange,icon:"🔥"},
          {l:"PIPELINE",v:fmt(totalVal),c:C.amber,icon:"💰"},
          {l:"KAZANILAN",v:fmt(leads.filter(l=>l.stage==="Kazanıldı").reduce((a,l)=>a+l.value,0)),c:C.green,icon:"✅"},
        ].map(k=>(
          <div key={k.l} style={cardSt({padding:16})}>
            <div style={{fontSize:20,marginBottom:6}}>{k.icon}</div>
            <div style={{fontSize:22,fontWeight:900,color:k.c}}>{k.v}</div>
            <div style={{fontSize:10,color:C.smoke,marginTop:4,letterSpacing:0.8}}>{k.l}</div>
          </div>
        ))}
      </div>

      {funnel && (
        <div style={cardSt({padding:20,marginBottom:20})}>
          <div style={{fontSize:12,fontWeight:700,color:C.amber,letterSpacing:1,marginBottom:14}}>📊 VERİTABANI DURUMU &amp; FUNNEL</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:10}}>
            {[
              {l:"FİRMA",v:funnel.totalCompanies},
              {l:"TELEFONLU",v:funnel.withPhone},
              {l:"WHATSAPP'LI",v:funnel.withWhatsapp},
              {l:"E-POSTALI",v:funnel.withEmail},
              {l:"BUGÜN GÖNDERİLEN",v:funnel.sentToday},
              {l:"AKTİF KAMPANYA",v:funnel.activeCampaigns},
              {l:"LEAD",v:funnel.leadsCount},
            ].map(k=>(
              <div key={k.l} style={{background:C.panel,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 8px",textAlign:"center"}}>
                <div style={{fontSize:17,fontWeight:800,color:C.ghost}}>{k.v}</div>
                <div style={{fontSize:9,color:C.smoke,marginTop:3}}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <div style={cardSt({padding:20})}>
          <div style={{fontSize:12,fontWeight:700,color:C.amber,letterSpacing:1,marginBottom:14}}>🟢 BUGÜNKÜ GÖREVLER</div>
          {[
            {text:`${leads.filter(l=>l.stage==="Lead").length} yeni lead aranacak`,icon:"📞",c:C.blue},
            {text:`${hotLeads.length} sıcak fırsat takip edilecek`,icon:"🔥",c:C.orange},
            {text:`0 teklif hazırlanacak`,icon:"📄",c:C.amber},
            {text:`Stok kontrol edilecek`,icon:"⚠️",c:C.rust},
          ].map((t,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:C.panel,borderRadius:8,border:`1px solid ${C.border}`,marginBottom:8}}>
              <span>{t.icon}</span><span style={{fontSize:13,flex:1}}>{t.text}</span>
              <span style={{width:7,height:7,borderRadius:"50%",background:t.c}}/>
            </div>
          ))}
        </div>
        <div style={cardSt({padding:20})}>
          <div style={{fontSize:12,fontWeight:700,color:C.amber,letterSpacing:1,marginBottom:14}}>🤖 AI MARKET ALERTS</div>
          {[
            {text:"Suudi Arabistan'da yeni maden ihalesi açıldı",flag:"🇸🇦"},
            {text:"Kazakistan'dan 30 gündür cevap yok",flag:"🇰🇿"},
            {text:"Gana'daki Tarkwa Gold — büyük proje",flag:"🇬🇭"},
            {text:"Irak'ta hafriyat büyüme trendi devam ediyor",flag:"🇮🇶"},
          ].map((a,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:C.panel,borderRadius:8,border:`1px solid ${C.border}`,marginBottom:8}}>
              <span style={{fontSize:18}}>{a.flag}</span><span style={{fontSize:12,flex:1,lineHeight:1.4}}>{a.text}</span>
            </div>
          ))}
          <button onClick={getAIBriefing} disabled={briefingLoading} style={{...bs(C.blueDim,C.blue,{border:`1px solid ${C.blue}33`,width:"100%",marginTop:4,fontSize:12})}}>
            {briefingLoading?"⏳ Hazırlanıyor...":"📋 AI Sabah Brifing'i Al"}
          </button>
        </div>
      </div>

      {briefing && (
        <div style={{...cardSt({padding:20,marginBottom:20,border:`1px solid ${C.blue}33`,background:C.blueDim})}}>
          <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:12}}>🤖 AI SABAH BRİFİNG</div>
          <div style={{fontSize:14,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{briefing}</div>
        </div>
      )}

      <WorldMap leads={leads}/>

      {hotLeads.length > 0 && (
        <div style={cardSt({padding:20,marginBottom:20})}>
          <div style={{fontSize:12,fontWeight:700,color:C.amber,letterSpacing:1,marginBottom:14}}>🔥 SICAK FIRSATLAR</div>
          {hotLeads.map(l=>(
            <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:C.panel,borderRadius:8,border:`1px solid ${SC[l.stage]}33`,marginBottom:8}}>
              <div>
                <div style={{fontWeight:700,fontSize:14}}>{l.company}</div>
                <div style={{fontSize:12,color:C.smoke}}>🌍 {l.country} · {l.sector}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:16,fontWeight:800,color:C.amber}}>{fmt(l.value)}</div>
                <span style={pill(SC[l.stage])}>{l.stage}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {MODULES.map(m=>(
          <button key={m.key} onClick={()=>setActive(m.key)} style={{...cardSt({padding:"16px 12px",cursor:"pointer",textAlign:"center",display:"block",width:"100%",border:`1px solid ${C.border}`})}} >
            <div style={{fontSize:28,marginBottom:6}}>{m.icon}</div>
            <div style={{fontSize:11,fontWeight:700,color:C.ghost}}>{m.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── FIRMA BUL ────────────────────────────────────────────────────────────────
function FirmaBul({ onAdd }) {
  const [mode,setMode]=useState("TR");
  const [il,setIl]=useState("İstanbul");
  const [sektor,setSektor]=useState("Hafriyat");
  const [region,setRegion]=useState("Orta Doğu");
  const [ulke,setUlke]=useState("Suudi Arabistan");
  const [loading,setLoading]=useState(false);
  const [firmalar,setFirmalar]=useState([]);
  const [added,setAdded]=useState({});
  const [error,setError]=useState("");

  async function ara() {
    // Faz 7 notu: bu özellik daha önce AI'ye GERÇEK olmayan, uydurma firma
    // isimleri ürettiriyordu ("gerçekçi isimler" — hayali veri). Bu, GNDOS'ta
    // baştan beri uygulanan "asla uydurma veri ekleme, bulunamayan alanı boş
    // bırak" kuralına aykırı olduğu için kapatıldı. Gerçek firma verisi için
    // Import Center (Excel/CSV içe aktarma) kullanılmalı.
    setError("Bu özellik veri kalitesi nedeniyle kapatıldı — AI'ye gerçek olmayan firma bilgisi ürettiriyordu. Gerçek firmalar için Import Center'ı kullan.");
  }

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        {[["TR","🇹🇷 Türkiye"],["GLOBAL","🌍 Global"]].map(([k,v])=>(
          <button key={k} onClick={()=>setMode(k)} style={bs(mode===k?C.amber:C.card,mode===k?C.onAccent:C.smoke,{border:`1px solid ${mode===k?C.amber:C.border}`})}>{v}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap",alignItems:"flex-end"}}>
        {mode==="TR"?(
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <label style={{fontSize:11,color:C.smoke}}>İL</label>
            <select value={il} onChange={e=>setIl(e.target.value)} style={{...inpStyle,width:150,cursor:"pointer"}}>{TR_ILLER.map(i=><option key={i}>{i}</option>)}</select>
          </div>
        ):(
          <>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label style={{fontSize:11,color:C.smoke}}>BÖLGE</label>
              <select value={region} onChange={e=>{setRegion(e.target.value);setUlke(ULKELER[e.target.value]?.[0]||"");}} style={{...inpStyle,cursor:"pointer"}}>{Object.keys(ULKELER).map(r=><option key={r}>{r}</option>)}</select>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label style={{fontSize:11,color:C.smoke}}>ÜLKE</label>
              <select value={ulke} onChange={e=>setUlke(e.target.value)} style={{...inpStyle,cursor:"pointer"}}>{(ULKELER[region]||[]).map(u=><option key={u}>{u}</option>)}</select>
            </div>
          </>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          <label style={{fontSize:11,color:C.smoke}}>SEKTÖR</label>
          <select value={sektor} onChange={e=>setSektor(e.target.value)} style={{...inpStyle,cursor:"pointer"}}>{SECTORS.map(s=><option key={s}>{s}</option>)}</select>
        </div>
        <button onClick={ara} disabled={loading} style={bs(C.amber,C.onAccent,{padding:"10px 24px",alignSelf:"flex-end",opacity:loading?0.7:1})}>{loading?"⏳ Aranıyor...":"🔍 Firma Ara"}</button>
      </div>
      {error&&<div style={{color:C.rust,padding:12,background:C.rustDim,borderRadius:6,marginBottom:12}}>{error}</div>}
      {loading&&<div style={{textAlign:"center",padding:48,color:C.smoke}}><div style={{fontSize:36,marginBottom:8}}>⚙️</div><div>{mode==="TR"?il:ulke} · {sektor} aranıyor...</div></div>}
      {firmalar.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {firmalar.map((f,i)=>(
            <div key={i} style={{...cardSt({padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,border:`1px solid ${added[i]?C.green:C.border}`})}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{f.company}</div>
                {f.address&&<div style={{fontSize:12,color:C.smoke,marginBottom:4}}>📍 {f.address}</div>}
                <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                  {f.phone&&<span style={{fontSize:12,color:C.smoke}}>📞 {f.phone}</span>}
                  {f.email&&<span style={{fontSize:12,color:C.smoke}}>✉ {f.email}</span>}
                </div>
                {f.notes&&<div style={{fontSize:12,color:C.smoke,marginTop:4,fontStyle:"italic"}}>{f.notes}</div>}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {f.whatsapp&&<a href={`https://wa.me/${(f.whatsapp||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{...ob("#25D366"),textDecoration:"none",textAlign:"center"}}>WA</a>}
                <button onClick={()=>{onAdd({company:f.company,contact:f.contact||"",country:mode==="TR"?"Türkiye":ulke,region:mode==="TR"?"Türkiye":region,sector:sektor,productType:"Yeni Makine",product:"",value:0,stage:"Lead",whatsapp:f.whatsapp||f.phone||"",email:f.email||"",phone:f.phone||"",notes:f.notes||""});setAdded(a=>({...a,[i]:true}));}} disabled={added[i]} style={bs(added[i]?C.green+"33":C.amber,added[i]?C.green:C.onAccent,{border:added[i]?`1px solid ${C.green}`:"none"})}>{added[i]?"✓ Eklendi":"+ Ekle"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading&&firmalar.length===0&&<div style={{textAlign:"center",padding:60,color:C.smoke}}><div style={{fontSize:48,marginBottom:12}}>🔍</div><div>Bölge + sektör seç, Firma Ara'ya bas</div></div>}
    </div>
  );
}

// ─── MARKETPLACE / İLAN ONAY MERKEZİ ──────────────────────────────────────────
// gndmachinery.com'daki market_requests tablosu üzerinde çalışır (ayrı bir
// tüketici pazar yeri — GND OS'un B2B firma/lead sisteminden bağımsız).
// Not: bu tabloya erişim, Supabase'de sadece belirli bir email'e (site admini)
// tanımlı RLS policy ile kısıtlı — GNDOS'a o email ile giriş yapılmış olmalı.
const MR_KATEGORI_LABEL = { makine: "Makine", atasman: "Ataşman", parca: "Yedek Parça" };

async function marketRequestToLead(row, user, token, setNote) {
  const phoneNorm = normalizePhone(row.telefon);
  let companyId = null, contactId = null;

  if (phoneNorm) {
    const mRes = await fetch(`${SUPABASE_URL}/rest/v1/contact_methods?value_normalized=eq.${encodeURIComponent(phoneNorm)}&select=company_id,contact_id&limit=1`, { headers: authHeaders(token) });
    const mData = await mRes.json();
    if (Array.isArray(mData) && mData.length) { companyId = mData[0].company_id; contactId = mData[0].contact_id; }
  }

  if (!companyId) {
    const name = row.ad_soyad || row.baslik || "Pazar Yeri İlanı";
    const cRes = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify({ name_original: name, name_searchable: nameSearchable(name), data_source: "marketplace_listing", verification_status: "unverified", owner_user_id: user?.id || null, notes: `Pazar yeri ilanından otomatik oluşturuldu (ilan: ${row.baslik || row.id})` }),
    });
    const cData = await cRes.json();
    if (!cRes.ok) throw new Error(JSON.stringify(cData));
    companyId = cData[0].id;

    const conRes = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify({ company_id: companyId, person_name: row.ad_soyad || null, status: "Gönderilmedi" }),
    });
    const conData = await conRes.json();
    if (conRes.ok) contactId = conData[0].id;

    if (phoneNorm) {
      await fetch(`${SUPABASE_URL}/rest/v1/contact_methods`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=minimal" },
        body: JSON.stringify({ company_id: companyId, contact_id: contactId, type: "phone", value_original: row.telefon, value_normalized: phoneNorm, is_primary: true }),
      });
    }
  }

  const value = Number(String(row.fiyat || "").replace(/[^\d.]/g, "")) || 0;
  const leadBody = {
    company: row.ad_soyad || row.baslik, contact: row.ad_soyad || "", country: "Türkiye", region: "Türkiye",
    sector: MR_KATEGORI_LABEL[row.kategori] || "Diğer", product_type: row.islem_turu === "satis" ? "İkinci El Makine" : "Yeni Makine",
    product: row.baslik || "", value, stage: "Lead", phone: row.telefon || "", whatsapp: row.telefon || "", email: "",
    notes: `Pazar yeri ilanı #${row.id} üzerinden oluşturuldu.${row.aciklama ? " Açıklama: " + row.aciklama : ""}`,
    company_id: companyId, contact_id: contactId,
  };
  const lRes = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=representation" },
    body: JSON.stringify(leadBody),
  });
  const lData = await lRes.json();
  if (!lRes.ok) throw new Error(JSON.stringify(lData));

  await writeAudit(token, user, "lead_created", "leads", lData[0]?.id, null, { source: "marketplace_listing", market_request_id: row.id });
  await fetch(`${SUPABASE_URL}/rest/v1/activity_log`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=minimal" },
    body: JSON.stringify({ company_id: companyId, contact_id: contactId, action: "lead_created", channel: "marketplace", result: "ok", actor_user_id: user?.id || null, metadata: { market_request_id: row.id } }),
  });
  return companyId;
}

function MarketplaceAdmin({ user, setActive, setCompanyDetailId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("bekleyen");
  const [kategoriFilter, setKategoriFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [convertedIds, setConvertedIds] = useState([]);

  const load = useCallback(async () => {
    setLoading(true); setErrorMsg("");
    const token = await authToken();
    if (!token) { setLoading(false); return; }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/market_requests?select=*&order=created_at.desc&limit=500`, { headers: authHeaders(token) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setErrorMsg(err.message || "Yüklenemedi — bu ekrana sadece site yöneticisi email'i erişebiliyor.");
      setRows([]); setLoading(false); return;
    }
    setRows(await res.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter(r => {
    if (statusFilter === "bekleyen" && (r.onay_durumu === "yayinda" || r.onay_durumu === "reddedildi")) return false;
    if (statusFilter === "yayinda" && r.onay_durumu !== "yayinda") return false;
    if (statusFilter === "reddedildi" && r.onay_durumu !== "reddedildi") return false;
    if (kategoriFilter && r.kategori !== kategoriFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (!`${r.baslik} ${r.ad_soyad} ${r.telefon}`.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  async function setStatus(id, status) {
    setBusyId(id);
    const token = await authToken();
    await fetch(`${SUPABASE_URL}/rest/v1/market_requests?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ onay_durumu: status }),
    });
    await writeAudit(token, user, status === "yayinda" ? "listing_approved" : status === "reddedildi" ? "listing_rejected" : "listing_pending", "market_requests", id, null, { onay_durumu: status });
    setRows(prev => prev.map(r => r.id === id ? { ...r, onay_durumu: status } : r));
    setBusyId(null);
  }

  function startEdit(r) {
    setEditingId(r.id);
    setEditForm({ baslik: r.baslik || "", fiyat: r.fiyat || "", aciklama: r.aciklama || "", kategori: r.kategori || "", alt_kategori: r.alt_kategori || "" });
  }

  async function saveEdit(id) {
    setBusyId(id);
    const token = await authToken();
    await fetch(`${SUPABASE_URL}/rest/v1/market_requests?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify(editForm),
    });
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...editForm } : r));
    setEditingId(null);
    setBusyId(null);
  }

  async function convertToLead(row) {
    setBusyId(row.id);
    const token = await authToken();
    try {
      await marketRequestToLead(row, user, token);
      setConvertedIds(prev => [...prev, row.id]);
    } catch (e) { alert("Lead oluşturulamadı: " + e.message); }
    setBusyId(null);
  }

  const counts = {
    bekleyen: rows.filter(r => r.onay_durumu !== "yayinda" && r.onay_durumu !== "reddedildi").length,
    yayinda: rows.filter(r => r.onay_durumu === "yayinda").length,
    reddedildi: rows.filter(r => r.onay_durumu === "reddedildi").length,
  };

  return (
    <div>
      <div style={cardSt({ padding: 20, marginBottom: 16 })}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 14 }}>🏪 Pazar Yeri İlan Onay Merkezi</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[["bekleyen", `Bekleyen (${counts.bekleyen})`], ["yayinda", `Yayında (${counts.yayinda})`], ["reddedildi", `Reddedilen (${counts.reddedildi})`], ["", "Tümü"]].map(([v, l]) => (
            <button key={v || "all"} onClick={() => setStatusFilter(v)} style={statusFilter === v ? bs(C.amber, C.onAccent) : ob(C.smoke)}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...inpStyle, width: 220 }} placeholder="🔍 Başlık/isim/telefon ara..." value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ ...inpStyle, width: 160, cursor: "pointer" }} value={kategoriFilter} onChange={e => setKategoriFilter(e.target.value)}>
            <option value="">Tüm kategoriler</option>
            <option value="makine">Makine</option>
            <option value="atasman">Ataşman</option>
            <option value="parca">Yedek Parça</option>
          </select>
          <button onClick={load} style={ob(C.blue)}>🔄 Yenile</button>
        </div>
      </div>

      {errorMsg && <div style={{ ...cardSt({ padding: 16 }), color: C.rust, marginBottom: 16 }}>{errorMsg}</div>}
      {loading && <div style={{ color: C.smoke }}>⏳ Yükleniyor...</div>}
      {!loading && !errorMsg && filtered.length === 0 && <div style={{ color: C.smoke, padding: 20 }}>Bu filtrede ilan yok.</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(r => (
          <div key={r.id} style={cardSt({ padding: 16 })}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <div>
                <b style={{ fontSize: 14 }}>{r.baslik || "(başlıksız)"}</b>{" "}
                <span style={pill(r.onay_durumu === "yayinda" ? C.green : r.onay_durumu === "reddedildi" ? C.rust : C.amber)}>
                  {r.onay_durumu === "yayinda" ? "Yayında" : r.onay_durumu === "reddedildi" ? "Reddedildi" : "Bekliyor"}
                </span>
              </div>
              <span style={{ fontSize: 11, color: C.smoke }}>{r.created_at ? new Date(r.created_at).toLocaleDateString("tr-TR") : ""}</span>
            </div>
            <div style={{ fontSize: 12, color: C.smoke, marginBottom: 6 }}>
              {r.islem_turu === "satis" ? "Satış" : "Alım Talebi"} · {MR_KATEGORI_LABEL[r.kategori] || "Kategori yok"}{r.alt_kategori ? ` (${r.alt_kategori})` : ""}
              {r.fiyat ? ` · ${r.fiyat}` : ""}{r.durum_bilgisi ? ` · ${r.durum_bilgisi}` : ""}
            </div>
            <div style={{ fontSize: 12, marginBottom: 8 }}><b>Kişi:</b> {r.ad_soyad || "—"} · <b>Tel:</b> {r.telefon || "—"}</div>
            {r.aciklama && <div style={{ fontSize: 12, color: C.smoke, marginBottom: 8 }}>{r.aciklama}</div>}
            {r.foto_urls?.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {r.foto_urls.map((p, i) => <img key={i} src={p} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.border}` }} />)}
              </div>
            )}

            {editingId === r.id ? (
              <div style={{ background: C.panel, borderRadius: 8, padding: 12, marginBottom: 8, display: "grid", gap: 8 }}>
                <input style={inpStyle} value={editForm.baslik} onChange={e => setEditForm(f => ({ ...f, baslik: e.target.value }))} placeholder="Başlık" />
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={inpStyle} value={editForm.fiyat} onChange={e => setEditForm(f => ({ ...f, fiyat: e.target.value }))} placeholder="Fiyat" />
                  <select style={{ ...inpStyle, cursor: "pointer" }} value={editForm.kategori} onChange={e => setEditForm(f => ({ ...f, kategori: e.target.value }))}>
                    <option value="">Kategori seç</option>
                    <option value="makine">Makine</option>
                    <option value="atasman">Ataşman</option>
                    <option value="parca">Yedek Parça</option>
                  </select>
                </div>
                <textarea style={{ ...inpStyle, minHeight: 60 }} value={editForm.aciklama} onChange={e => setEditForm(f => ({ ...f, aciklama: e.target.value }))} placeholder="Açıklama" />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => saveEdit(r.id)} disabled={busyId === r.id} style={bs(C.green, C.onAccent)}>💾 Kaydet</button>
                  <button onClick={() => setEditingId(null)} style={ob(C.smoke)}>Vazgeç</button>
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {r.onay_durumu !== "yayinda" && <button onClick={() => setStatus(r.id, "yayinda")} disabled={busyId === r.id} style={bs(C.green, C.onAccent)}>✓ Onayla</button>}
              {r.onay_durumu !== "reddedildi" && <button onClick={() => setStatus(r.id, "reddedildi")} disabled={busyId === r.id} style={ob(C.rust)}>✕ Reddet</button>}
              {(r.onay_durumu === "yayinda" || r.onay_durumu === "reddedildi") && <button onClick={() => setStatus(r.id, "bekliyor")} disabled={busyId === r.id} style={ob(C.smoke)}>↺ Yayından Kaldır</button>}
              <button onClick={() => startEdit(r)} style={ob(C.blue)}>✏ Düzenle</button>
              <a href={`https://gndmachinery.com/pazar.html?id=${r.id}`} target="_blank" rel="noreferrer" style={{ ...ob(C.smoke), textDecoration: "none" }}>🔗 İlanı Aç</a>
              {convertedIds.includes(r.id)
                ? <span style={pill(C.green)}>✓ Lead oluşturuldu</span>
                : <button onClick={() => convertToLead(r)} disabled={busyId === r.id} style={bs(C.amber, C.onAccent)}>{busyId === r.id ? "⏳..." : "→ Lead'e Dönüştür"}</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── COMPANIES (Faz 1/3 — server-side sayfalama + Activity Log timeline) ──────
const PAGE_SIZE = 30;

function CompanyDetail({ companyId, onClose }) {
  const [company, setCompany] = useState(null);
  const [methods, setMethods] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await authToken();
      if (!token) return;
      const h = authHeaders(token);
      const [cRes, mRes, aRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/companies?id=eq.${companyId}&select=*`, { headers: h }),
        fetch(`${SUPABASE_URL}/rest/v1/contact_methods?company_id=eq.${companyId}&select=*`, { headers: h }),
        fetch(`${SUPABASE_URL}/rest/v1/activity_log?company_id=eq.${companyId}&select=*&order=occurred_at.desc&limit=50`, { headers: h }),
      ]);
      const [c, m, a] = await Promise.all([cRes.json(), mRes.json(), aRes.json()]);
      if (!cancelled) { setCompany(c[0]); setMethods(m); setActivity(a); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{...cardSt({padding:28}),width:"100%",maxWidth:600,maxHeight:"88vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div style={{fontSize:19,fontWeight:800,color:C.amber}}>{loading ? "Yükleniyor..." : company?.name_original}</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.smoke,cursor:"pointer",fontSize:22}}>✕</button>
        </div>
        {!loading && company && (
          <>
            <div style={{fontSize:12,color:C.smoke,marginBottom:16}}>{company.country} · {company.region} · {company.sector}</div>
            <div style={{fontSize:11,color:C.smoke,marginBottom:8,fontWeight:700}}>İLETİŞİM YÖNTEMLERİ</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>
              {methods.length === 0 && <span style={{fontSize:12,color:C.smoke}}>Kayıt yok</span>}
              {methods.map(m => (
                <span key={m.id} style={pill(m.type==="email"?C.blue:C.green)}>{m.type}: {m.value_original}</span>
              ))}
            </div>
            {company.notes && (
              <div style={{marginBottom:18}}>
                <div style={{fontSize:11,color:C.smoke,marginBottom:6,fontWeight:700}}>NOTLAR</div>
                <div style={{background:C.navy,borderRadius:6,padding:"8px 12px",fontSize:13}}>{company.notes}</div>
              </div>
            )}
            <div style={{fontSize:11,color:C.smoke,marginBottom:8,fontWeight:700}}>İLETİŞİM GEÇMİŞİ (ACTIVITY LOG)</div>
            {activity.length === 0 && <div style={{fontSize:12,color:C.smoke,padding:"12px 0"}}>Henüz kayıtlı bir işlem yok.</div>}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {activity.map(a => (
                <div key={a.id} style={{display:"flex",gap:10,padding:"9px 12px",background:C.panel,borderRadius:6,border:`1px solid ${C.border}`}}>
                  <span style={{fontSize:11,color:C.smoke,minWidth:110}}>{new Date(a.occurred_at).toLocaleString("tr-TR")}</span>
                  <span style={{fontSize:12,flex:1}}><b>{a.channel || "—"}</b> · {a.action}{a.result ? ` (${a.result})` : ""}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CompaniesModul() {
  const [rowsData, setRowsData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const token = await authToken();
    if (!token) { setLoading(false); return; }
    const from = page * PAGE_SIZE, to = from + PAGE_SIZE - 1;
    let url = `${SUPABASE_URL}/rest/v1/companies?select=id,name_original,country,sector,verification_status&order=id.desc`;
    if (search.trim()) url += `&name_searchable=ilike.*${encodeURIComponent(nameSearchable(search))}*`;
    const res = await fetch(url, { headers: { ...authHeaders(token), Range: `${from}-${to}`, Prefer: "count=exact" } });
    const data = await res.json();
    const range = res.headers.get("Content-Range");
    setTotal(range ? Number(range.split("/")[1]) : data.length);
    setRowsData(data);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center",flexWrap:"wrap"}}>
        <input style={{...inpStyle,width:280,fontSize:15}} placeholder="🔍 Firma adı yaz ve ara..." value={search}
          onChange={e=>{setSearch(e.target.value); setPage(0);}}/>
        <span style={{fontSize:12,color:C.smoke}}>{total} firma · sayfa {page+1}/{pageCount}</span>
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"}}>
          <button onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0} style={bs(page===0?C.border:C.amber,page===0?C.smoke:C.onAccent,{opacity:page===0?0.5:1,cursor:page===0?"default":"pointer"})}>← Önceki 30</button>
          <button onClick={()=>setPage(p=>Math.min(pageCount-1,p+1))} disabled={page>=pageCount-1} style={bs(page>=pageCount-1?C.border:C.amber,page>=pageCount-1?C.smoke:C.onAccent,{opacity:page>=pageCount-1?0.5:1,cursor:page>=pageCount-1?"default":"pointer"})}>Sonraki 30 →</button>
        </div>
      </div>
      {loading ? <div style={{color:C.smoke,padding:20}}>Yükleniyor...</div> : (
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>{["FİRMA","ÜLKE","SEKTÖR","DURUM"].map(h=><th key={h} style={{background:C.panel,color:C.smoke,padding:"9px 12px",textAlign:"left",fontSize:11,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
            <tbody>{rowsData.map(r=>(
              <tr key={r.id} onClick={()=>setDetailId(r.id)} style={{cursor:"pointer"}}>
                <td style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`,fontWeight:700}}>{r.name_original}</td>
                <td style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`,color:C.smoke}}>{r.country}</td>
                <td style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`,color:C.smoke}}>{r.sector}</td>
                <td style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`}}><span style={pill(r.verification_status==="verified"?C.green:C.smoke)}>{r.verification_status}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {detailId && <CompanyDetail companyId={detailId} onClose={()=>setDetailId(null)}/>}
    </div>
  );
}

// ─── CAMPAIGN CENTER (Faz 4 — hedef seçimi + kampanya oluşturma) ──────────────
// Not: gönderim (kuyruk/worker/WhatsApp-Email provider) ayrı bir altyapı
// gerektirir (bkz. backend/). Burada kampanya + hedef listesi oluşturulur;
// gönderim altyapısı devreye girdiğinde bu hedefler otomatik işlenir.
function CampaignCenter() {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [messageTemplate, setMessageTemplate] = useState("");
  const [fCountry, setFCountry] = useState("");
  const [fSector, setFSector] = useState("");
  const [requireMethod, setRequireMethod] = useState(true);
  const [matchCount, setMatchCount] = useState(null);
  const [matching, setMatching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [result, setResult] = useState(null);

  const loadCampaigns = useCallback(async () => {
    const token = await authToken();
    if (!token) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?select=*&order=id.desc&limit=20`, { headers: authHeaders(token) });
    setCampaigns(await res.json());
  }, []);
  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  function buildTargetUrl() {
    let url = `${SUPABASE_URL}/rest/v1/contact_methods?select=id,company_id,companies(country,sector)&type=eq.${channel === "email" ? "email" : "whatsapp"}`;
    return url;
  }

  async function previewMatch() {
    setMatching(true);
    const token = await authToken();
    if (!token) { setMatching(false); return; }
    // contact_methods + companies join filtresi PostgREST embedded filter ile:
    let url = `${SUPABASE_URL}/rest/v1/contact_methods?select=id,companies!inner(country,sector)&type=eq.${channel === "email" ? "email" : "whatsapp"}`;
    if (fCountry) url += `&companies.country=eq.${encodeURIComponent(fCountry)}`;
    if (fSector) url += `&companies.sector=eq.${encodeURIComponent(fSector)}`;
    const res = await fetch(url, { headers: { ...authHeaders(token), Prefer: "count=exact", Range: "0-0" } });
    const range = res.headers.get("Content-Range");
    setMatchCount(range ? Number(range.split("/")[1]) : 0);
    setMatching(false);
  }

  async function createCampaign() {
    if (!name.trim()) return;
    setCreating(true);
    setResult(null);
    const token = await authToken();
    if (!token) { setCreating(false); return; }

    const cRes = await fetch(`${SUPABASE_URL}/rest/v1/campaigns`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify({
        name, channel, status: "draft", message_template: messageTemplate || null,
        filter_json: { country: fCountry || null, sector: fSector || null, requireMethod },
      }),
    });
    const cData = await cRes.json();
    if (!cRes.ok) { setResult({ error: JSON.stringify(cData) }); setCreating(false); return; }
    const campaignId = cData[0].id;

    let url = `${SUPABASE_URL}/rest/v1/contact_methods?select=id,company_id,companies!inner(country,sector)&type=eq.${channel === "email" ? "email" : "whatsapp"}`;
    if (fCountry) url += `&companies.country=eq.${encodeURIComponent(fCountry)}`;
    if (fSector) url += `&companies.sector=eq.${encodeURIComponent(fSector)}`;
    const mRes = await fetch(url, { headers: authHeaders(token) });
    const methods = await mRes.json();

    let added = 0;
    for (const m of methods) {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/campaign_targets`, {
        method: "POST",
        headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=representation,resolution=ignore-duplicates" },
        body: JSON.stringify({ campaign_id: campaignId, contact_method_id: m.id, company_id: m.company_id }),
      });
      if (r.ok) {
        const rows = await r.json();
        const target = rows?.[0];
        if (target) {
          await fetch(`${SUPABASE_URL}/rest/v1/outbound_messages`, {
            method: "POST",
            headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=minimal,resolution=ignore-duplicates" },
            body: JSON.stringify({
              campaign_target_id: target.id,
              contact_method_id: m.id,
              channel,
              template: messageTemplate || null,
              idempotency_key: `ct_${target.id}_initial`,
              status: "queued",
            }),
          });
        }
        added++;
      }
    }

    setResult({ campaignId, added });
    setName(""); setMatchCount(null); setMessageTemplate("");
    loadCampaigns();
    setCreating(false);
  }

  return (
    <div>
      <div style={cardSt({ padding: 24, marginBottom: 20 })}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 14 }}>📣 Yeni Kampanya</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div><label style={{fontSize:11,color:C.smoke}}>KAMPANYA ADI</label><input style={inpStyle} value={name} onChange={e=>setName(e.target.value)} placeholder="Örn: TR Hafriyat – Marketplace"/></div>
          <div><label style={{fontSize:11,color:C.smoke}}>KANAL</label>
            <select style={{...inpStyle,cursor:"pointer"}} value={channel} onChange={e=>{setChannel(e.target.value); setMatchCount(null);}}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">E-posta</option>
            </select>
          </div>
          <div><label style={{fontSize:11,color:C.smoke}}>ÜLKE (opsiyonel)</label><input style={inpStyle} value={fCountry} onChange={e=>{setFCountry(e.target.value); setMatchCount(null);}} placeholder="Örn: Türkiye"/></div>
          <div><label style={{fontSize:11,color:C.smoke}}>SEKTÖR (opsiyonel)</label><input style={inpStyle} value={fSector} onChange={e=>{setFSector(e.target.value); setMatchCount(null);}} placeholder="Örn: Hafriyat"/></div>
        </div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,color:C.smoke}}>MESAJ ŞABLONU</label>
          <textarea style={{...inpStyle,minHeight:70,resize:"vertical",fontFamily:"inherit"}} value={messageTemplate} onChange={e=>setMessageTemplate(e.target.value)} placeholder="Örn: Merhaba, GND İş Makineleri olarak..."/>
          <div style={{fontSize:10,color:C.muted,marginTop:4}}>Gönderim otomatik değil — "Gönderim Kuyruğu" ekranından tek tek WhatsApp/mail açıp elle gönderirsin.</div>
        </div>
        <div style={{display:"flex",gap:10,marginBottom:14}}>
          <button onClick={previewMatch} disabled={matching} style={ob(C.blue)}>{matching?"Hesaplanıyor...":"🔍 Hedef Kitleyi Say"}</button>
          {matchCount !== null && <span style={{fontSize:13,color:C.ghost,alignSelf:"center"}}>{matchCount} kişi eşleşiyor</span>}
        </div>
        <button onClick={createCampaign} disabled={creating || !name.trim()} style={{...bs(C.amber,C.onAccent),width:"100%",opacity:creating?0.7:1}}>
          {creating ? "⏳ Oluşturuluyor..." : "Kampanyayı ve Hedef Listesini Oluştur"}
        </button>
        {result && !result.error && <div style={{marginTop:12,fontSize:13,color:C.green}}>✅ Kampanya oluşturuldu, {result.added} hedef eklendi. Gönderim altyapısı (Faz 5/6) hazır olduğunda otomatik işlenecek.</div>}
        {result?.error && <div style={{marginTop:12,fontSize:13,color:C.rust}}>Hata: {result.error}</div>}
      </div>

      <div style={cardSt({ padding: 24 })}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 14 }}>Kampanyalar</div>
        {campaigns.length === 0 && <div style={{color:C.smoke,fontSize:13}}>Henüz kampanya yok.</div>}
        {campaigns.map(c => (
          <div key={c.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",background:C.panel,borderRadius:8,border:`1px solid ${C.border}`,marginBottom:8}}>
            <div><b>{c.name}</b> <span style={{color:C.smoke,fontSize:12}}>· {c.channel}</span></div>
            <span style={pill(c.status==="active"?C.green:C.smoke)}>{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Faz 4/6 — Meta WhatsApp Business API ve gerçek e-posta sağlayıcısı henüz
// bağlı değil (Duran'ın kendi hesap doğrulaması gerekiyor). Bu yüzden gönderim
// şimdilik yarı-otomatik: wa.me / mailto linki operatörün kendi WhatsApp/mail
// istemcisini açar, operatör gönderir ve burada "Gönderildi" olarak işaretler.
function SendQueue({ user }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState("whatsapp");

  const load = useCallback(async () => {
    setLoading(true);
    const token = await authToken();
    if (!token) { setLoading(false); return; }
    const url = `${SUPABASE_URL}/rest/v1/outbound_messages?select=id,channel,template,status,sequence_step,contact_methods(value_original,value_normalized,type),campaign_targets(campaign_id,companies(name_original))&status=eq.queued&channel=eq.${channelFilter}&order=id.asc&limit=50`;
    const res = await fetch(url, { headers: authHeaders(token) });
    setRows(res.ok ? await res.json() : []);
    setLoading(false);
  }, [channelFilter]);
  useEffect(() => { load(); }, [load]);

  function renderMessage(row) {
    const companyName = row.campaign_targets?.companies?.name_original || "";
    return (row.template || "").replaceAll("{firma}", companyName);
  }

  function openLink(row) {
    const method = row.contact_methods;
    if (!method) return;
    const msg = encodeURIComponent(renderMessage(row));
    if (row.channel === "whatsapp") {
      const digits = (method.value_normalized || "").replace(/\D/g, "");
      window.open(`https://wa.me/${digits}?text=${msg}`, "_blank");
    } else {
      window.open(`mailto:${method.value_original}?body=${msg}`, "_blank");
    }
  }

  async function markSent(row) {
    const token = await authToken();
    if (!token) return;
    await fetch(`${SUPABASE_URL}/rest/v1/outbound_messages?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ status: "sent", sent_at: new Date().toISOString() }),
    });
    await writeAudit(token, user, "send", "outbound_messages", row.id, { status: "queued" }, { status: "sent" });
    setRows(prev => prev.filter(r => r.id !== row.id));
  }

  async function markFailed(row) {
    const token = await authToken();
    if (!token) return;
    await fetch(`${SUPABASE_URL}/rest/v1/outbound_messages?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ status: "failed", last_error: "Operatör manuel olarak atladı/başarısız işaretledi." }),
    });
    setRows(prev => prev.filter(r => r.id !== row.id));
  }

  return (
    <div>
      <div style={cardSt({ padding: 20, marginBottom: 16 })}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 10 }}>📤 Gönderim Kuyruğu</div>
        <div style={{ fontSize: 12, color: C.smoke, marginBottom: 14 }}>
          Meta WhatsApp Business API ve e-posta sağlayıcısı henüz bağlı değil, bu yüzden gönderim elle onaylanıyor:
          linke tıkla → WhatsApp/mail açılır, mesajı sen gönder → "Gönderildi" işaretle.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setChannelFilter("whatsapp")} style={channelFilter === "whatsapp" ? bs(C.amber, C.onAccent) : ob(C.smoke)}>WhatsApp</button>
          <button onClick={() => setChannelFilter("email")} style={channelFilter === "email" ? bs(C.amber, C.onAccent) : ob(C.smoke)}>E-posta</button>
          <button onClick={load} style={ob(C.blue)}>🔄 Yenile</button>
        </div>
      </div>

      <div style={cardSt({ padding: 20 })}>
        {loading && <div style={{ color: C.smoke }}>⏳ Yükleniyor...</div>}
        {!loading && rows.length === 0 && <div style={{ color: C.smoke, fontSize: 13 }}>Kuyrukta bekleyen mesaj yok.</div>}
        {rows.map(row => (
          <div key={row.id} style={{ padding: "12px 14px", background: C.panel, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <b style={{ fontSize: 13 }}>{row.campaign_targets?.companies?.name_original || "—"}</b>
              <span style={{ fontSize: 12, color: C.smoke }}>{row.contact_methods?.value_original}</span>
            </div>
            <div style={{ fontSize: 12, color: C.ghost, whiteSpace: "pre-wrap", marginBottom: 10 }}>{renderMessage(row) || "(şablon boş)"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => openLink(row)} style={bs(C.green, C.onAccent)}>{row.channel === "whatsapp" ? "💬 WhatsApp'ta Aç" : "✉ Mail'de Aç"}</button>
              <button onClick={() => markSent(row)} style={ob(C.blue)}>✅ Gönderildi</button>
              <button onClick={() => markFailed(row)} style={ob(C.rust)}>✕ Atla</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── IMPORT CENTER (Faz 2) ─────────────────────────────────────────────────────
function ImportCenter({ user }) {
  const [rows, setRows] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [fileName, setFileName] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!grid.length) { setRows([]); setPreview(null); return; }

    const header = grid[0];
    const col = {
      company: findColumn(header, COLUMN_ALIASES.company),
      country: findColumn(header, COLUMN_ALIASES.country),
      region: findColumn(header, COLUMN_ALIASES.region),
      sector: findColumn(header, COLUMN_ALIASES.sector),
      contact: findColumn(header, COLUMN_ALIASES.contact),
      phone: findColumn(header, COLUMN_ALIASES.phone),
      whatsapp: findColumn(header, COLUMN_ALIASES.whatsapp),
      email: findColumn(header, COLUMN_ALIASES.email),
      notes: findColumn(header, COLUMN_ALIASES.notes),
    };
    const get = (r, key) => (col[key] >= 0 ? r[col[key]] : "");

    const parsed = grid.slice(1)
      .filter(r => r.some(c => String(c || "").trim() !== ""))
      .map(r => ({
        company: String(get(r, "company") || "").trim(),
        country: String(get(r, "country") || "").trim(),
        region: String(get(r, "region") || "").trim(),
        sector: String(get(r, "sector") || "").trim(),
        contact: String(get(r, "contact") || "").trim(),
        phone: String(get(r, "phone") || "").trim(),
        whatsapp: String(get(r, "whatsapp") || "").trim(),
        email: String(get(r, "email") || "").trim(),
        notes: String(get(r, "notes") || "").trim(),
      }));

    setRows(parsed);

    // Var olan normalize edilmiş telefon/email'leri çekip duplicate tahmini yap.
    const token = await authToken();
    const existingPhones = new Set();
    const existingEmails = new Set();
    if (token) {
      let offset = 0;
      while (true) {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/contact_methods?select=type,value_normalized&limit=1000&offset=${offset}`, { headers: authHeaders(token) });
        const d = await r.json();
        if (!Array.isArray(d) || d.length === 0) break;
        d.forEach(m => { if (m.type === "email") existingEmails.add(m.value_normalized); else existingPhones.add(m.value_normalized); });
        if (d.length < 1000) break;
        offset += 1000;
      }
    }

    let newCompanyCount = 0, dupePhone = 0, dupeEmail = 0, invalidPhone = 0, invalidEmail = 0, noCompanyName = 0;
    parsed.forEach(row => {
      if (!row.company) noCompanyName++; else newCompanyCount++;
      const pn = normalizePhone(row.phone);
      const en = normalizeEmail(row.email);
      if (row.phone && !pn) invalidPhone++;
      if (row.email && !en) invalidEmail++;
      if (pn && existingPhones.has(pn)) dupePhone++;
      if (en && existingEmails.has(en)) dupeEmail++;
    });

    setPreview({
      total: parsed.length, newCompanyCount, noCompanyName,
      dupePhone, dupeEmail, invalidPhone, invalidEmail,
    });
  }

  async function tryInsertMethod(companyId, contactId, type, original, normalized, isPrimary) {
    const token = await authToken();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contact_methods`, {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ company_id: companyId, contact_id: contactId, type, value_original: original, value_normalized: normalized, is_primary: isPrimary }),
    });
    return res.ok || res.status === 409;
  }

  async function runImport() {
    if (!rows || !rows.length) return;
    setImporting(true);
    setProgress(0);
    const stats = { companies: 0, contacts: 0, methods: 0, skipped: 0, errors: 0 };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.company) { stats.skipped++; setProgress(i + 1); continue; }
      try {
        const token = await authToken();
        if (!token) throw new Error("oturum yok");

        const cRes = await fetch(`${SUPABASE_URL}/rest/v1/companies`, {
          method: "POST",
          headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=representation" },
          body: JSON.stringify({
            name_original: row.company, name_searchable: nameSearchable(row.company),
            country: row.country || null, region: row.region || null, sector: row.sector || null,
            notes: row.notes || null, data_source: "import_center", verification_status: "unverified",
            owner_user_id: user?.id || null,
          }),
        });
        const cData = await cRes.json();
        if (!cRes.ok) throw new Error(JSON.stringify(cData));
        const companyId = cData[0].id;
        stats.companies++;

        const conRes = await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
          method: "POST",
          headers: { ...authHeaders(token), "Content-Type": "application/json", "Prefer": "return=representation" },
          body: JSON.stringify({ company_id: companyId, person_name: row.contact || null, status: "Gönderilmedi" }),
        });
        const conData = await conRes.json();
        if (!conRes.ok) throw new Error(JSON.stringify(conData));
        const contactId = conData[0].id;
        stats.contacts++;

        const pn = normalizePhone(row.phone);
        const wn = normalizePhone(row.whatsapp);
        const en = normalizeEmail(row.email);
        if (pn && await tryInsertMethod(companyId, contactId, "phone", row.phone, pn, true)) stats.methods++;
        if (wn && wn !== pn && await tryInsertMethod(companyId, contactId, "whatsapp", row.whatsapp, wn, false)) stats.methods++;
        if (en && await tryInsertMethod(companyId, contactId, "email", row.email, en, !pn)) stats.methods++;
      } catch (e) {
        stats.errors++;
      }
      setProgress(i + 1);
    }

    setResult(stats);
    setImporting(false);
  }

  return (
    <div>
      <div style={cardSt({ padding: 24, marginBottom: 20 })}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 12 }}>📥 Excel / CSV Yükle</div>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile}
          style={{ color: C.ghost, fontSize: 13 }} />
        {fileName && <div style={{ fontSize: 12, color: C.smoke, marginTop: 8 }}>{fileName} — {rows ? rows.length : 0} satır okundu</div>}
        <div style={{ fontSize: 11, color: C.smoke, marginTop: 10 }}>
          Beklenen sütunlar (herhangi bir sırada olabilir): Firma, Ülke, Bölge/İl, Sektör, Kişi, Telefon, WhatsApp, E-posta, Not
        </div>
      </div>

      {preview && (
        <div style={cardSt({ padding: 24, marginBottom: 20 })}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.amber, marginBottom: 14 }}>Önizleme</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[
              { l: "TOPLAM SATIR", v: preview.total, c: C.ghost },
              { l: "YENİ FİRMA (TAHMİNİ)", v: preview.newCompanyCount, c: C.green },
              { l: "FİRMA ADI EKSİK", v: preview.noCompanyName, c: C.rust },
              { l: "TELEFON DUPLICATE", v: preview.dupePhone, c: C.amber },
              { l: "EMAIL DUPLICATE", v: preview.dupeEmail, c: C.amber },
              { l: "GEÇERSİZ TELEFON", v: preview.invalidPhone, c: C.rust },
              { l: "GEÇERSİZ EMAIL", v: preview.invalidEmail, c: C.rust },
            ].map(k => (
              <div key={k.l} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: k.c }}>{k.v}</div>
                <div style={{ fontSize: 10, color: C.smoke, marginTop: 4 }}>{k.l}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: C.smoke, marginTop: 14 }}>
            Duplicate olarak işaretlenenler otomatik atlanmaz — içe aktarma sırasında veritabanı seviyesinde
            tekrar kontrol edilir, aynı telefon/email tekrar company_methods'a eklenmez.
          </p>
          <button onClick={runImport} disabled={importing || !rows?.length} style={{ ...bs(C.amber, C.onAccent), width: "100%", marginTop: 8, opacity: importing ? 0.7 : 1 }}>
            {importing ? `⏳ İçe aktarılıyor... ${progress}/${rows.length}` : "✅ Onayla ve İçe Aktar"}
          </button>
        </div>
      )}

      {result && (
        <div style={cardSt({ padding: 24, border: `1px solid ${C.green}44`, background: C.greenDim })}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 10 }}>✅ İçe Aktarma Tamamlandı</div>
          <div style={{ fontSize: 13, lineHeight: 1.9 }}>
            {result.companies} firma · {result.contacts} kişi · {result.methods} iletişim yöntemi eklendi
            {result.skipped > 0 && ` · ${result.skipped} satır atlandı (firma adı yok)`}
            {result.errors > 0 && ` · ${result.errors} hata`}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CRM ──────────────────────────────────────────────────────────────────────
function CRMModul({ leads, loadLeads, user }) {
  const [sub, setSub] = useState("pipeline");
  const [search, setSearch] = useState("");
  const [fR, setFR] = useState("Tümü");
  const [fS, setFS] = useState("Tümü");
  const [fSec, setFSec] = useState("Tümü");
  const [fC, setFC] = useState("Tümü");
  const [detail, setDetail] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);

  const countryOptions = useMemo(()=>{
    const set = new Set();
    leads.forEach(l=>{ if(l.country && l.country.trim()) set.add(l.country.trim()); });
    return Array.from(set).sort();
  },[leads]);

  const filtered = useMemo(()=>leads.filter(l=>{
    if(fR!=="Tümü"&&l.region!==fR)return false;
    if(fS!=="Tümü"&&l.stage!==fS)return false;
    if(fSec!=="Tümü"&&l.sector!==fSec)return false;
    if(fC!=="Tümü"&&l.country!==fC)return false;
    if(search&&!`${l.company} ${l.contact} ${l.country} ${l.notes||""}`.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  }),[leads,fR,fS,fSec,fC,search]);

  async function handleSave(data) {
    if (editLead) { await dbUpdateLead(editLead.id, data, user); }
    else { await dbInsertLead(data, user); }
    await loadLeads();
    setShowForm(false);
    setEditLead(null);
  }

  async function handleDelete(id) {
    if (window.confirm("Bu lead silinsin mi?")) {
      await dbDeleteLead(id, user);
      await loadLeads();
      setDetail(null);
    }
  }

  async function handleStageChange(id, stage) {
    await dbUpdateStage(id, stage, user);
    await loadLeads();
  }

  return (
    <div>
      {showForm && (
        <LeadFormModal
          editLead={editLead}
          onClose={()=>{setShowForm(false);setEditLead(null);}}
          onSave={handleSave}
        />
      )}

      <div style={{display:"flex",gap:8,marginBottom:18,borderBottom:`1px solid ${C.border}`,paddingBottom:12}}>
        {[["pipeline","Pipeline"],["list","Liste"],["firma","🔍 Firma Bul"]].map(([k,v])=>(
          <button key={k} onClick={()=>setSub(k)} style={bs(sub===k?C.amberDim:"transparent",sub===k?C.amber:C.smoke,{border:`1px solid ${sub===k?C.amber+"55":C.border}`})}>{v}</button>
        ))}
        <button onClick={()=>{setEditLead(null);setShowForm(true);}} style={bs(C.amber,C.onAccent,{marginLeft:"auto"})}>+ Yeni Lead</button>
      </div>

      {sub==="firma"&&<FirmaBul onAdd={async(l)=>{await dbInsertLead(l, user);await loadLeads();}}/>}

      {(sub==="pipeline"||sub==="list")&&(
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
          <input style={{...inpStyle,width:220}} placeholder="🔍 Firma, şehir, adres ara..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <select style={{...inpStyle,width:"auto",cursor:"pointer"}} value={fSec} onChange={e=>setFSec(e.target.value)}><option>Tümü</option>{SECTORS.map(s=><option key={s}>{s}</option>)}</select>
          <select style={{...inpStyle,width:"auto",cursor:"pointer"}} value={fR} onChange={e=>setFR(e.target.value)}><option>Tümü</option>{REGIONS.map(r=><option key={r}>{r}</option>)}</select>
          <select style={{...inpStyle,width:"auto",cursor:"pointer"}} value={fC} onChange={e=>setFC(e.target.value)}><option>Tümü</option>{countryOptions.map(c=><option key={c}>{c}</option>)}</select>
          <select style={{...inpStyle,width:"auto",cursor:"pointer"}} value={fS} onChange={e=>setFS(e.target.value)}><option>Tümü</option>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
          <span style={{fontSize:12,color:C.smoke}}>{filtered.length} sonuç</span>
        </div>
      )}

      {sub==="pipeline"&&(
        <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:8}}>
          {STAGES.map(stage=>{
            const sl=filtered.filter(l=>l.stage===stage);
            return (
              <div key={stage} style={{minWidth:195,flex:"0 0 195px"}}>
                <div style={{background:SC[stage],borderRadius:"6px 6px 0 0",padding:"8px 12px",fontSize:11,fontWeight:700,color:"#050D18",display:"flex",justifyContent:"space-between"}}>
                  <span>{stage}</span><span>{fmt(sl.reduce((a,l)=>a+l.value,0))}</span>
                </div>
                <div style={{background:C.panel,border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 6px 6px",padding:8,minHeight:80,display:"flex",flexDirection:"column",gap:8}}>
                  {sl.length===0&&<div style={{fontSize:11,color:C.smoke,textAlign:"center",padding:12}}>Boş</div>}
                  {sl.map(l=>(
                    <div key={l.id} onClick={()=>setDetail(l)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 12px",cursor:"pointer"}}>
                      <div style={{fontWeight:700,fontSize:13}}>{l.company}</div>
                      <div style={{fontSize:11,color:C.smoke}}>{l.contact}</div>
                      <div style={{fontSize:10,color:C.smoke,marginTop:2}}>🌍 {l.country} {l.sector?`· ${l.sector}`:""}</div>
                      <div style={{fontSize:12,color:C.amber,fontWeight:700,marginTop:5}}>{fmt(l.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sub==="list"&&(
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr>{["FİRMA","SEKTÖR","KİŞİ","ÜLKE","DEĞER","AŞAMA","İLETİŞİM"].map(h=><th key={h} style={{background:C.panel,color:C.smoke,padding:"9px 12px",textAlign:"left",fontSize:11,borderBottom:`1px solid ${C.border}`,fontWeight:600}}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map(l=>(
              <tr key={l.id} onClick={()=>setDetail(l)} style={{cursor:"pointer"}}>
                <td style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`,fontWeight:700}}>{l.company}</td>
                <td style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`,color:C.smoke}}>{l.sector}</td>
                <td style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`}}>{l.contact}</td>
                <td style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`,color:C.smoke}}>{l.country}</td>
                <td style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`,color:C.amber,fontWeight:700}}>{fmt(l.value)}</td>
                <td style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`}}><span style={pill(SC[l.stage])}>{l.stage}</span></td>
                <td style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`}} onClick={e=>e.stopPropagation()}>
                  <a href={`https://wa.me/${(l.whatsapp||"").replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{...ob("#25D366"),textDecoration:"none",marginRight:4}}>WA</a>
                  <a href={`mailto:${l.email}`} style={{...ob(C.blue),textDecoration:"none"}}>Mail</a>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {detail&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{...cardSt({padding:28}),width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div><div style={{fontSize:20,fontWeight:800,color:C.amber}}>{detail.company}</div><div style={{fontSize:13,color:C.smoke,marginTop:2}}>{detail.country} · {detail.region}</div></div>
              <button onClick={()=>setDetail(null)} style={{background:"none",border:"none",color:C.smoke,cursor:"pointer",fontSize:22}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
              <div><div style={{fontSize:10,color:C.smoke,marginBottom:2}}>KİŞİ</div><div>{detail.contact}</div></div>
              <div><div style={{fontSize:10,color:C.smoke,marginBottom:2}}>DEĞER</div><div style={{fontSize:18,color:C.amber,fontWeight:800}}>{fmt(detail.value)}</div></div>
              <div><div style={{fontSize:10,color:C.smoke,marginBottom:2}}>SEKTÖR</div><div>{detail.sector}</div></div>
              <div><div style={{fontSize:10,color:C.smoke,marginBottom:2}}>ÜRÜN TİPİ</div><div>{detail.productType}</div></div>
            </div>
            <div style={{marginBottom:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
              <div style={{fontSize:10,color:C.smoke,marginBottom:8}}>İLETİŞİM</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {detail.whatsapp&&<a href={`https://wa.me/${detail.whatsapp.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{...ob("#25D366"),textDecoration:"none"}}>📱 {detail.whatsapp}</a>}
                {detail.email&&<a href={`mailto:${detail.email}`} style={{...ob(C.blue),textDecoration:"none"}}>✉ {detail.email}</a>}
              </div>
            </div>
            {detail.notes&&<div style={{marginBottom:14}}><div style={{fontSize:10,color:C.smoke,marginBottom:4}}>NOTLAR</div><div style={{background:C.navy,borderRadius:6,padding:"8px 12px",fontSize:13,lineHeight:1.5}}>{detail.notes}</div></div>}
            <div style={{marginBottom:14,paddingTop:14,borderTop:`1px solid ${C.border}`}}>
              <div style={{fontSize:10,color:C.smoke,marginBottom:8}}>AŞAMA DEĞİŞTİR</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {STAGES.map(s=><button key={s} onClick={async()=>{await handleStageChange(detail.id,s);setDetail(d=>({...d,stage:s}));}} style={{...pill(SC[s]),cursor:"pointer",border:detail.stage===s?`2px solid ${SC[s]}`:`1px solid ${SC[s]}33`,background:detail.stage===s?SC[s]+"33":SC[s]+"11"}}>{s}</button>)}
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>handleDelete(detail.id)} style={ob(C.rust)}>Sil</button>
              <button onClick={()=>setDetail(null)} style={ob(C.smoke)}>Kapat</button>
              <button onClick={()=>{setEditLead(detail);setShowForm(true);setDetail(null);}} style={bs(C.amber,C.onAccent)}>✏ Düzenle</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI COPILOT ───────────────────────────────────────────────────────────────
function AICopilot({ leads }) {
  const [msgs,setMsgs]=useState([{role:"assistant",text:"Günaydın Duran. 👋\n\nBen GNDOS AI Copilot'un. Global iş makinesi uzmanın.\n\n🎯 Öncelikli leadleri söylerim\n🌍 Pazar analizi yaparım\n📄 Teklif metni yazarım\n\nNe öğrenmek istiyorsun?"}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);

  async function send(text) {
    const msg=text||input.trim();
    if(!msg)return;
    setInput("");
    setMsgs(m=>[...m,{role:"user",text:msg}]);
    setLoading(true);
    const ctx=`Global iş makinesi satış uzmanısın. Kullanıcı: Duran. Leadler: ${leads.map(l=>`${l.company}(${l.country},${l.stage},$${l.value})`).join(", ")}. Türkçe, kısa cevap.`;
    try {
      const reply = await callAI(ctx, msg);
      setMsgs(m=>[...m,{role:"assistant",text:reply||"(boş cevap)"}]);
    } catch(e){setMsgs(m=>[...m,{role:"assistant",text:"Bağlantı hatası: " + e.message}]);}
    setLoading(false);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"65vh"}}>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"78%",background:m.role==="user"?C.amber:C.card,color:m.role==="user"?C.onAccent:C.ghost,borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"12px 16px",fontSize:14,lineHeight:1.7,border:`1px solid ${m.role==="user"?C.amber:C.border}`,whiteSpace:"pre-wrap"}}>{m.text}</div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px 16px 16px 4px",padding:"12px 16px",color:C.smoke}}>⏳ Düşünüyor...</div></div>}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
        {["Bugün hangi leadlere odaklanayım?","Suudi Arabistan için strateji öner","Pipeline değerimi nasıl artırırım?"].map((s,i)=><button key={i} onClick={()=>send(s)} style={{...ob(C.smoke),fontSize:11,padding:"4px 10px"}}>{s}</button>)}
      </div>
      <div style={{display:"flex",gap:10}}>
        <input style={{...inpStyle,flex:1}} placeholder="Sorunuzu yazın..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}/>
        <button onClick={()=>send()} disabled={loading} style={bs(C.amber,C.onAccent,{padding:"8px 20px"})}>Gönder</button>
      </div>
    </div>
  );
}

function SimpleModule({title, content}) {
  return (
    <div style={{...cardSt({padding:40,textAlign:"center"})}}>
      <div style={{fontSize:48,marginBottom:16}}>{title.split(" ")[0]}</div>
      <div style={{fontSize:18,fontWeight:700,color:C.amber,marginBottom:8}}>{title}</div>
      <div style={{color:C.smoke}}>{content}</div>
    </div>
  );
}

// ─── ANA UYGULAMA ─────────────────────────────────────────────────────────────
export default function GNDOS() {
  const [session, setSessionState] = useState(()=>getSession());
  const [active, setActive] = useState("home");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const loggedIn = !!session;
  const user = session?.user;

  async function loadLeads() {
    setLoading(true);
    const data = await dbGetLeads();
    setLeads(data);
    setLoading(false);
  }

  useEffect(()=>{ if(loggedIn) loadLeads(); },[loggedIn]);

  function handleLogin(newSession) {
    setSessionState(newSession);
  }

  function handleLogout() {
    clearSession();
    setSessionState(null);
    setLeads([]);
  }

  if (!loggedIn) return <LoginScreen onLogin={handleLogin}/>;
  if (loading) return <div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:C.amber,fontSize:18,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>⚙️ GNDOS yükleniyor...</div>;

  return (
    <div style={{fontFamily:"'Inter','Helvetica Neue',sans-serif",background:C.bg,minHeight:"100vh",color:C.ghost,display:"flex",flexDirection:"column"}}>
      <div style={{background:C.iron,borderBottom:`2px solid ${C.amber}22`,padding:"0 24px",display:"flex",alignItems:"center",height:54,flexShrink:0,position:"sticky",top:0,zIndex:50}}>
        <button onClick={()=>setActive("home")} style={{background:"none",border:"none",cursor:"pointer",padding:"0 16px 0 0",borderRight:`1px solid ${C.border}`,marginRight:16,display:"flex",alignItems:"center",height:"100%"}}>
          <img src="/logo.png" alt="GND" style={{height:30}}/>
        </button>
        <div style={{display:"flex",gap:0,flex:1,overflowX:"auto"}}>
          {MODULES.map(m=>(
            <button key={m.key} onClick={()=>setActive(m.key)} style={{background:active===m.key?C.amberDim:"transparent",color:active===m.key?C.amber:C.smoke,border:"none",borderBottom:active===m.key?`2px solid ${C.amber}`:"2px solid transparent",padding:"0 12px",height:54,cursor:"pointer",fontSize:12,fontWeight:active===m.key?700:400,display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
              <span>{m.icon}</span><span>{m.label}</span>
            </button>
          ))}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,paddingLeft:16,borderLeft:`1px solid ${C.border}`,flexShrink:0}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:C.green}}/>
          <span style={{fontSize:11,color:C.smoke}}>{user?.email || "Online"}</span>
          <button onClick={handleLogout} style={{...ob(C.smoke),fontSize:10,padding:"3px 8px",marginLeft:8}}>Çıkış</button>
        </div>
      </div>

      <div style={{flex:1,padding:"24px 28px",overflowY:"auto",maxWidth:1400,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
        {active==="home"&&<CommandCenter leads={leads} setActive={setActive} loadLeads={loadLeads}/>}
        {active==="crm"&&<CRMModul leads={leads} loadLeads={loadLeads} user={user}/>}
        {active==="import"&&<ImportCenter user={user}/>}
        {active==="companies"&&<CompaniesModul/>}
        {active==="campaigns"&&<CampaignCenter/>}
        {active==="queue"&&<SendQueue user={user}/>}
        {active==="marketplace"&&<MarketplaceAdmin user={user}/>}
        {active==="ai"&&<AICopilot leads={leads}/>}
        {active==="makine"&&<SimpleModule title="🏗️ Equipment Center" content="Makine kataloğu yakında aktif olacak"/>}
        {active==="stok"&&<SimpleModule title="📦 Inventory" content="Stok yönetimi yakında aktif olacak"/>}
        {active==="finans"&&<SimpleModule title="💰 Finance" content="Finans takibi yakında aktif olacak"/>}
        {active==="analiz"&&<SimpleModule title="📊 Intelligence" content="Analiz paneli yakında aktif olacak"/>}
        {active==="teklif"&&<SimpleModule title="📄 Proposal Center" content="Teklif merkezi yakında aktif olacak"/>}
        {active==="dokuman"&&<SimpleModule title="📁 Knowledge Base" content="Bilgi bankası yakında aktif olacak"/>}
      </div>

      <div style={{position:"fixed",bottom:8,right:12,fontSize:11,color:"rgba(0,0,0,0.18)",pointerEvents:"none",zIndex:40}}>
        Shadow Master
      </div>
    </div>
  );
}
