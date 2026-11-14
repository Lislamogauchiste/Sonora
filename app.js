(() => {
  const DB_NAME = "sonora-library";
  const STORE = "tracks";
  const $ = id => document.getElementById(id);
  const audio = $("audio");
  let db, tracks = [], playlists = [], currentId = null, visibleTracks = [], repeat = false, shuffle = false, activeView = "home";
  const fmt = n => { if (!Number.isFinite(n)) return "0:00"; const m=Math.floor(n/60),s=Math.floor(n%60); return m+":"+String(s).padStart(2,"0"); };
  const openDB = () => new Promise((resolve,reject) => { const req=indexedDB.open(DB_NAME,1); req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:"id"}); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); });
  const tx = (mode,fn) => new Promise((resolve,reject) => { const t=db.transaction(STORE,mode), store=t.objectStore(STORE); let result; try{result=fn(store)}catch(e){reject(e);return} t.oncomplete=()=>resolve(result?.result); t.onerror=()=>reject(t.error); });
  const getAll = () => new Promise((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const toast = msg => { const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2600); };
  const readPlaylists = () => { try{playlists=JSON.parse(localStorage.getItem("sonora-playlists")||"[]")}catch{playlists=[]} };
  const savePlaylists = () => localStorage.setItem("sonora-playlists",JSON.stringify(playlists));
  const titleFrom = file => file.name.replace(/\.[^.]+$/,"");
  const render = () => {
    const q=$("search").value.trim().toLowerCase();
    visibleTracks=tracks.filter(t=>(t.title+" "+t.artist+" "+t.album).toLowerCase().includes(q));
    $("trackCount").textContent=tracks.length;
    $("playlistCount").textContent=playlists.length;
    const total=tracks.reduce((n,t)=>n+(t.duration||0),0);
    $("totalDuration").textContent=total?fmt(total):"0 min";
    $("emptyState").hidden=tracks.length>0;
    $("trackTableWrap").hidden=tracks.length===0;
    $("trackRows").innerHTML=visibleTracks.map((t,i)=>'<tr><td>'+(i+1)+'</td><td><div class="track-title"><div class="mini-cover">♫</div><div>'+esc(t.title)+'<div class="muted small">'+esc(t.artist||"Artiste inconnu")+'</div></div></div></td><td>'+esc(t.album||"—")+'</td><td>'+new Date(t.added).toLocaleDateString("fr-FR")+'</td><td><button class="row-play" data-play="'+t.id+'" title="Écouter">▶</button> <button class="delete-track" data-delete="'+t.id+'" title="Supprimer">×</button></td></tr>').join("");
    $("playlistNav").innerHTML=playlists.length?playlists.map(p=>'<button class="playlist-link" data-playlist="'+p.id+'">♫ &nbsp; '+esc(p.name)+'</button>').join(""):'<p class="muted small">Aucune playlist pour le moment.</p>';
    $("playlistCount").textContent=playlists.length;
  };
  const esc = s => String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const importFiles = async filesList => {
    const files=Array.from(filesList||[]).filter(f=>f.type.startsWith("audio/")||/\.(mp3|wav|flac|m4a|ogg|aac)$/i.test(f.name));
    if(!files.length){toast("Aucun fichier audio compatible sélectionné.");return}
    let added=0;
    for(const file of files){
      const id=crypto.randomUUID();
      const meta={id,title:titleFrom(file),artist:"",album:"",duration:0,mime:file.type||"audio/mpeg",size:file.size,added:Date.now(),blob:file};
      try{
        const url=URL.createObjectURL(file), probe=new Audio();probe.preload="metadata";probe.src=url;
        await new Promise(resolve=>{probe.onloadedmetadata=()=>{meta.duration=Number.isFinite(probe.duration)?probe.duration:0;URL.revokeObjectURL(url);resolve()};probe.onerror=()=>{URL.revokeObjectURL(url);resolve()};setTimeout(resolve,2500)});
        await tx("readwrite",s=>s.put(meta));added++;
      }catch(e){console.error(e)}
    }
    tracks=await getAll();render();$("fileInput").value="";
    toast(added+" morceau(x) ajouté(s) à ta bibliothèque.");
  };
  const play = async id => {
    const t=tracks.find(x=>x.id===id);if(!t)return;
    if(currentId!==id){currentId=id;audio.src=URL.createObjectURL(t.blob);$("nowTitle").textContent=t.title;$("nowArtist").textContent=t.artist||"Artiste inconnu";$("playerCover").textContent="♫"}
    try{await audio.play();$("playBtn").textContent="Ⅱ"}catch{toast("Lecture impossible pour ce format dans ce navigateur.")}
  };
  const next = direction => { if(!tracks.length)return;let idx=tracks.findIndex(t=>t.id===currentId);if(shuffle)idx=Math.floor(Math.random()*tracks.length);else idx=(idx+direction+tracks.length)%tracks.length;play(tracks[idx].id); };
  const norm = s => String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  const parseCSV = text => {
    const rows=[];let row=[],cell="",quoted=false;
    for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'&&quoted&&text[i+1]==='"'){cell+='"';i++}else if(ch==='"'){quoted=!quoted}else if((ch===','||ch===';'||ch==='\t')&&!quoted){row.push(cell);cell=""}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell=""}else cell+=ch}
    row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
  };
  const pick = (obj, names) => {const key=Object.keys(obj).find(k=>names.includes(norm(k)));return key?obj[key]:""};
  const importPlaylistFile = async file => {
    try {
      const text=await file.text(), ext=file.name.split(".").pop().toLowerCase();let entries=[];
      if(["m3u","m3u8"].includes(ext)||/^#EXTM3U/m.test(text)){
        let pending="";
        entries=text.split(/\r?\n/).flatMap(line=>{if(line.startsWith("#EXTINF:")){pending=line.split(",").slice(1).join(",").trim();return []}if(!line||line.startsWith("#"))return [];const title=pending||line.split("/").pop().replace(/\.[^.]+$/,"");pending="";return [{title,artist:"",album:""}]});
      } else if(ext==="json"||/^\s*[\[{]/.test(text)){
        const data=JSON.parse(text);
        let list=Array.isArray(data)?data:(data.tracks?.items||data.tracks||data.items||data.songs||data.playlist?.tracks||[]);
        if(!Array.isArray(list))list=Object.values(list);
        entries=list.map(x=>{if(typeof x==="string")return {title:x};const t=x.track||x;const artists=Array.isArray(t.artists)?t.artists.map(a=>a.name||a).join(", "):"";return {title:pick(t,["track name","song name","title","name","song","track"])||t.name||"",artist:pick(t,["artist name","artist names","artist","artists","album artist"])||artists,album:pick(t,["album name","album","album title"])||(t.album?.name||"")}}).filter(x=>String(x.title||"").trim());
      } else {
        const rows=parseCSV(text);if(rows.length<2)throw new Error("CSV vide");
        const headers=rows[0].map(norm), ti=headers.findIndex(x=>["track name","song name","title","name","song","track"].includes(x));
        if(ti<0)throw new Error("Colonne titre absente");
        const ai=headers.findIndex(x=>["artist name","artist names","artist","artists","album artist"].includes(x)), bi=headers.findIndex(x=>["album name","album title","album"].includes(x));
        entries=rows.slice(1).map(r=>({title:r[ti]||"",artist:ai>=0?r[ai]||"": "",album:bi>=0?r[bi]||"":""})).filter(x=>x.title.trim());
      }
      if(!entries.length){toast("Aucun morceau reconnu dans ce fichier.");return}
      entries=entries.map(x=>{const title=String(x.title||"").trim(),artist=String(x.artist||"").trim(),album=String(x.album||"").trim();const match=tracks.find(t=>norm(t.title)===norm(title)&&(!artist||!t.artist||norm(t.artist)===norm(artist)))||tracks.find(t=>norm(t.title)===norm(title));return {title,artist,album,localTrackId:match?.id||null}});
      const fallback=file.name.replace(/\.[^.]+$/,"").replace(/[_-]+/g," ").trim();
      const name=prompt("Nom de cette playlist :",fallback)||fallback;
      playlists.push({id:crypto.randomUUID(),name:name.trim()||fallback,trackIds:entries.filter(x=>x.localTrackId).map(x=>x.localTrackId),entries,importedFrom:"fichier"});
      savePlaylists();render();
      const matched=entries.filter(x=>x.localTrackId).length;
      toast("Playlist importée : "+entries.length+" titres, "+matched+" déjà disponibles localement.");
    } catch(e) {console.error(e);toast("Import impossible : utilise un export CSV, JSON ou M3U.");}
    $("playlistFileInput").value="";
  };
  const createPlaylist = () => {const name=prompt("Nom de ta nouvelle playlist :");if(!name?.trim())return;playlists.push({id:crypto.randomUUID(),name:name.trim(),trackIds:[]});savePlaylists();render();toast("Playlist créée.");};
  $("heroImport").onclick=$("emptyImport").onclick=$("importBtn").onclick=()=>$("fileInput").click();
  $("fileInput").onchange=e=>importFiles(e.target.files);
  $("newPlaylist").onclick=createPlaylist;
  $("playlistImportBtn").onclick=()=>$("playlistFileInput").click();
  $("playlistFileInput").onchange=e=>{if(e.target.files[0])importPlaylistFile(e.target.files[0])};
  $("search").oninput=render;
  $("trackRows").onclick=async e=>{const p=e.target.closest("[data-play]"),d=e.target.closest("[data-delete]");if(p)play(p.dataset.play);if(d){const t=tracks.find(x=>x.id===d.dataset.delete);if(!t)return;if(!confirm("Supprimer « "+t.title+" » de ta bibliothèque ?"))return;await tx("readwrite",s=>s.delete(t.id));if(currentId===t.id){audio.pause();audio.removeAttribute("src");currentId=null;$("nowTitle").textContent="Aucun morceau sélectionné";$("nowArtist").textContent="Importe ta musique pour commencer"}tracks=await getAll();render();toast("Morceau supprimé.");}};
  $("playBtn").onclick=()=>{if(!currentId){if(tracks[0])play(tracks[0].id);return}if(audio.paused)audio.play();else audio.pause()};
  audio.onplay=()=>$("playBtn").textContent="Ⅱ";audio.onpause=()=>$("playBtn").textContent="▶";
  $("prevBtn").onclick=()=>next(-1);$("nextBtn").onclick=()=>next(1);audio.onended=()=>{if(repeat){audio.currentTime=0;audio.play()}else next(1)};
  $("shuffleBtn").onclick=()=>{shuffle=!shuffle;$("shuffleBtn").classList.toggle("selected",shuffle);toast(shuffle?"Lecture aléatoire activée":"Lecture aléatoire désactivée")};
  $("repeatBtn").onclick=()=>{repeat=!repeat;$("repeatBtn").classList.toggle("selected",repeat);toast(repeat?"Répétition activée":"Répétition désactivée")};
  audio.ontimeupdate=()=>{$("progress").value=audio.duration?audio.currentTime/audio.duration*100:0;$("currentTime").textContent=fmt(audio.currentTime);$("duration").textContent=fmt(audio.duration)};
  $("progress").oninput=e=>{if(audio.duration)audio.currentTime=Number(e.target.value)/100*audio.duration};
  $("volume").oninput=e=>audio.volume=Number(e.target.value);audio.volume=.8;
  document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeView=b.dataset.view;$("crumb").textContent=b.textContent.trim().toUpperCase();$("viewTitle").textContent=activeView==="library"?"Tous les morceaux":activeView==="playlists"?"Tes playlists":"Écoutés récemment";});
  document.querySelectorAll(".quick-card[data-view]").forEach(b=>b.onclick=()=>document.querySelector('.nav-item[data-view="'+b.dataset.view+'"]').click());
  $("playlistNav").onclick=e=>{const b=e.target.closest("[data-playlist]");if(!b)return;const p=playlists.find(x=>x.id===b.dataset.playlist);if(!p)return;const entry=(p.entries||[]).find(x=>x.localTrackId&&tracks.some(t=>t.id===x.localTrackId));const item=entry?tracks.find(t=>t.id===entry.localTrackId):tracks.find(t=>p.trackIds.includes(t.id));if(item)play(item.id);else if((p.entries||[]).length)toast("Playlist importée : ajoute les fichiers audio correspondants pour les écouter.");else toast("Cette playlist est encore vide.")};
  (async()=>{try{db=await openDB();tracks=await getAll();readPlaylists();render()}catch(e){console.error(e);toast("Le stockage local n'est pas disponible dans ce navigateur.")}})();
})();