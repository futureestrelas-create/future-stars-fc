(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const STORAGE_KEY = "future-stars-fc-v2-data";
  const emptyData = () => ({players:[],matches:[],evos:[],market:[],seasons:[],trophies:[],gallery:[]});
  let data = emptyData(), supabase = null, session = null, sharedMode = false, localAdmin = false;
  const tables = {players:"fsfc_players",matches:"fsfc_matches",evos:"fsfc_evolutions",market:"fsfc_market",seasons:"fsfc_seasons",trophies:"fsfc_trophies",gallery:"fsfc_gallery"};
  const safe = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const num = v => Number(v || 0);
  const dateToday = () => new Date().toISOString().slice(0,10);
  const fmtDate = v => { if(!v) return "—"; const d=new Date(v+"T12:00:00"); return isNaN(d) ? v : d.toLocaleDateString("pt-BR"); };
  const money = v => num(v).toLocaleString("pt-BR");
  const toast = msg => { const el=$("#toast"); el.textContent=msg; el.classList.remove("hidden"); setTimeout(()=>el.classList.add("hidden"),2800); };
  const loadLocal = () => { try { data={...emptyData(),...JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}")}; } catch { data=emptyData(); } };
  const saveLocal = () => localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
  async function init() {
    loadLocal();
    const cfg=window.FSFC_CONFIG||{};
    if(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase){
      try {
        supabase=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
        const {data:res}=await supabase.auth.getSession(); session=res.session;
        supabase.auth.onAuthStateChange((_event,s)=>{session=s;updateAuthUI();});
        sharedMode=true; $("#connectionStatus").innerHTML="<i></i> Banco compartilhado"; $("#connectionStatus").classList.add("online");
        await refreshShared();
      } catch(e) { console.error(e); sharedMode=false; }
    }
    if(!sharedMode) $("#connectionStatus").innerHTML="<i></i> Modo local";
    renderAll(); bindEvents(); updateAuthUI();
  }
  async function refreshShared(){
    if(!supabase) return;
    const names=Object.keys(tables);
    const results=await Promise.all(names.map(async k=>{
      const {data:rows,error}=await supabase.from(tables[k]).select("*").order("created_at",{ascending:false});
      if(error){console.warn("Falha ao carregar",tables[k],error.message);return [k,[]];}
      return [k,rows||[]];
    }));
    for(const [k,v] of results) data[k]=v;
    renderAll();
  }
  function renderAll(){
    $("#statPlayers").textContent=data.players.filter(p=>p.status!=="Dispensado").length;
    $("#statMatches").textContent=data.matches.length;
    $("#statTrophies").textContent=data.trophies.length + data.seasons.reduce((a,s)=>a+num(s.titles),0);
    $("#statEvos").textContent=data.evos.length;
    renderPlayers(); renderMatches(); renderEvos(); renderMarket(); renderSeasons();
  }
  function renderPlayers(){
    const q=($("#playerSearch")?.value||"").toLowerCase(), team=$("#teamFilter")?.value||"";
    const rows=data.players.filter(p=>(p.status||"Ativo")!=="Dispensado" && (!q||`${p.name} ${p.position} ${p.country}`.toLowerCase().includes(q)) && (!team||p.team===team));
    $("#playersGrid").innerHTML=rows.length?rows.map(p=>{
      const initials=(p.name||"FS").split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
      return `<article class="player-card"><div class="player-card-top"><div class="player-rating">${safe(p.overall||"—")}</div><div class="player-pos">${safe(p.position||"—")}</div><div class="player-avatar">${p.image_url?`<img src="${safe(p.image_url)}" alt="${safe(p.name)}" loading="lazy" onerror="this.remove()">`:safe(initials)}</div></div><div class="player-card-body"><h3>${safe(p.name)}</h3><div class="player-meta">${safe(p.country||"País não informado")} ${p.birth_year?"• Nasc. "+safe(p.birth_year):""}</div><div class="player-badges"><span class="badge red">${safe(p.team||"Academia")}</span><span class="badge">${safe(p.status||"Ativo")}</span>${p.notes?`<span class="badge">${safe(p.notes.slice(0,24))}</span>`:""}</div></div><div class="player-card-foot"><span>FUTURE STARS FC</span><b>${safe(p.position||"—")}</b></div></article>`;
    }).join(""):`<div class="empty-state">Nenhum jogador encontrado. Use a área administrativa para cadastrar o elenco.</div>`;
  }
  function renderMatches(){
    const rows=[...data.matches].sort((a,b)=>(b.match_date||"").localeCompare(a.match_date||"")).slice(0,12);
    $("#matchesTable").innerHTML=rows.length?rows.map(m=>{
      const gf=num(m.goals_for),ga=num(m.goals_against),r=gf>ga?"Vitória":gf===ga?"Empate":"Derrota";
      return `<tr><td>${fmtDate(m.match_date)}</td><td>${safe(m.competition||"Outro")}</td><td>${safe(m.opponent||"—")}</td><td><strong>${gf} – ${ga}</strong></td><td><span class="result ${r}">${r.toUpperCase()}</span></td></tr>`;
    }).join(""):`<tr><td colspan="5" class="empty-cell">Nenhuma partida registrada ainda.</td></tr>`;
  }
  function renderEvos(){
    const rows=[...data.evos].sort((a,b)=>(b.evo_date||"").localeCompare(a.evo_date||"")).slice(0,4);
    $("#evoList").innerHTML=rows.length?rows.map(e=>`<div class="compact-item"><div><strong>${safe(e.player_name)}</strong><small>${safe(e.evolution_name)} • ${fmtDate(e.evo_date)}</small></div><b>${e.old_overall?safe(e.old_overall)+" → ":""}${safe(e.new_overall||"—")} OVR</b></div>`).join(""):`<div class="empty-state">Nenhuma Evolução registrada.</div>`;
  }
  function renderMarket(){
    const ins=data.market.filter(m=>m.movement==="Contratação"), outs=data.market.filter(m=>m.movement==="Saída");
    $("#marketIn").textContent=ins.length; $("#marketOut").textContent=outs.length; $("#marketSpend").textContent=money(ins.reduce((a,m)=>a+num(m.cost),0))+" moedas";
  }
  function renderSeasons(){
    const rows=[...data.seasons].sort((a,b)=>(b.start_date||"").localeCompare(a.start_date||""));
    $("#seasonsGrid").innerHTML=rows.length?rows.map((s,i)=>`<article class="season-card"><div class="season-no">${String(rows.length-i).padStart(2,"0")}</div><h3>${safe(s.name)}</h3><p>${safe(s.summary||"Um novo capítulo na história do clube.")}</p><div class="season-foot"><span>${fmtDate(s.start_date)} — ${fmtDate(s.end_date)}</span><b>${safe(s.status||"Planejada")}</b></div></article>`).join(""):`<div class="empty-state">Nenhuma temporada cadastrada.</div>`;
  }
  function bindEvents(){
    $("#playerSearch").addEventListener("input",renderPlayers); $("#teamFilter").addEventListener("change",renderPlayers);
    $("#adminOpen").onclick=()=>openModal(); $("#adminClose").onclick=closeModal; $("#adminModal").addEventListener("click",e=>{if(e.target.dataset.close)closeModal();});
    $("#localAdminBtn").onclick=()=>{localAdmin=true;$("#adminAuth").classList.add("hidden");$("#adminPanel").classList.remove("hidden");$("#adminModeLabel").innerHTML="<i></i> Gestão local neste navegador";};
    $("#loginBtn").onclick=login; $("#signupBtn").onclick=signup; $("#logoutBtn").onclick=logout;
    $$(".tab").forEach(b=>b.onclick=()=>{$$(".tab").forEach(t=>t.classList.toggle("active",t===b));$$(".admin-form").forEach(f=>f.classList.toggle("active",f.id===b.dataset.tab));});
    Object.keys(tables).forEach(k=>{const form=$("#"+({players:"playerForm",matches:"matchForm",evos:"evoForm",market:"marketForm",seasons:"seasonForm",trophies:"trophyForm",gallery:"galleryForm"}[k]));if(form)form.addEventListener("submit",e=>submitForm(e,k));});
    $("#exportBtn").onclick=exportBackup; $("#importFile").onchange=importBackup; $("#clearLocalBtn").onclick=clearLocal;
    ["matchesAdminLink","marketAdminLink"].forEach(id=>$("#"+id).onclick=e=>{e.preventDefault();openModal();if(localAdmin||session){$("#adminAuth").classList.add("hidden");$("#adminPanel").classList.remove("hidden");}});
  }
  function openModal(){ $("#adminModal").classList.remove("hidden"); document.body.style.overflow="hidden"; updateAuthUI(); }
  function closeModal(){ $("#adminModal").classList.add("hidden"); document.body.style.overflow=""; }
  function updateAuthUI(){
    if(!$("#adminAuth"))return;
    const active=!!session||localAdmin;
    $("#adminAuth").classList.toggle("hidden",active); $("#adminPanel").classList.toggle("hidden",!active);
    if(session) $("#adminModeLabel").innerHTML="<i></i> Banco compartilhado • autenticado";
    else if(localAdmin) $("#adminModeLabel").innerHTML="<i></i> Gestão local neste navegador";
  }
  async function login(){
    if(!supabase){$("#authMessage").textContent="Configure o Supabase em config.js para habilitar login compartilhado. Você pode usar o modo local.";return;}
    const {error}=await supabase.auth.signInWithPassword({email:$("#authEmail").value,password:$("#authPassword").value});
    $("#authMessage").textContent=error?error.message:"Login realizado.";
    if(!error){const {data:r}=await supabase.auth.getSession();session=r.session;updateAuthUI();await refreshShared();}
  }
  async function signup(){
    if(!supabase){$("#authMessage").textContent="Configure o Supabase em config.js antes de criar uma conta.";return;}
    const {error}=await supabase.auth.signUp({email:$("#authEmail").value,password:$("#authPassword").value});
    $("#authMessage").textContent=error?error.message:"Conta solicitada. Confira o e-mail se a confirmação estiver ativada.";
  }
  async function logout(){ if(supabase&&session) await supabase.auth.signOut(); session=null;localAdmin=false;updateAuthUI(); }
  async function submitForm(event,key){
    event.preventDefault();
    if(sharedMode&&!session){toast("Entre com sua conta para salvar no banco compartilhado.");return;}
    if(!sharedMode&&!localAdmin){toast("Abra as ferramentas locais ou configure o Supabase.");return;}
    const form=event.currentTarget, fd=new FormData(form), row=Object.fromEntries(fd.entries());
    for(const k of Object.keys(row)) if(row[k]==="") row[k]=null;
    if(["overall","birth_year","goals_for","goals_against","old_overall","new_overall","cost","titles"].some(k=>k in row)) {
      ["overall","birth_year","goals_for","goals_against","old_overall","new_overall","cost","titles"].forEach(k=>{if(k in row)row[k]=row[k]===null?null:num(row[k]);});
    }
    if(key==="matches"){row.goals_for=num(row.goals_for);row.goals_against=num(row.goals_against);}
    if(sharedMode&&supabase){
      const {error}=await supabase.from(tables[key]).insert(row);
      if(error){$("#adminMessage").textContent="Erro ao salvar: "+error.message;return;}
      await refreshShared();
    } else { data[key].unshift({...row,id:crypto.randomUUID?crypto.randomUUID():String(Date.now())});saveLocal();renderAll(); }
    form.reset(); if(key==="matches")form.elements.match_date.value=dateToday(); toast("Registro salvo com sucesso!");$("#adminMessage").textContent="Último registro salvo com sucesso.";
  }
  function exportBackup(){
    const blob=new Blob([JSON.stringify({version:"2.0",exported_at:new Date().toISOString(),data},null,2)],{type:"application/json"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="future-stars-fc-backup.json";a.click();URL.revokeObjectURL(a.href);toast("Backup exportado.");
  }
  function importBackup(e){
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();reader.onload=async()=>{
      try{const parsed=JSON.parse(reader.result);const incoming=parsed.data||parsed;if(!Object.keys(tables).every(k=>Array.isArray(incoming[k]||[])))throw new Error("Estrutura de backup inválida.");
        if(sharedMode){if(!session)throw new Error("Entre na conta antes de importar.");for(const k of Object.keys(tables)){const rows=incoming[k]||[];if(rows.length){const clean=rows.map(({id,created_at,updated_at,...rest})=>rest);const {error}=await supabase.from(tables[k]).insert(clean);if(error)throw error;}}await refreshShared();}
        else{if(!localAdmin)throw new Error("Abra a gestão local antes de importar.");data={...emptyData(),...incoming};saveLocal();renderAll();}
        toast("Backup importado.");}catch(err){$("#adminMessage").textContent="Não foi possível importar: "+err.message;} e.target.value="";
    };reader.readAsText(file);
  }
  function clearLocal(){if(sharedMode){toast("A limpeza em massa não é permitida nesta interface.");return;}if(confirm("Tem certeza? Isso apagará os dados deste navegador.")){data=emptyData();saveLocal();renderAll();toast("Dados locais removidos.");}}
  init();
})();