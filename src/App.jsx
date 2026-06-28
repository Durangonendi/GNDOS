import { useState, useMemo } from "react";

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

const DEMO_LEADS = [
  {id:1,company:"Al-Mashariq Mining Co.",contact:"Ahmed Al-Rashid",country:"Suudi Arabistan",region:"Orta Doğu",sector:"Madencilik",productType:"Yeni Makine",product:"Komatsu PC800",value:1250000,stage:"Teklif Verildi",whatsapp:"+966501234567",email:"ahmed@almashariq.sa",phone:"+966501234567",notes:"2 adet talep etti.",created:"2026-04-10",lastContact:"2026-06-20",lat:24.7,lng:46.7},
  {id:2,company:"Kazmunaigas Infra",contact:"Dmitri Volkov",country:"Kazakistan",region:"Orta Asya",sector:"Petrol & Gaz",productType:"Yedek Parça",product:"CAT 390F Parça",value:85000,stage:"Müzakere",whatsapp:"+77011234567",email:"d.volkov@kmgi.kz",phone:"+77011234567",notes:"%8 iskonto talep etti.",created:"2026-05-02",lastContact:"2026-06-22",lat:48.0,lng:66.9},
  {id:3,company:"Balkan Roads d.o.o.",contact:"Marko Petrović",country:"Sırbistan",region:"Avrupa",sector:"Yol Yapım",productType:"Yeni Makine",product:"Dynapac CC6200",value:180000,stage:"Kazanıldı",whatsapp:"+381641234567",email:"m.petrovic@balkanroads.rs",phone:"+381641234567",notes:"Sözleşme imzalandı.",created:"2026-03-20",lastContact:"2026-06-10",lat:44.0,lng:21.0},
  {id:4,company:"Tarkwa Gold Mine Ltd.",contact:"Kwame Asante",country:"Gana",region:"Sahra Altı Afrika",sector:"Madencilik",productType:"Yeni Makine",product:"Liebherr T264",value:2800000,stage:"Lead",whatsapp:"+233241234567",email:"k.asante@tarkwagold.gh",phone:"+233241234567",notes:"Büyük proje.",created:"2026-06-15",lastContact:"2026-06-15",lat:5.5,lng:-2.0},
  {id:5,company:"Baghdad Infrastructure",contact:"Omar Al-Faruq",country:"Irak",region:"Orta Doğu",sector:"İnşaat",productType:"İkinci El Makine",product:"Volvo EC480",value:420000,stage:"İletişime Geçildi",whatsapp:"+9647901234567",email:"omar@baghdad-infra.iq",phone:"+9647901234567",notes:"LinkedIn'den geldi.",created:"2026-06-18",lastContact:"2026-06-24",lat:33.3,lng:44.4},
];

const DEMO_STOK = [
  {id:1,kod:"YP-CAT-001",ad:"CAT 390F Motor Filtresi",kategori:"Yedek Parça",marka:"Caterpillar",adet:45,birimFiyat:280,depo:"İstanbul",kritikSeviye:10},
  {id:2,kod:"YP-KOM-002",ad:"Komatsu PC800 Hidrolik Pompa",kategori:"Yedek Parça",marka:"Komatsu",adet:3,birimFiyat:12500,depo:"Ankara",kritikSeviye:2},
  {id:3,kod:"YP-VOL-003",ad:"Volvo EC380 Bucket Diş Seti",kategori:"Aksesuar",marka:"Volvo",adet:120,birimFiyat:85,depo:"İstanbul",kritikSeviye:20},
];

const DEMO_FINANS = [
  {id:1,tip:"Gelir",kategori:"Makine Satışı",tutar:180000,tarih:"2026-06-10",aciklama:"Balkan Roads - Dynapac CC6200",durum:"Tahsil Edildi"},
  {id:2,tip:"Gelir",kategori:"Yedek Parça",tutar:8500,tarih:"2026-06-15",aciklama:"CAT filtre seti",durum:"Bekliyor"},
  {id:3,tip:"Gider",kategori:"Lojistik",tutar:3200,tarih:"2026-06-12",aciklama:"Sırbistan nakliye",durum:"Ödendi"},
];

