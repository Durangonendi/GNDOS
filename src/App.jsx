import { useState, useMemo, useEffect, useCallback } from "react";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const PASSWORD = "Gndos2026";

async function dbGetLeads() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/leads?select=*&order=id.desc`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    return Array.isArray(data) ? data.map(l => ({
      ...l, value: Number(l.value) || 0,
      productType: l.product_type || ""
    })) : [];
  } catch(e) { return []; }
}

async function dbInsertLead(lead) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
      body: JSON.stringify({ company: lead.company, contact: lead.contact, country: lead.country, region: lead.region, sector: lead.sector, product_type: lead.productType, product: lead.product, value: lead.value || 0, stage: lead.stage || "Lead", whatsapp: lead.whatsapp, email: lead.email, phone: lead.phone, notes: lead.notes })
    });
  } catch(e) {}
}

async function dbUpdateLead(id, lead) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "PATCH",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ company: lead.company, contact: lead.contact, country: lead.country, region: lead.region, sector: lead.sector, product_type: lead.productType, product: lead.product, value: lead.value || 0, stage: lead.stage, whatsapp: lead.whatsapp, email: lead.email, phone: lead.phone, notes: lead.notes })
    });
  } catch(e) {}
}

async function dbUpdateStage(id, stage) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "PATCH",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ stage })
    });
  } catch(e) {}
}

async function dbDeleteLead(id) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "DELETE",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
  } catch(e) {}
}

const C = {
  bg:"#060D14", navy:"#0A1628", iron:"#0E1E2E", panel:"#0C1822",
  card:"#101F30", amber:"#F0A500", amberDim:"#F0A50015",
  green:"#1DB954", greenDim:"#1DB95415",
  rust:"#E63946", rustDim:"#E6394615",
  blue:"#2196F3", blueDim:"#2196F315",
  orange:"#FF6B35",
  ghost:"#E8EDF3", smoke:"#6B8299", muted:"#3A5068",
  border:"#162030",
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

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [pass, setPass] = useState("");
  const [error, setError] = useState(false);
  function tryLogin() {
    if (pass === PASSWORD) { onLogin(); }
    else { setError(true); setTimeout(()=>setError(false), 2000); }
  }
  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:40,width:320,textAlign:"center"}}>
        <div style={{fontSize:28,fontWeight:900,letterSpacing:4,color:C.amber,marginBottom:4}}>GNDOS</div>
        <div style={{fontSize:11,color:C.smoke,letterSpacing:2,marginBottom:32}}>GLOBAL OPS PLATFORM</div>
        <input type="password" placeholder="Şifre girin..." value={pass}
          onChange={e=>setPass(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&tryLogin()}
          style={{...inpStyle,textAlign:"center",letterSpacing:4,marginBottom:12,border:`1px solid ${error?C.rust:C.border}`}}
        />
        {error && <div style={{color:C.rust,fontSize:12,marginBottom:8}}>Yanlış şifre!</div>}
        <button onClick={tryLogin} style={{...bs(C.amber,C.navy),width:"100%",padding:11,fontSize:14}}>Giriş Yap</button>
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
          <button onClick={handleSave} disabled={saving} style={bs(C.amber,C.navy,{opacity:saving?0.7:1})}>{saving?"⏳ Kaydediliyor...":"💾 Kaydet"}</button>
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

  const hour = new Date().getHours();
  const greeting = hour<12?"Günaydın":hour<18?"İyi öğleden sonralar":"İyi akşamlar";
  const totalVal = leads.reduce((a,l)=>a+l.value,0);
  const hotLeads = leads.filter(l=>["Teklif Verildi","Müzakere"].includes(l.stage));

  async function getAIBriefing() {
    setBriefingLoading(true);
    const prompt = `Günaydın Duran. ile başla. Global iş makinesi satışı için kısa sabah brifing yaz (Türkçe, 5-6 madde, emoji kullan). Leadler: ${leads.map(l=>`${l.company}(${l.country},${l.stage},$${l.value})`).join(", ")}`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:600,messages:[{role:"user",content:prompt}]})});
      const data = await res.json();
      setBriefing(data.content?.map(i=>i.text||"").join("")||"");
    } catch(e){setBriefing("Bağlantı hatası.");}
    setBriefingLoading(false);
  }

  async function getPriorities() {
    setPrioLoading(true); setPrioOpen(true);
    const prompt = `İş makinesi satış uzmanısın. Bu leadleri öncelik sırasına koy: ${leads.map(l=>`${l.company}(${l.country},${l.stage},$${l.value})`).join(", ")}. Türkçe, kısa.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:600,messages:[{role:"user",content:prompt}]})});
      const data = await res.json();
      setPriorities(data.content?.map(i=>i.text||"").join("")||"");
    } catch(e){setPriorities("Bağlantı hatası.");}
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
        <button onClick={getPriorities} style={{background:`linear-gradient(135deg,${C.amber},#E08C00)`,color:C.navy,border:"none",borderRadius:10,padding:"14px 28px",cursor:"pointer",fontSize:15,fontWeight:900,boxShadow:`0 4px 24px ${C.amber}40`}}>
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
    setLoading(true);setFirmalar([]);setAdded({});setError("");
    const lok=mode==="TR"?`${il}, Türkiye`:ulke;
    const prompt=`${lok} bölgesindeki ${sektor} sektöründe iş makinesi firmaları. SADECE JSON:\n[{"company":"","contact":"","phone":"","whatsapp":"","email":"","address":"","notes":""}]\n10 firma, gerçekçi isimler.`;
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const text=data.content?.map(i=>i.text||"").join("")||"";
      setFirmalar(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(e){setError("API bağlantısı yok. API key gerekli.");}
    setLoading(false);
  }

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        {[["TR","🇹🇷 Türkiye"],["GLOBAL","🌍 Global"]].map(([k,v])=>(
          <button key={k} onClick={()=>setMode(k)} style={bs(mode===k?C.amber:C.card,mode===k?C.navy:C.smoke,{border:`1px solid ${mode===k?C.amber:C.border}`})}>{v}</button>
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
        <button onClick={ara} disabled={loading} style={bs(C.amber,C.navy,{padding:"10px 24px",alignSelf:"flex-end",opacity:loading?0.7:1})}>{loading?"⏳ Aranıyor...":"🔍 Firma Ara"}</button>
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
                <button onClick={()=>{onAdd({company:f.company,contact:f.contact||"",country:mode==="TR"?"Türkiye":ulke,region:mode==="TR"?"Türkiye":region,sector:sektor,productType:"Yeni Makine",product:"",value:0,stage:"Lead",whatsapp:f.whatsapp||f.phone||"",email:f.email||"",phone:f.phone||"",notes:f.notes||""});setAdded(a=>({...a,[i]:true}));}} disabled={added[i]} style={bs(added[i]?C.green+"33":C.amber,added[i]?C.green:C.navy,{border:added[i]?`1px solid ${C.green}`:"none"})}>{added[i]?"✓ Eklendi":"+ Ekle"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading&&firmalar.length===0&&<div style={{textAlign:"center",padding:60,color:C.smoke}}><div style={{fontSize:48,marginBottom:12}}>🔍</div><div>Bölge + sektör seç, Firma Ara'ya bas</div></div>}
    </div>
  );
}

// ─── CRM ──────────────────────────────────────────────────────────────────────
function CRMModul({ leads, loadLeads }) {
  const [sub, setSub] = useState("pipeline");
  const [search, setSearch] = useState("");
  const [fR, setFR] = useState("Tümü");
  const [fS, setFS] = useState("Tümü");
  const [detail, setDetail] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editLead, setEditLead] = useState(null);

  const filtered = useMemo(()=>leads.filter(l=>{
    if(fR!=="Tümü"&&l.region!==fR)return false;
    if(fS!=="Tümü"&&l.stage!==fS)return false;
    if(search&&!`${l.company} ${l.contact} ${l.country}`.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  }),[leads,fR,fS,search]);

  async function handleSave(data) {
    if (editLead) { await dbUpdateLead(editLead.id, data); }
    else { await dbInsertLead(data); }
    await loadLeads();
    setShowForm(false);
    setEditLead(null);
  }

  async function handleDelete(id) {
    if (window.confirm("Bu lead silinsin mi?")) {
      await dbDeleteLead(id);
      await loadLeads();
      setDetail(null);
    }
  }

  async function handleStageChange(id, stage) {
    await dbUpdateStage(id, stage);
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
        <button onClick={()=>{setEditLead(null);setShowForm(true);}} style={bs(C.amber,C.navy,{marginLeft:"auto"})}>+ Yeni Lead</button>
      </div>

      {sub==="firma"&&<FirmaBul onAdd={async(l)=>{await dbInsertLead(l);await loadLeads();}}/>}

      {(sub==="pipeline"||sub==="list")&&(
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
          <input style={{...inpStyle,width:200}} placeholder="🔍 Ara..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <select style={{...inpStyle,width:"auto",cursor:"pointer"}} value={fR} onChange={e=>setFR(e.target.value)}><option>Tümü</option>{REGIONS.map(r=><option key={r}>{r}</option>)}</select>
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
                      <div style={{fontSize:10,color:C.smoke,marginTop:2}}>🌍 {l.country}</div>
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
            <thead><tr>{["FİRMA","KİŞİ","ÜLKE","DEĞER","AŞAMA","İLETİŞİM"].map(h=><th key={h} style={{background:C.panel,color:C.smoke,padding:"9px 12px",textAlign:"left",fontSize:11,borderBottom:`1px solid ${C.border}`,fontWeight:600}}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map(l=>(
              <tr key={l.id} onClick={()=>setDetail(l)} style={{cursor:"pointer"}}>
                <td style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`,fontWeight:700}}>{l.company}</td>
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
              <button onClick={()=>{setEditLead(detail);setShowForm(true);setDetail(null);}} style={bs(C.amber,C.navy)}>✏ Düzenle</button>
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
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:600,system:ctx,messages:[{role:"user",content:msg}]})});
      const data=await res.json();
      setMsgs(m=>[...m,{role:"assistant",text:data.content?.map(i=>i.text||"").join("")||"API key gerekli."}]);
    } catch(e){setMsgs(m=>[...m,{role:"assistant",text:"Bağlantı hatası — API key gerekli."}]);}
    setLoading(false);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",height:"65vh"}}>
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,marginBottom:16}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"78%",background:m.role==="user"?C.amber:C.card,color:m.role==="user"?C.navy:C.ghost,borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"12px 16px",fontSize:14,lineHeight:1.7,border:`1px solid ${m.role==="user"?C.amber:C.border}`,whiteSpace:"pre-wrap"}}>{m.text}</div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",justifyContent:"flex-start"}}><div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"16px 16px 16px 4px",padding:"12px 16px",color:C.smoke}}>⏳ Düşünüyor...</div></div>}
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
        {["Bugün hangi leadlere odaklanayım?","Suudi Arabistan için strateji öner","Pipeline değerimi nasıl artırırım?"].map((s,i)=><button key={i} onClick={()=>send(s)} style={{...ob(C.smoke),fontSize:11,padding:"4px 10px"}}>{s}</button>)}
      </div>
      <div style={{display:"flex",gap:10}}>
        <input style={{...inpStyle,flex:1}} placeholder="Sorunuzu yazın..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}/>
        <button onClick={()=>send()} disabled={loading} style={bs(C.amber,C.navy,{padding:"8px 20px"})}>Gönder</button>
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
  const [loggedIn, setLoggedIn] = useState(()=>{ try{ return localStorage.getItem("gndos_auth")==="1"; }catch(e){ return false; } });
  const [active, setActive] = useState("home");
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadLeads() {
    setLoading(true);
    const data = await dbGetLeads();
    setLeads(data);
    setLoading(false);
  }

  useEffect(()=>{ if(loggedIn) loadLeads(); },[loggedIn]);

  function handleLogin() {
    try{ localStorage.setItem("gndos_auth","1"); }catch(e){}
    setLoggedIn(true);
  }

  if (!loggedIn) return <LoginScreen onLogin={handleLogin}/>;
  if (loading) return <div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:C.amber,fontSize:18,fontWeight:700,fontFamily:"'Inter',sans-serif"}}>⚙️ GNDOS yükleniyor...</div>;

  return (
    <div style={{fontFamily:"'Inter','Helvetica Neue',sans-serif",background:C.bg,minHeight:"100vh",color:C.ghost,display:"flex",flexDirection:"column"}}>
      <div style={{background:C.iron,borderBottom:`2px solid ${C.amber}22`,padding:"0 24px",display:"flex",alignItems:"center",height:54,flexShrink:0,position:"sticky",top:0,zIndex:50}}>
        <button onClick={()=>setActive("home")} style={{background:"none",border:"none",cursor:"pointer",padding:"0 16px 0 0",borderRight:`1px solid ${C.border}`,marginRight:16}}>
          <div style={{fontWeight:900,fontSize:18,letterSpacing:4,color:C.amber,lineHeight:1}}>GNDOS</div>
          <div style={{fontSize:8,color:C.smoke,letterSpacing:2}}>GLOBAL OPS PLATFORM</div>
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
          <span style={{fontSize:11,color:C.smoke}}>Online</span>
          <button onClick={()=>{try{localStorage.removeItem("gndos_auth");}catch(e){}setLoggedIn(false);}} style={{...ob(C.smoke),fontSize:10,padding:"3px 8px",marginLeft:8}}>Çıkış</button>
        </div>
      </div>

      <div style={{flex:1,padding:"24px 28px",overflowY:"auto",maxWidth:1400,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
        {active==="home"&&<CommandCenter leads={leads} setActive={setActive} loadLeads={loadLeads}/>}
        {active==="crm"&&<CRMModul leads={leads} loadLeads={loadLeads}/>}
        {active==="ai"&&<AICopilot leads={leads}/>}
        {active==="makine"&&<SimpleModule title="🏗️ Equipment Center" content="Makine kataloğu yakında aktif olacak"/>}
        {active==="stok"&&<SimpleModule title="📦 Inventory" content="Stok yönetimi yakında aktif olacak"/>}
        {active==="finans"&&<SimpleModule title="💰 Finance" content="Finans takibi yakında aktif olacak"/>}
        {active==="analiz"&&<SimpleModule title="📊 Intelligence" content="Analiz paneli yakında aktif olacak"/>}
        {active==="teklif"&&<SimpleModule title="📄 Proposal Center" content="Teklif merkezi yakında aktif olacak"/>}
        {active==="dokuman"&&<SimpleModule title="📁 Knowledge Base" content="Bilgi bankası yakında aktif olacak"/>}
      </div>
    </div>
  );
}
