/* =============================================================================
 * voidEXT bookmarklet (readable source)
 * -----------------------------------------------------------------------------
 * Injects a clean glass popup on any page with:
 *   - Log in / Sign up (talks to the voidEXT site)
 *   - A dashboard that generates a rotating batch of links from the server
 *   - A "blocked" button on each link (pulls it from server rotation)
 *   - A Settings panel (theme, open-in-new-tab, confirm-before-report, batch
 *     size) that saves to your account on the server
 *
 * ALL UI renders inside the popup. There are NO alert()/confirm()/prompt()
 * calls, so you never get the "<site> says..." browser dialog.
 *
 * Build the one-line bookmark with:  node build-bookmarklet.js
 * ============================================================================= */
(function () {
  // <<< CONFIG >>> Point this at your deployed Vercel site (no trailing slash).
  const API_BASE = 'https://void-ext.vercel.app';

  const OVERLAY_ID = 'voidext-overlay';
  const WRAPPER_ID = 'voidext-wrapper';

  const existingOverlay = document.getElementById(OVERLAY_ID);
  if (existingOverlay) {
    closeExisting(existingOverlay);
    return;
  }

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>voidEXT</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:'Inter',system-ui,sans-serif;}
:root{--radius:16px;}
body[data-theme="ocean"]{--bg:linear-gradient(160deg,#7dd3fc 0%,#0ea5e9 100%);--accent:#0284c7;--card:rgba(255,255,255,0.74);--text:#0f172a;--muted:#475569;--field:rgba(255,255,255,0.6);--border:rgba(15,23,42,0.08);--rowbg:rgba(255,255,255,0.55);}
body[data-theme="midnight"]{--bg:linear-gradient(160deg,#334155 0%,#0f172a 100%);--accent:#6366f1;--card:rgba(30,41,59,0.78);--text:#e2e8f0;--muted:#94a3b8;--field:rgba(255,255,255,0.08);--border:rgba(255,255,255,0.12);--rowbg:rgba(255,255,255,0.06);}
body[data-theme="sand"]{--bg:linear-gradient(160deg,#fcd34d 0%,#fb923c 100%);--accent:#ea580c;--card:rgba(255,255,255,0.8);--text:#431407;--muted:#7c2d12;--field:rgba(255,255,255,0.6);--border:rgba(67,20,7,0.1);--rowbg:rgba(255,255,255,0.55);}
body{min-height:100vh;display:flex;justify-content:center;align-items:center;background:var(--bg);padding:18px;transition:background .4s ease;}
.app{width:100%;max-width:340px;background:var(--card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:22px;box-shadow:0 20px 50px rgba(0,0,0,0.18);padding:22px;color:var(--text);max-height:90vh;display:flex;flex-direction:column;}
header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
.brand{display:flex;align-items:center;gap:9px;font-weight:700;font-size:17px;letter-spacing:-0.3px;}
.brand .dot{width:22px;height:22px;border-radius:7px;background:var(--accent);display:inline-block;box-shadow:0 4px 10px rgba(0,0,0,0.15);}
.gear{width:34px;height:34px;border-radius:10px;border:1px solid var(--border);background:var(--field);color:var(--text);font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s;}
.gear:hover{transform:rotate(40deg);}
.gear.hidden{display:none;}
main{overflow-y:auto;}
.seg{display:flex;background:var(--field);border:1px solid var(--border);border-radius:11px;padding:4px;margin-bottom:16px;}
.seg button{flex:1;border:none;background:transparent;color:var(--muted);font-weight:600;font-size:13.5px;padding:9px;border-radius:8px;cursor:pointer;transition:.2s;}
.seg button.on{background:var(--accent);color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.12);}
input{width:100%;padding:13px 14px;background:var(--field);border:1px solid var(--border);border-radius:11px;outline:none;color:var(--text);font-size:14.5px;margin-bottom:11px;transition:.2s;}
input::placeholder{color:var(--muted);}
input:focus{border-color:var(--accent);}
.primary{width:100%;padding:13px;border:none;border-radius:11px;background:var(--accent);color:#fff;font-weight:600;font-size:14.5px;cursor:pointer;transition:.2s;box-shadow:0 8px 18px rgba(0,0,0,0.14);}
.primary:hover{filter:brightness(1.06);transform:translateY(-1px);}
.primary:active{transform:translateY(0);}
.primary[disabled]{opacity:.55;cursor:not-allowed;transform:none;}
.ghost{width:100%;padding:11px;border:1px solid var(--border);border-radius:11px;background:transparent;color:var(--muted);font-weight:600;font-size:13.5px;cursor:pointer;margin-top:9px;transition:.2s;}
.ghost:hover{background:var(--field);color:var(--text);}
.hello{font-size:15px;margin-bottom:14px;}
.hello b{font-weight:700;}
.meta{color:var(--muted);font-size:12px;margin:11px 2px;}
.links{display:flex;flex-direction:column;gap:8px;max-height:42vh;overflow-y:auto;}
.links .row{display:flex;align-items:center;gap:8px;background:var(--rowbg);border:1px solid var(--border);border-radius:10px;padding:9px 11px;}
.links a{flex:1;color:var(--text);font-size:12px;text-decoration:none;word-break:break-all;opacity:.92;}
.links a:hover{text-decoration:underline;opacity:1;}
.blk{flex:none;background:transparent;border:1px solid var(--border);color:var(--muted);font-size:11px;border-radius:7px;padding:5px 9px;cursor:pointer;white-space:nowrap;transition:.2s;}
.blk:hover{border-color:#ef4444;color:#ef4444;}
.blk.confirm{border-color:#ef4444;color:#fff;background:#ef4444;}
.sec-title{font-weight:700;font-size:15px;margin-bottom:16px;}
.flabel{font-size:12px;color:var(--muted);font-weight:600;margin-bottom:8px;display:block;}
.themes{display:flex;gap:10px;margin-bottom:18px;}
.swatch{flex:1;height:42px;border-radius:11px;border:2px solid transparent;cursor:pointer;transition:.2s;position:relative;}
.swatch.sel{border-color:var(--text);}
.swatch.ocean{background:linear-gradient(160deg,#7dd3fc,#0ea5e9);}
.swatch.midnight{background:linear-gradient(160deg,#334155,#0f172a);}
.swatch.sand{background:linear-gradient(160deg,#fcd34d,#fb923c);}
.trow{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-top:1px solid var(--border);font-size:13.5px;}
.switch{width:42px;height:24px;border-radius:12px;border:none;background:var(--field);position:relative;cursor:pointer;transition:.2s;border:1px solid var(--border);}
.switch::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3);}
.switch.on{background:var(--accent);}
.switch.on::after{transform:translateX(18px);}
.stepper{display:flex;align-items:center;gap:4px;}
.stepper button{width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:var(--field);color:var(--text);font-size:16px;cursor:pointer;line-height:1;}
.stepper span{min-width:26px;text-align:center;font-weight:600;font-size:14px;}
.msg{margin-top:13px;font-size:12.5px;text-align:center;border-radius:9px;padding:0;color:var(--text);transition:.2s;}
.msg.show{padding:9px 11px;}
.msg.err{background:rgba(239,68,68,0.16);border:1px solid rgba(239,68,68,0.35);}
.msg.ok{background:rgba(34,197,94,0.16);border:1px solid rgba(34,197,94,0.35);}
.hidden{display:none!important;}
footer{margin-top:14px;}
footer.hidden{display:none;}
::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-thumb{background:var(--border);border-radius:10px;}
</style>
</head>
<body data-theme="ocean">
<div class="app">
  <header>
    <div class="brand"><span class="dot"></span>voidEXT</div>
    <button class="gear hidden" id="gearBtn" title="Settings">&#9881;</button>
  </header>

  <main>
    <!-- AUTH -->
    <section id="authView">
      <div class="seg">
        <button id="tabLogin" class="on">Log in</button>
        <button id="tabSignup">Sign up</button>
      </div>
      <form id="authForm" autocomplete="off">
        <input id="username" type="text" placeholder="Username" autocomplete="off" required>
        <input id="password" type="password" placeholder="Password" autocomplete="off" required>
        <button type="submit" class="primary" id="authBtn">Log in</button>
      </form>
    </section>

    <!-- DASHBOARD -->
    <section id="dashView" class="hidden">
      <div class="hello">Hi, <b id="who"></b></div>
      <button class="primary" id="genBtn">Generate links</button>
      <div class="meta" id="poolMeta"></div>
      <div class="links" id="linkList"></div>
    </section>

    <!-- SETTINGS -->
    <section id="setView" class="hidden">
      <div class="sec-title">Settings</div>
      <span class="flabel">Theme</span>
      <div class="themes">
        <button class="swatch ocean" data-theme-pick="ocean"></button>
        <button class="swatch midnight" data-theme-pick="midnight"></button>
        <button class="swatch sand" data-theme-pick="sand"></button>
      </div>
      <div class="trow"><span>Open links in new tab</span><button class="switch" id="setNewTab"></button></div>
      <div class="trow"><span>Confirm before reporting</span><button class="switch" id="setConfirm"></button></div>
      <div class="trow"><span>Links per generate</span>
        <div class="stepper"><button id="batchMinus">&minus;</button><span id="batchVal">10</span><button id="batchPlus">+</button></div>
      </div>
      <button class="primary" id="saveBtn" style="margin-top:16px;">Save settings</button>
      <button class="ghost" id="backBtn">Back</button>
    </section>
  </main>

  <footer id="footer" class="hidden">
    <button class="ghost" id="logoutBtn">Log out</button>
  </footer>

  <div class="msg" id="msg"></div>
</div>

<script>
(function(){
  var API='${API_BASE}', TOKEN_KEY='voidext_token';
  var DEFAULTS={theme:'ocean',openInNewTab:true,batchSize:10,confirmReport:false};
  var state={mode:'login',settings:Object.assign({},DEFAULTS),draft:null};

  var $=function(id){return document.getElementById(id);};
  function token(){try{return localStorage.getItem(TOKEN_KEY)||'';}catch(e){return'';}}
  function setToken(t){try{t?localStorage.setItem(TOKEN_KEY,t):localStorage.removeItem(TOKEN_KEY);}catch(e){}}
  function msg(t,k){var m=$('msg');m.className='msg show '+(k||'');m.textContent=t;}
  function clearMsg(){var m=$('msg');m.className='msg';m.textContent='';}

  function api(path,opts){
    opts=opts||{};
    var h={'Content-Type':'application/json'};
    if(token())h['Authorization']='Bearer '+token();
    return fetch(API+path,{method:opts.method||'GET',headers:h,body:opts.body?JSON.stringify(opts.body):undefined})
      .then(function(r){return r.json().catch(function(){return{};}).then(function(j){return{ok:r.ok,status:r.status,data:j};});});
  }

  function applyTheme(t){ document.body.setAttribute('data-theme', t||'ocean'); }
  function applySettings(s){ state.settings=Object.assign({},DEFAULTS,s||{}); applyTheme(state.settings.theme); }

  // ---- views ----
  function show(view){
    $('authView').classList.toggle('hidden',view!=='auth');
    $('dashView').classList.toggle('hidden',view!=='dash');
    $('setView').classList.toggle('hidden',view!=='set');
    $('footer').classList.toggle('hidden',view==='auth');
    $('gearBtn').classList.toggle('hidden',view==='auth');
  }
  function showDash(username){ if(username)$('who').textContent=username; show('dash'); }

  // ---- tabs ----
  function setMode(m){
    state.mode=m;
    $('tabLogin').classList.toggle('on',m==='login');
    $('tabSignup').classList.toggle('on',m==='signup');
    $('authBtn').textContent=m==='login'?'Log in':'Create account';
    clearMsg();
  }
  $('tabLogin').onclick=function(){setMode('login');};
  $('tabSignup').onclick=function(){setMode('signup');};

  // ---- auth submit ----
  $('authForm').onsubmit=function(e){
    e.preventDefault();
    var u=$('username').value.trim(), p=$('password').value;
    if(!u||!p){msg('Enter a username and password.','err');return;}
    var b=$('authBtn');b.disabled=true;
    msg(state.mode==='login'?'Signing in...':'Creating account...','');
    api('/api/'+(state.mode==='login'?'login':'signup'),{method:'POST',body:{username:u,password:p}})
      .then(function(res){
        b.disabled=false;
        if(!res.ok){msg(res.data.error||'Something went wrong.','err');return;}
        setToken(res.data.token); applySettings(res.data.settings); clearMsg(); showDash(res.data.username);
      })
      .catch(function(){b.disabled=false;msg('Network error — is the server reachable?','err');});
  };

  // ---- generate ----
  $('genBtn').onclick=function(){
    var b=$('genBtn');b.disabled=true;msg('Pulling fresh links...','');
    api('/api/links').then(function(res){
      b.disabled=false;
      if(res.status===401){setToken('');show('auth');setMode('login');msg('Session expired — log in again.','err');return;}
      if(!res.ok){msg(res.data.error||'Could not get links.','err');return;}
      renderLinks(res.data.links||[]);
      var meta='Pool: '+(res.data.poolSize||0)+' live links';
      meta+=res.data.rateLimit?(' · '+res.data.remaining+'/'+res.data.limit+' left today'):' · unlimited (testing)';
      $('poolMeta').textContent=meta; clearMsg();
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };

  function renderLinks(links){
    var L=$('linkList');L.innerHTML='';
    if(!links.length){msg('No links available right now.','err');return;}
    links.forEach(function(url){
      var row=document.createElement('div');row.className='row';
      var a=document.createElement('a');a.href=url;a.target=state.settings.openInNewTab?'_blank':'_top';a.rel='noopener noreferrer';a.textContent=url;
      var blk=document.createElement('button');blk.className='blk';blk.type='button';blk.textContent='blocked';
      var armed=false,timer=null;
      blk.onclick=function(){
        if(state.settings.confirmReport && !armed){
          armed=true;blk.classList.add('confirm');blk.textContent='Sure?';
          timer=setTimeout(function(){armed=false;blk.classList.remove('confirm');blk.textContent='blocked';},2500);
          return;
        }
        clearTimeout(timer);blk.disabled=true;blk.textContent='...';
        api('/api/report',{method:'POST',body:{url:url}}).then(function(res){
          if(res.ok){row.parentNode&&row.parentNode.removeChild(row);msg('Reported & removed. Pool: '+res.data.poolSize,'ok');}
          else{blk.disabled=false;blk.classList.remove('confirm');blk.textContent='blocked';msg(res.data.error||'Could not report.','err');}
        }).catch(function(){blk.disabled=false;blk.textContent='blocked';msg('Network error.','err');});
      };
      row.appendChild(a);row.appendChild(blk);L.appendChild(row);
    });
  }

  // ---- settings ----
  $('gearBtn').onclick=function(){ openSettings(); };
  $('backBtn').onclick=function(){ clearMsg(); showDash(); };

  function openSettings(){
    state.draft=Object.assign({},state.settings);
    paintSettings(); clearMsg(); show('set');
  }
  function paintSettings(){
    var d=state.draft;
    document.querySelectorAll('[data-theme-pick]').forEach(function(el){
      el.classList.toggle('sel',el.getAttribute('data-theme-pick')===d.theme);
    });
    $('setNewTab').classList.toggle('on',d.openInNewTab);
    $('setConfirm').classList.toggle('on',d.confirmReport);
    $('batchVal').textContent=d.batchSize;
  }
  document.querySelectorAll('[data-theme-pick]').forEach(function(el){
    el.onclick=function(){ state.draft.theme=el.getAttribute('data-theme-pick'); applyTheme(state.draft.theme); paintSettings(); };
  });
  $('setNewTab').onclick=function(){ state.draft.openInNewTab=!state.draft.openInNewTab; paintSettings(); };
  $('setConfirm').onclick=function(){ state.draft.confirmReport=!state.draft.confirmReport; paintSettings(); };
  $('batchMinus').onclick=function(){ state.draft.batchSize=Math.max(1,state.draft.batchSize-1); paintSettings(); };
  $('batchPlus').onclick=function(){ state.draft.batchSize=Math.min(20,state.draft.batchSize+1); paintSettings(); };

  $('saveBtn').onclick=function(){
    var b=$('saveBtn');b.disabled=true;msg('Saving...','');
    api('/api/settings',{method:'POST',body:{settings:state.draft}}).then(function(res){
      b.disabled=false;
      if(!res.ok){msg(res.data.error||'Could not save.','err');return;}
      applySettings(res.data.settings); msg('Settings saved.','ok'); showDash();
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };

  // ---- logout ----
  $('logoutBtn').onclick=function(){
    api('/api/logout',{method:'POST'});
    setToken('');applySettings(DEFAULTS);show('auth');setMode('login');msg('Logged out.','ok');
  };

  // ---- boot ----
  (function init(){
    setMode('login'); applyTheme('ocean');
    if(token()){
      api('/api/me').then(function(res){
        if(res.ok){applySettings(res.data.settings);showDash(res.data.username);}
        else{setToken('');show('auth');}
      }).catch(function(){show('auth');});
    } else { show('auth'); }
  })();
})();
</script>
</body>
</html>`;

  // --------------------------------------------------------------------------
  // Overlay + iframe shell (host-page side)
  // --------------------------------------------------------------------------
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.5);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:99999999;opacity:0;transition:opacity .25s ease;display:flex;justify-content:center;align-items:center;';

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  wrapper.style.cssText =
    'position:relative;width:392px;height:600px;max-width:94vw;max-height:94vh;background:transparent;border-radius:22px;overflow:hidden;transform:scale(0.95);transition:transform .25s cubic-bezier(0.34,1.4,0.64,1);';

  const closeBtn = document.createElement('div');
  closeBtn.innerHTML = '&#x2715;';
  closeBtn.style.cssText =
    'position:absolute;top:16px;right:16px;width:30px;height:30px;border-radius:8px;background:rgba(0,0,0,0.18);color:#fff;font-family:sans-serif;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s;z-index:100000000;user-select:none;';
  closeBtn.addEventListener('mouseenter', function () { closeBtn.style.background = 'rgba(239,68,68,0.85)'; });
  closeBtn.addEventListener('mouseleave', function () { closeBtn.style.background = 'rgba(0,0,0,0.18)'; });

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:transparent;';

  wrapper.appendChild(closeBtn);
  wrapper.appendChild(iframe);
  overlay.appendChild(wrapper);
  document.body.appendChild(overlay);

  requestAnimationFrame(function () {
    overlay.style.opacity = '1';
    wrapper.style.transform = 'scale(1)';
  });

  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(htmlContent);
  doc.close();

  function closePopup(el) {
    const targetOverlay = el || overlay;
    const targetWrapper = targetOverlay.querySelector('#' + WRAPPER_ID);
    if (targetWrapper) targetWrapper.style.transform = 'scale(0.95)';
    targetOverlay.style.opacity = '0';
    setTimeout(function () {
      if (targetOverlay.parentNode) targetOverlay.parentNode.removeChild(targetOverlay);
    }, 250);
  }
  function closeExisting(el) { closePopup(el); }

  closeBtn.addEventListener('click', function () { closePopup(); });
  overlay.addEventListener('click', function (e) { if (e.target === overlay) closePopup(); });
  const handleEscape = function (e) {
    if (e.key === 'Escape') { closePopup(); window.removeEventListener('keydown', handleEscape); }
  };
  window.addEventListener('keydown', handleEscape);
  iframe.addEventListener('load', function () {
    try {
      iframe.contentWindow.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePopup(); });
    } catch (err) {}
  });
})();
