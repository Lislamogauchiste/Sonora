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
  const createPlaylist = () => {const name=prompt("Nom de ta nouvelle playlist :");if(!name?.trim())return;playlists.push({id:crypto.randomUUID(),name:name.trim(),trackIds:[]});savePlaylists();render();toast("Playlist créée.");};
  $("heroImport").onclick=$("emptyImport").onclick=$("importBtn").onclick=()=>$("fileInput").click();
  $("fileInput").onchange=e=>importFiles(e.target.files);
  $("newPlaylist").onclick=createPlaylist;
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
  $("playlistNav").onclick=e=>{const b=e.target.closest("[data-playlist]");if(!b)return;const p=playlists.find(x=>x.id===b.dataset.playlist);if(!p)return;const item=tracks.find(t=>p.trackIds.includes(t.id));if(item)play(item.id);else toast("Cette playlist est encore vide.")};
  (async()=>{try{db=await openDB();tracks=await getAll();readPlaylists();render()}catch(e){console.error(e);toast("Le stockage local n'est pas disponible dans ce navigateur.")}})();
})();