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

  // Recherche dans les catalogues publics Apple/iTunes et Deezer.
  const catalogResults = $("catalogResults");
  const searchCatalogs = async () => {
    const query = $("catalogSearch").value.trim();
    const source = $("catalogSource").value;
    if (query.length < 2) { catalogResults.innerHTML = '<p class="muted small">Saisis au moins deux caractères pour lancer une recherche.</p>'; return; }
    catalogResults.innerHTML = '<p class="muted small">Recherche en cours…</p>';
    const jobs = [];
    if (source === "all" || source === "apple") {
      const url = "https://itunes.apple.com/search?term=" + encodeURIComponent(query) + "&country=fr&entity=song&limit=8";
      jobs.push(fetch(url).then(r => { if(!r.ok) throw new Error("Apple indisponible"); return r.json(); }).then(data => (data.results||[]).map(t => ({
        source:"Apple / iTunes", title:t.trackName, artist:t.artistName, album:t.collectionName||"", art:t.artworkUrl100||"", url:t.trackViewUrl||t.collectionViewUrl||"https://music.apple.com/fr/search?term="+encodeURIComponent(query), preview:""
      }))));
    }
    if (source === "all" || source === "deezer") {
      const url = "https://proxy.cors.dev/https://api.deezer.com/search?q=" + encodeURIComponent(query) + "&limit=8";
      jobs.push(fetch(url).then(r => { if(!r.ok) throw new Error("Deezer indisponible"); return r.json(); }).then(data => {
        if(data.error) throw new Error(data.error.message||"Erreur Deezer");
        return (data.data||[]).map(t => ({source:"Deezer",title:t.title,artist:t.artist?.name||"",album:t.album?.title||"",art:t.album?.cover_medium||"",url:t.link||"https://www.deezer.com/search/"+encodeURIComponent(query),preview:t.preview||""}));
      }));
    }
    const settled = await Promise.allSettled(jobs);
    const results = settled.flatMap(x => x.status==="fulfilled" ? x.value : []);
    const errors = settled.filter(x=>x.status==="rejected");
    if (!results.length) {
      catalogResults.innerHTML = '<p class="muted small">Aucun résultat disponible. Vérifie ta connexion ou réessaie plus tard.'+(errors.length?' Un catalogue n’a pas répondu.':'')+'</p>';
      return;
    }
    catalogResults.innerHTML = results.map((t,i) => '<article class="catalog-result"><img src="'+esc(t.art||"")+'" alt="" onerror="this.style.visibility=\'hidden\'"><div class="catalog-result-info"><strong>'+esc(t.title)+'</strong><span>'+esc(t.artist)+' · '+esc(t.album||"Album non renseigné")+' · '+esc(t.source)+'</span></div><div class="catalog-result-actions">'+(t.preview?'<button data-preview="'+i+'">▶ Aperçu</button>':'')+'<button data-save-online="'+i+'">＋ Playlist SONORA</button><a href="'+esc(t.url)+'" target="_blank" rel="noopener">Ouvrir</a></div></article>').join("");
    catalogResults._items = results;
    if(errors.length) toast("Certains catalogues n’ont pas répondu ; résultats partiels affichés.");
  };
  $("catalogSearchBtn").onclick = searchCatalogs;
  $("catalogSearch").addEventListener("keydown",e=>{if(e.key==="Enter")searchCatalogs()});
  $("catalogSource").onchange = ()=>{if($("catalogSearch").value.trim().length>=2)searchCatalogs()};
  let catalogTimer;
  $("catalogSearch").addEventListener("input",()=>{clearTimeout(catalogTimer);catalogTimer=setTimeout(searchCatalogs,650)});
  catalogResults.onclick = e => {
    const preview=e.target.closest("[data-preview]"), save=e.target.closest("[data-save-online]");
    const items=catalogResults._items||[];
    if(preview){const t=items[Number(preview.dataset.preview)];if(t?.preview){audio.src=t.preview;currentId=null;$("nowTitle").textContent=t.title;$("nowArtist").textContent=t.artist+" · aperçu Deezer";audio.play().catch(()=>toast("Aperçu indisponible."));}}
    if(save){
      const t=items[Number(save.dataset.saveOnline)];if(!t)return;
      let p=playlists.find(x=>x.name==="Titres repérés en ligne");
      if(!p){p={id:crypto.randomUUID(),name:"Titres repérés en ligne",trackIds:[],entries:[],importedFrom:"catalogues"};playlists.push(p);}
      p.entries=p.entries||[];
      if(!p.entries.some(x=>norm(x.title)===norm(t.title)&&norm(x.artist)===norm(t.artist))){
        p.entries.push({title:t.title,artist:t.artist,album:t.album,source:t.source,url:t.url,preview:t.preview||"",localTrackId:null});
        savePlaylists();render();toast("Référence ajoutée à « Titres repérés en ligne ».");
      } else toast("Ce titre est déjà dans la playlist.");
    }
  };
  $("importUrlBtn").onclick = async () => {
    const value=$("playlistUrl").value.trim();
    const match=value.match(/deezer\.com\/(?:[a-z]{2}\/)?playlist\/(\d+)/i);
    if(!match){toast("Pour Spotify ou Apple Music, importe un export CSV, JSON ou M3U. Le lien direct pris en charge ici est Deezer.");return;}
    const btn=$("importUrlBtn");btn.disabled=true;btn.textContent="Import…";
    try{
      const response=await fetch("https://proxy.cors.dev/https://api.deezer.com/playlist/"+match[1]);
      if(!response.ok)throw new Error("Réponse réseau invalide");
      const data=await response.json();if(data.error)throw new Error(data.error.message||"Playlist inaccessible");
      const entries=(data.tracks?.data||[]).map(t=>({title:t.title,artist:t.artist?.name||"",album:t.album?.title||"",source:"Deezer",url:t.link||"",preview:t.preview||"",localTrackId:null})).filter(t=>t.title);
      if(!entries.length)throw new Error("Aucun titre public trouvé");
      const name=(data.title||"Playlist Deezer").trim();
      playlists.push({id:crypto.randomUUID(),name,trackIds:[],entries,importedFrom:"Deezer"});
      savePlaylists();render();$("playlistUrl").value="";
      toast("Playlist Deezer importée : "+entries.length+" titres (métadonnées uniquement).");
    }catch(err){console.error(err);toast("Import Deezer impossible : playlist privée, lien invalide ou service temporairement indisponible.");}
    finally{btn.disabled=false;btn.textContent="Importer le lien";}
  };

})();