const DEMO_TEKLIFLER = [
  {id:1,musteri:"Al-Mashariq Mining Co.",urun:"Komatsu PC800 x2",tutar:2500000,tarih:"2026-06-18",durum:"Gönderildi",notlar:"Q3 teslimat."},
  {id:2,musteri:"Tarkwa Gold Mine",urun:"Liebherr T264 x1",tutar:2900000,tarih:"2026-06-22",durum:"Hazırlanıyor",notlar:"Büyük proje."},
];

const b = (bg,color,ex={}) => ({background:bg,color,border:"none",borderRadius:6,padding:"8px 18px",cursor:"pointer",fontSize:13,fontWeight:700,...ex});
const ob = (color) => ({background:"transparent",color,border:`1px solid ${color}33`,borderRadius:6,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:600});
const inp = {background:C.navy,color:C.ghost,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",fontSize:13,width:"100%",boxSizing:"border-box"};
const sel = {...inp,cursor:"pointer"};
const card = (ex={}) => ({background:C.card,border:`1px solid ${C.border}`,borderRadius:10,...ex});
const pill = (color) => ({background:color+"20",color,border:`1px solid ${color}40`,borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:600,whiteSpace:"nowrap",display:"inline-block"});

function WorldMap({leads}) {
  const toX = lng => ((lng+180)/360)*860;
  const toY = lat => ((90-lat)/180)*400;
  const stageColor = {"Lead":C.smoke,"İletişime Geçildi":C.blue,"Teklif Verildi":C.amber,"Müzakere":C.orange,"Kazanıldı":C.green,"Kaybedildi":C.rust};
  return (
    <div style={{...card({padding:20,marginBottom:20})}}>
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
            return (
              <g key={l.id}>
                <circle cx={x} cy={y} r="10" fill={color} opacity="0.15"/>
                <circle cx={x} cy={y} r="5" fill={color} opacity="0.6"/>
                <circle cx={x} cy={y} r="3" fill={color}/>
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{display:"flex",gap:16,marginTop:10,flexWrap:"wrap"}}>
        {[["Teklif",C.amber],["Müzakere",C.orange],["Kazanıldı",C.green],["Lead",C.smoke]].map(([l,c])=>(
          <span key={l} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.smoke}}>
            <span style={{width:7,height:7,borderRadius:"50%",background:c,display:"inline-block"}}/>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function CommandCenter({leads, setActive}) {
  const [briefing,setBriefing]=useState("");
  const [briefingLoading,setBriefingLoading]=useState(false);
  const [priorities,setPriorities]=useState("");
  const [prioLoading,setPrioLoading]=useState(false);
  const [prioOpen,setPrioOpen]=useState(false);

  const hour = new Date().getHours();
  const greeting = hour<12?"Günaydın":hour<18?"İyi öğleden sonralar":"İyi akşamlar";
  const totalVal = leads.reduce((a,l)=>a+l.value,0);
  const hotLeads = leads.filter(l=>["Teklif Verildi","Müzakere"].includes(l.stage));

  async function getAIBriefing() {
    setBriefingLoading(true);
    const prompt = `Günaydın Duran. ile başla. Global iş makinesi satışı için kısa sabah brifing yaz (Türkçe, 5-6 madde, emoji kullan). Aktif leadler: ${leads.map(l=>`${l.company}(${l.country},${l.stage},$${l.value})`).join(", ")}`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:600,messages:[{role:"user",content:prompt}]})});
      const data = await res.json();
      setBriefing(data.content?.map(i=>i.text||"").join("")||"");
    } catch(e){setBriefing("Bağlantı hatası.");}
    setBriefingLoading(false);
  }

  async function getPriorities() {
    setPrioLoading(true);setPrioOpen(true);
    const prompt = `İş makinesi satış uzmanısın. Bu leadleri öncelik sırasına koy, bugün ne yapılmalı: ${leads.map(l=>`${l.company}(${l.country},${l.stage},$${l.value})`).join(", ")}. Türkçe, kısa.`;
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
        <div style={{...card({padding:20,marginBottom:20,border:`1px solid ${C.amber}44`,background:C.amberDim})}}>
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
          <div key={k.l} style={card({padding:16})}>
            <div style={{fontSize:20,marginBottom:6}}>{k.icon}</div>
            <div style={{fontSize:22,fontWeight:900,color:k.c}}>{k.v}</div>
            <div style={{fontSize:10,color:C.smoke,marginTop:4,letterSpacing:0.8}}>{k.l}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
        <div style={card({padding:20})}>
          <div style={{fontSize:12,fontWeight:700,color:C.amber,letterSpacing:1,marginBottom:14}}>🟢 BUGÜNKÜ GÖREVLER</div>
          {[
            {text:`${leads.filter(l=>l.stage==="Lead").length} yeni lead aranacak`,icon:"📞",c:C.blue},
            {text:`${hotLeads.length} sıcak fırsat takip edilecek`,icon:"🔥",c:C.orange},
            {text:`${DEMO_TEKLIFLER.filter(t=>t.durum==="Hazırlanıyor").length} teklif hazırlanacak`,icon:"📄",c:C.amber},
            {text:`${DEMO_STOK.filter(s=>s.adet<=s.kritikSeviye).length} üründe stok kritik`,icon:"⚠️",c:C.rust},
          ].map((t,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:C.panel,borderRadius:8,border:`1px solid ${C.border}`,marginBottom:8}}>
              <span>{t.icon}</span><span style={{fontSize:13,flex:1}}>{t.text}</span>
              <span style={{width:7,height:7,borderRadius:"50%",background:t.c}}/>
            </div>
          ))}
        </div>
        <div style={card({padding:20})}>
          <div style={{fontSize:12,fontWeight:700,color:C.amber,letterSpacing:1,marginBottom:14}}>🤖 AI MARKET ALERTS</div>
          {[
            {text:"Suudi Arabistan'da yeni maden ihalesi açıldı",flag:"🇸🇦",c:C.amber},
            {text:"Kazakistan'dan 30 gündür cevap yok",flag:"🇰🇿",c:C.rust},
            {text:"Gana'daki Tarkwa Gold — büyük proje",flag:"🇬🇭",c:C.green},
            {text:"Irak'ta hafriyat büyüme trendi devam ediyor",flag:"🇮🇶",c:C.blue},
          ].map((a,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:C.panel,borderRadius:8,border:`1px solid ${a.c}22`,marginBottom:8}}>
              <span style={{fontSize:18}}>{a.flag}</span><span style={{fontSize:12,flex:1,lineHeight:1.4}}>{a.text}</span>
            </div>
          ))}
          <button onClick={getAIBriefing} disabled={briefingLoading} style={{...b(C.blueDim,C.blue,{border:`1px solid ${C.blue}33`,width:"100%",marginTop:4,fontSize:12})}}>
            {briefingLoading?"⏳ Hazırlanıyor...":"📋 AI Sabah Brifing'i Al"}
          </button>
        </div>
      </div>

      {briefing && (
        <div style={{...card({padding:20,marginBottom:20,border:`1px solid ${C.blue}33`,background:C.blueDim})}}>
          <div style={{fontSize:12,fontWeight:700,color:C.blue,marginBottom:12}}>🤖 AI SABAH BRİFİNG</div>
          <div style={{fontSize:14,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{briefing}</div>
        </div>
      )}

      <WorldMap leads={leads}/>

      <div style={card({padding:20,marginBottom:20})}>
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

      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {MODULES.map(m=>(
          <button key={m.key} onClick={()=>setActive(m.key)} style={{...card({padding:"16px 12px",cursor:"pointer",textAlign:"center",display:"block",width:"100%",border:`1px solid ${C.border}`})}} >
            <div style={{fontSize:28,marginBottom:6}}>{m.icon}</div>
            <div style={{fontSize:11,fontWeight:700,color:C.ghost}}>{m.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FirmaBul({onAdd}) {
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
    const prompt=`${lok} bölgesindeki ${sektor} sektöründe iş makinesi firmaları. SADECE JSON: [{"company":"","contact":"","phone":"","whatsapp":"","email":"","address":"","notes":""}] 10 firma.`;
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const text=data.content?.map(i=>i.text||"").join("")||"";
      setFirmalar(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(e){setError("Veri alınamadı.");}
    setLoading(false);
  }

  return (
    <div>
      <div style={{display:"flex",gap:10,marginBottom:20}}>
        {[["TR","🇹🇷 Türkiye"],["GLOBAL","🌍 Global"]].map(([k,v])=>(
          <button key={k} onClick={()=>setMode(k)} style={b(mode===k?C.amber:C.card,mode===k?C.navy:C.smoke,{border:`1px solid ${mode===k?C.amber:C.border}`})}>{v}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap",alignItems:"flex-end"}}>
        {mode==="TR"?(
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <label style={{fontSize:11,color:C.smoke}}>İL</label>
            <select value={il} onChange={e=>setIl(e.target.value)} style={{...sel,width:150}}>{TR_ILLER.map(i=><option key={i}>{i}</option>)}</select>
          </div>
        ):(
          <>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label style={{fontSize:11,color:C.smoke}}>BÖLGE</label>
              <select value={region} onChange={e=>{setRegion(e.target.value);setUlke(ULKELER[e.target.value]?.[0]||"");}} style={sel}>{Object.keys(ULKELER).map(r=><option key={r}>{r}</option>)}</select>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5}}>
              <label style={{fontSize:11,color:C.smoke}}>ÜLKE</label>
              <select value={ulke} onChange={e=>setUlke(e.target.value)} style={sel}>{(ULKELER[region]||[]).map(u=><option key={u}>{u}</option>)}</select>
            </div>
          </>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          <label style={{fontSize:11,color:C.smoke}}>SEKTÖR</label>
          <select value={sektor} onChange={e=>setSektor(e.target.value)} style={sel}>{SECTORS.map(s=><option key={s}>{s}</option>)}</select>
        </div>
        <button onClick={ara} disabled={loading} style={b(C.amber,C.navy,{padding:"10px 24px",alignSelf:"flex-end",opacity:loading?0.7:1})}>{loading?"⏳ Aranıyor...":"🔍 Firma Ara"}</button>
      </div>
      {error&&<div style={{color:C.rust,padding:12,background:C.rustDim,borderRadius:6,marginBottom:12}}>{error}</div>}
      {loading&&<div style={{textAlign:"center",padding:48,color:C.smoke}}><div style={{fontSize:36,marginBottom:8}}>⚙️</div><div>{mode==="TR"?il:ulke} · {sektor} aranıyor...</div></div>}
      {firmalar.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {firmalar.map((f,i)=>(
            <div key={i} style={{...card({padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:16,border:`1px solid ${added[i]?C.green:C.border}`})}}>
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
                <button onClick={()=>{onAdd({company:f.company,contact:f.contact||"",country:mode==="TR"?"Türkiye":ulke,region:mode==="TR"?"Türkiye":region,sector:sektor,productType:"Yeni Makine",product:"",value:0,stage:"Lead",whatsapp:f.whatsapp||f.phone||"",email:f.email||"",phone:f.phone||"",notes:f.notes||""});setAdded(a=>({...a,[i]:true}));}} disabled={added[i]} style={b(added[i]?C.green+"33":C.amber,added[i]?C.green:C.navy,{border:added[i]?`1px solid ${C.green}`:"none"})}>{added[i]?"✓ Eklendi":"+ Ekle"}</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading&&firmalar.length===0&&<div style={{textAlign:"center",padding:60,color:C.smoke}}><div style={{fontSize:48,marginBottom:12}}>🔍</div><div>Bölge + sektör seç, Firma Ara'ya bas</div></div>}
    </div>
  );
}

function CRMModul({leads,setLeads}) {
  const [sub,setSub]=useState("pipeline");
  const [search,setSearch]=useState("");
  const [fR,setFR]=useState("Tümü");
  const [fS,setFS]=useState("Tümü");
  const [detail,setDetail]=useState(null);
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState({});

  const filtered=useMemo(()=>leads.filter(l=>{
    if(fR!=="Tümü"&&l.region!==fR)return false;
    if(fS!=="Tümü"&&l.stage!==fS)return false;
    if(search&&!`${l.company} ${l.contact} ${l.country}`.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  }),[leads,fR,fS,search]);

  function save(){if(!form.company)return;if(editId){setLeads(ls=>ls.map(l=>l.id===editId?{...l,...form}:l));}else{setLeads(ls=>[...ls,{...form,id:Date.now(),created:today(),lastContact:today()}]);}setShowForm(false);}
  function del(id){if(window.confirm("Silinsin mi?")){setLeads(ls=>ls.filter(l=>l.id!==id));setDetail(null);}}
  function move(id,stage){setLeads(ls=>ls.map(l=>l.id===id?{...l,stage}:l));}

  const F=({label,name,type="text",opts,span})=>(
    <div style={{display:"flex",flexDirection:"column",gap:4,...(span?{gridColumn:"1/-1"}:{})}}>
      <label style={{fontSize:11,color:C.smoke,fontWeight:600}}>{label}</label>
      {opts?<select style={sel} value={form[name]||""} onChange={e=>setForm(f=>({...f,[name]:e.target.value}))}>{opts.map(o=><option key={o}>{o}</option>)}</select>
      :type==="textarea"?<textarea style={{...inp,minHeight:70,resize:"vertical"}} value={form[name]||""} onChange={e=>setForm(f=>({...f,[name]:e.target.value}))}/>
      :<input style={inp} type={type} value={form[name]||""} onChange={e=>setForm(f=>({...f,[name]:type==="number"?Number(e.target.value):e.target.value}))}/>}
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:18,borderBottom:`1px solid ${C.border}`,paddingBottom:12}}>
        {[["pipeline","Pipeline"],["list","Liste"],["firma","🔍 Firma Bul"]].map(([k,v])=>(
          <button key={k} onClick={()=>setSub(k)} style={b(sub===k?C.amberDim:"transparent",sub===k?C.amber:C.smoke,{border:`1px solid ${sub===k?C.amber+"55":C.border}`})}>{v}</button>
        ))}
        <button onClick={()=>{setForm({stage:"Lead",region:"Türkiye",sector:"Hafriyat",productType:"Yeni Makine",value:0});setEditId(null);setShowForm(true);}} style={b(C.amber,C.navy,{marginLeft:"auto"})}>+ Yeni Lead</button>
      </div>

      {sub==="firma"&&<FirmaBul onAdd={l=>{setLeads(ls=>[...ls,{...l,id:Date.now(),created:today(),lastContact:today()}]);}}/>}

      {(sub==="pipeline"||sub==="list")&&(
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
          <input style={{...inp,width:200}} placeholder="🔍 Ara..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <select style={{...sel,width:"auto"}} value={fR} onChange={e=>setFR(e.target.value)}><option>Tümü</option>{REGIONS.map(r=><option key={r}>{r}</option>)}</select>
          <select style={{...sel,width:"auto"}} value={fS} onChange={e=>setFS(e.target.value)}><option>Tümü</option>{STAGES.map(s=><option key={s}>{s}</option>)}</select>
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
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setDetail(null)}>
          <div style={{...card({padding:28}),width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div><div style={{fontSize:20,fontWeight:800,color:C.amber}}>{detail.company}</div><div style={{fontSize:13,color:C.smoke,marginTop:2}}>{detail.country} · {detail.region}</div></div>
              <span style={pill(SC[detail.stage])}>{detail.stage}</span>
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
                {STAGES.map(s=><button key={s} onClick={()=>{move(detail.id,s);setDetail(d=>({...d,stage:s}));}} style={{...pill(SC[s]),cursor:"pointer",border:detail.stage===s?`2px solid ${SC[s]}`:`1px solid ${SC[s]}33`,background:detail.stage===s?SC[s]+"33":SC[s]+"11"}}>{s}</button>)}
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>del(detail.id)} style={ob(C.rust)}>Sil</button>
              <button onClick={()=>setDetail(null)} style={ob(C.smoke)}>Kapat</button>
              <button onClick={()=>{setForm({...detail});setEditId(detail.id);setShowForm(true);setDetail(null);}} style={b(C.amber,C.navy)}>✏ Düzenle</button>
            </div>
          </div>
        </div>
      )}

      {showForm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setShowForm(false)}>
          <div style={{...card({padding:28}),width:"100%",maxWidth:540,maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:800,color:C.amber,marginBottom:20}}>{editId?"Lead Düzenle":"Yeni Lead"}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <F label="FİRMA ADI *" name="company" span/><F label="İLETİŞİM KİŞİSİ" name="contact"/><F label="ÜLKE" name="country"/>
              <F label="BÖLGE" name="region" opts={REGIONS}/><F label="SEKTÖR" name="sector" opts={SECTORS}/><F label="ÜRÜN TİPİ" name="productType" opts={PRODUCT_TYPES}/>
              <F label="ÜRÜN / TALEP" name="product" span/><F label="DEĞER ($)" name="value" type="number"/><F label="AŞAMA" name="stage" opts={STAGES}/>
              <F label="WHATSAPP" name="whatsapp" span/><F label="E-POSTA" name="email"/><F label="TELEFON" name="phone"/>
              <F label="NOTLAR" name="notes" type="textarea" span/>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20}}>
              <button onClick={()=>setShowForm(false)} style={ob(C.smoke)}>İptal</button>
              <button onClick={save} style={b(C.amber,C.navy)}>💾 Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AICopilot({leads}) {
  const [msgs,setMsgs]=useState([{role:"assistant",text:"Günaydın Duran. 👋\n\nBen GNDOS AI Copilot'un. Global iş makinesi ve ağır ekipman sektörü uzmanın.\n\n🎯 Öncelikli leadleri söylerim\n🌍 Pazar analizi yaparım\n📄 Teklif metni yazarım\n\nNe öğrenmek istiyorsun?"}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const suggestions=["Bugün hangi leadlere odaklanayım?","Suudi Arabistan pazarı için strateji öner","Pipeline değerimi artırmak için ne yapmalıyım?"];

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
      setMsgs(m=>[...m,{role:"assistant",text:data.content?.map(i=>i.text||"").join("")||"Cevap alınamadı."}]);
    } catch(e){setMsgs(m=>[...m,{role:"assistant",text:"Bağlantı hatası."}]);}
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
        {suggestions.map((s,i)=><button key={i} onClick={()=>send(s)} style={{...ob(C.smoke),fontSize:11,padding:"4px 10px"}}>{s}</button>)}
      </div>
      <div style={{display:"flex",gap:10}}>
        <input style={{...inp,flex:1}} placeholder="Sorunuzu yazın..." value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&send()}/>
        <button onClick={()=>send()} disabled={loading} style={b(C.amber,C.navy,{padding:"8px 20px"})}>Gönder</button>
      </div>
    </div>
  );
}

function SimpleModule({title, content}) {
  return (
    <div style={{...card({padding:40,textAlign:"center"})}}>
      <div style={{fontSize:48,marginBottom:16}}>{title.split(" ")[0]}</div>
      <div style={{fontSize:18,fontWeight:700,color:C.amber,marginBottom:8}}>{title}</div>
      <div style={{color:C.smoke}}>{content}</div>
    </div>
  );
}

export default function GNDOS() {
  const [active,setActive]=useState("home");
  const [leads,setLeads]=useState(DEMO_LEADS);
  const cur=MODULES.find(m=>m.key===active);

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
        </div>
      </div>

      <div style={{flex:1,padding:"24px 28px",overflowY:"auto",maxWidth:1400,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
        {active==="home"&&<CommandCenter leads={leads} setActive={setActive}/>}
        {active==="crm"&&<CRMModul leads={leads} setLeads={setLeads}/>}
        {active==="ai"&&<AICopilot leads={leads}/>}
        {active==="makine"&&<SimpleModule title="🏗️ Equipment Center" content="Makine kataloğu — yakında aktif olacak"/>}
        {active==="stok"&&<SimpleModule title="📦 Inventory" content="Stok yönetimi — yakında aktif olacak"/>}
        {active==="finans"&&<SimpleModule title="💰 Finance" content="Finans takibi — yakında aktif olacak"/>}
        {active==="analiz"&&<SimpleModule title="📊 Intelligence" content="Analiz paneli — yakında aktif olacak"/>}
        {active==="teklif"&&<SimpleModule title="📄 Proposal Center" content="Teklif merkezi — yakında aktif olacak"/>}
        {active==="dokuman"&&<SimpleModule title="📁 Knowledge Base" content="Bilgi bankası — yakında aktif olacak"/>}
      </div>
    </div>
  );
}
