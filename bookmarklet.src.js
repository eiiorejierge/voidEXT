/* =============================================================================
 * voidEXT bookmarklet (readable source)
 * -----------------------------------------------------------------------------
 * Beach-themed glass popup (animated sun, drifting clouds, parallax waves) that
 * actually works end to end:
 *   - Log in / Sign up against the voidEXT site
 *   - Dashboard that generates a rotating batch of links from the server
 *   - A "blocked" button on each link (pulls it from server rotation)
 *   - A Settings panel (theme, open-in-new-tab, confirm-before-report, batch
 *     size) saved to your account on the server
 *
 * ALL UI renders inside the popup. There are NO alert()/confirm()/prompt()
 * calls, so you never get the "<site> says..." browser dialog.
 *
 * Build the one-line bookmark with:  node build-bookmarklet.js
 * ============================================================================= */
(function () {
  // <<< CONFIG >>> Point this at your deployed Vercel site (no trailing slash).
  const API_BASE = 'https://void-ext.vercel.app';

  const OVERLAY_ID = 'beach-login-overlay';
  const WRAPPER_ID = 'beach-login-wrapper';

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
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--primary:#0077b6;--accent:#fb8500;--accent-hover:#ffb703;--bg-sky-top:#ffb5a7;--bg-sky-mid:#ffcad4;--bg-ocean-top:#90e0ef;--bg-ocean-bot:#0077b6;--glass:rgba(255,255,255,0.15);--glass-border:rgba(255,255,255,0.25);}
body[data-theme="sunset"]{--bg-sky-top:#ffb5a7;--bg-sky-mid:#ffcad4;--bg-ocean-top:#90e0ef;--bg-ocean-bot:#0077b6;}
body[data-theme="day"]{--bg-sky-top:#90e0ef;--bg-sky-mid:#caf0f8;--bg-ocean-top:#48cae4;--bg-ocean-bot:#0077b6;}
body[data-theme="night"]{--bg-sky-top:#2b2d42;--bg-sky-mid:#3a3d5c;--bg-ocean-top:#1b3a4b;--bg-ocean-bot:#0d1b2a;}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Outfit',sans-serif;}
body{min-height:100vh;display:flex;justify-content:center;align-items:center;background:linear-gradient(135deg,var(--bg-sky-top) 0%,var(--bg-sky-mid) 35%,var(--bg-ocean-top) 70%,var(--bg-ocean-bot) 100%);overflow:hidden;position:relative;transition:background .6s ease;}
.sun{position:absolute;top:40px;right:50px;width:70px;height:70px;background:radial-gradient(circle,#fff7ed 20%,#fdba74 70%,#fb8500 100%);border-radius:50%;box-shadow:0 0 30px #fdba74,0 0 60px #fb8500,0 0 100px rgba(251,133,0,0.4);animation:floatSun 8s ease-in-out infinite alternate;z-index:1;}
body[data-theme="night"] .sun{background:radial-gradient(circle,#f8fafc 30%,#cbd5e1 70%,#94a3b8 100%);box-shadow:0 0 30px #cbd5e1,0 0 60px #94a3b8;}
@keyframes floatSun{0%{transform:translateY(0) scale(1);}100%{transform:translateY(-15px) scale(1.03);}}
.cloud{position:absolute;background:rgba(255,255,255,0.35);border-radius:100px;z-index:1;animation:floatCloud 25s linear infinite;}
.cloud::before,.cloud::after{content:'';position:absolute;background:rgba(255,255,255,0.35);border-radius:50%;}
.cloud-1{width:120px;height:40px;top:10%;left:-150px;animation-duration:35s;}
.cloud-1::before{width:50px;height:50px;top:-20px;left:15px;}
.cloud-1::after{width:70px;height:70px;top:-35px;right:15px;}
.cloud-2{width:80px;height:28px;top:25%;left:-100px;animation-duration:25s;animation-delay:8s;opacity:0.8;}
.cloud-2::before{width:35px;height:35px;top:-15px;left:10px;}
.cloud-2::after{width:45px;height:45px;top:-22px;right:10px;}
@keyframes floatCloud{0%{transform:translateX(-10vw);}100%{transform:translateX(110vw);}}
.waves{position:absolute;bottom:0;left:0;width:100%;height:100px;min-height:80px;max-height:150px;z-index:2;}
.parallax>use{animation:move-forever 25s cubic-bezier(.55,.5,.45,.5) infinite;}
.parallax>use:nth-child(1){animation-delay:-2s;animation-duration:7s;}
.parallax>use:nth-child(2){animation-delay:-3s;animation-duration:10s;}
.parallax>use:nth-child(3){animation-delay:-4s;animation-duration:13s;}
.parallax>use:nth-child(4){animation-delay:-5s;animation-duration:20s;}
@keyframes move-forever{0%{transform:translate3d(-90px,0,0);}100%{transform:translate3d(85px,0,0);}}
.wave1{fill:rgba(144,224,239,0.3);}.wave2{fill:rgba(72,202,228,0.5);}.wave3{fill:rgba(0,150,199,0.4);}.wave4{fill:#f5ebe0;}
body[data-theme="night"] .wave4{fill:#1e293b;}
.card{position:relative;width:100%;max-width:380px;max-height:90vh;overflow-y:auto;padding:34px 28px;background:var(--glass);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--glass-border);border-radius:24px;box-shadow:0 15px 35px rgba(0,0,0,0.15),0 5px 15px rgba(0,0,0,0.05);z-index:10;transition:all .4s cubic-bezier(0.165,0.84,0.44,1);}
.card:hover{box-shadow:0 20px 45px rgba(0,0,0,0.2);}
.gear{position:absolute;top:18px;right:18px;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.3);color:#fff;font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.3s;z-index:11;}
.gear:hover{transform:rotate(60deg);background:rgba(251,133,0,0.35);}
.gear.hidden{display:none;}
.header{text-align:center;margin-bottom:24px;}
.logo-container{display:inline-flex;justify-content:center;align-items:center;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);margin-bottom:14px;color:#fff;box-shadow:0 8px 32px 0 rgba(31,38,135,0.08);animation:pulseLogo 3s ease-in-out infinite;}
@keyframes pulseLogo{0%,100%{transform:scale(1);}50%{transform:scale(1.05);}}
.header h2{color:#fff;font-weight:700;font-size:26px;letter-spacing:-0.5px;margin-bottom:6px;text-shadow:0 2px 4px rgba(0,0,0,0.1);}
.header p{color:rgba(255,255,255,0.85);font-size:14px;}
.tabs{display:flex;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:4px;margin-bottom:20px;}
.tab{flex:1;text-align:center;padding:10px;border-radius:9px;color:rgba(255,255,255,0.8);font-size:14px;font-weight:600;cursor:pointer;transition:.25s;user-select:none;}
.tab.active{background:rgba(255,255,255,0.25);color:#fff;box-shadow:0 4px 12px rgba(0,0,0,0.08);}
.input-group{position:relative;margin-bottom:18px;}
.input-group input{width:100%;padding:15px 18px 15px 45px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:12px;outline:none;color:#fff;font-size:15px;transition:.3s;}
.input-group input::placeholder{color:rgba(255,255,255,0.6);}
.input-group input:focus{background:rgba(255,255,255,0.2);border-color:#fff;box-shadow:0 0 15px rgba(255,255,255,0.25);}
.input-group .icon{position:absolute;left:16px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.7);display:flex;align-items:center;}
.input-group input:focus+.icon{color:#fff;}
.btn-login{width:100%;padding:15px;border:none;border-radius:12px;background:linear-gradient(90deg,var(--accent) 0%,#ff9e00 100%);color:#fff;font-weight:600;font-size:16px;cursor:pointer;box-shadow:0 8px 20px rgba(251,133,0,0.3);transition:.3s cubic-bezier(0.175,0.885,0.32,1.275);display:flex;justify-content:center;align-items:center;gap:8px;}
.btn-login:hover{background:linear-gradient(90deg,#ff9e00 0%,var(--accent) 100%);transform:translateY(-2px);box-shadow:0 12px 25px rgba(251,133,0,0.45);}
.btn-login:active{transform:translateY(1px);}
.btn-login[disabled]{opacity:.6;cursor:not-allowed;transform:none;}
.btn-ghost{width:100%;padding:13px;border:1px solid rgba(255,255,255,0.25);border-radius:12px;background:rgba(255,255,255,0.1);color:#fff;font-weight:600;font-size:14px;cursor:pointer;margin-top:10px;transition:.2s;}
.btn-ghost:hover{background:rgba(255,255,255,0.2);}
.welcome{color:#fff;text-align:center;font-size:17px;margin-bottom:6px;}
.welcome b{font-weight:700;}
.meta{color:rgba(255,255,255,0.8);font-size:12px;text-align:center;margin:12px 0;}
.links{list-style:none;margin:14px 0 6px;max-height:34vh;overflow-y:auto;}
.links li{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.18);border-radius:11px;padding:10px 12px;margin-bottom:8px;}
.links a{flex:1;color:#fff;font-size:12.5px;text-decoration:none;word-break:break-all;opacity:.95;}
.links a:hover{text-decoration:underline;}
.blk{flex:none;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.3);color:#fff;font-size:11px;border-radius:8px;padding:6px 9px;cursor:pointer;white-space:nowrap;transition:.2s;}
.blk:hover{background:rgba(220,40,40,0.55);border-color:rgba(255,120,120,0.6);}
.blk.confirm{background:rgba(220,40,40,0.85);border-color:#fff;}
.flabel{display:block;color:rgba(255,255,255,0.85);font-size:12px;font-weight:600;margin-bottom:10px;}
.themes{display:flex;gap:12px;margin-bottom:20px;}
.swatch{flex:1;height:50px;border-radius:12px;border:2px solid transparent;cursor:pointer;transition:.2s;box-shadow:0 4px 10px rgba(0,0,0,0.15);}
.swatch.sel{border-color:#fff;transform:translateY(-2px);}
.swatch.sunset{background:linear-gradient(135deg,#ffb5a7,#ffcad4 40%,#0077b6);}
.swatch.day{background:linear-gradient(135deg,#90e0ef,#caf0f8 40%,#0077b6);}
.swatch.night{background:linear-gradient(135deg,#2b2d42,#3a3d5c 40%,#0d1b2a);}
.trow{display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-top:1px solid rgba(255,255,255,0.15);color:#fff;font-size:14px;}
.switch{width:46px;height:26px;border-radius:13px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.15);position:relative;cursor:pointer;transition:.2s;}
.switch::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:#fff;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3);}
.switch.on{background:var(--accent);}
.switch.on::after{transform:translateX(20px);}
.stepper{display:flex;align-items:center;gap:6px;}
.stepper button{width:30px;height:30px;border-radius:9px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.15);color:#fff;font-size:17px;cursor:pointer;line-height:1;}
.stepper span{min-width:28px;text-align:center;font-weight:600;color:#fff;}
.divider{display:flex;align-items:center;text-align:center;margin:20px 0;color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px;}
.divider::before,.divider::after{content:'';flex:1;border-bottom:1px solid rgba(255,255,255,0.15);}
.divider:not(:empty)::before{margin-right:1em;}.divider:not(:empty)::after{margin-left:1em;}
.msg{margin-top:14px;font-size:13px;text-align:center;border-radius:10px;padding:0;color:#fff;transition:.2s;}
.msg.show{padding:10px 12px;}
.msg.err{background:rgba(220,40,40,0.28);border:1px solid rgba(255,120,120,0.45);}
.msg.ok{background:rgba(40,180,99,0.25);border:1px solid rgba(120,255,170,0.4);}
.hidden{display:none!important;}
::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.25);border-radius:10px;}
</style>
</head>
<body data-theme="sunset">
<div class="sun"></div>
<div class="cloud cloud-1"></div>
<div class="cloud cloud-2"></div>
<div class="waves">
  <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 24 150 28" preserveAspectRatio="none" style="width:100%;height:100%;">
    <defs><path id="gw" d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18v44h-352z"/></defs>
    <g class="parallax">
      <use xlink:href="#gw" x="48" y="0" class="wave1"/>
      <use xlink:href="#gw" x="48" y="3" class="wave2"/>
      <use xlink:href="#gw" x="48" y="5" class="wave3"/>
      <use xlink:href="#gw" x="48" y="7" class="wave4"/>
    </g>
  </svg>
</div>

<div class="card">
  <button class="gear hidden" id="gearBtn" title="Settings">&#9881;</button>
  <div class="header">
    <div class="logo-container">
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12a4 4 0 1 1 8 0"/><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
    </div>
    <h2>voidEXT</h2>
    <p id="subtitle">Dive into your account</p>
  </div>

  <!-- AUTH -->
  <div id="authView">
    <div class="tabs">
      <div class="tab active" id="tabLogin">Login</div>
      <div class="tab" id="tabSignup">Sign Up</div>
    </div>
    <form id="authForm" autocomplete="off">
      <div class="input-group">
        <input id="username" type="text" placeholder="Username" autocomplete="off" required>
        <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
      </div>
      <div class="input-group">
        <input id="password" type="password" placeholder="Password" autocomplete="off" required>
        <span class="icon"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
      </div>
      <button type="submit" class="btn-login" id="authBtn">
        Dive In
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </button>
    </form>
  </div>

  <!-- DASHBOARD -->
  <div id="dashView" class="hidden">
    <div class="welcome">Welcome, <b id="who"></b> 🌊</div>
    <div class="meta" id="poolMeta">Ready when you are.</div>
    <button class="btn-login" id="genBtn">Generate Links</button>
    <ul class="links" id="linkList"></ul>
    <button class="btn-ghost" id="logoutBtn">Log out</button>
  </div>

  <!-- SETTINGS -->
  <div id="setView" class="hidden">
    <span class="flabel">Beach theme</span>
    <div class="themes">
      <button class="swatch sunset" data-theme-pick="sunset" title="Sunset"></button>
      <button class="swatch day" data-theme-pick="day" title="Day"></button>
      <button class="swatch night" data-theme-pick="night" title="Night"></button>
    </div>
    <div class="trow"><span>Open links in new tab</span><button class="switch" id="setNewTab"></button></div>
    <div class="trow"><span>Confirm before reporting</span><button class="switch" id="setConfirm"></button></div>
    <div class="trow"><span>Links per generate</span>
      <div class="stepper"><button id="batchMinus">&minus;</button><span id="batchVal">10</span><button id="batchPlus">+</button></div>
    </div>
    <button class="btn-login" id="saveBtn" style="margin-top:18px;">Save settings</button>
    <button class="btn-ghost" id="backBtn">Back</button>
  </div>

  <div class="msg" id="msg"></div>
</div>

<script>
(function(){
  var API='${API_BASE}', TOKEN_KEY='voidext_token';
  var DEFAULTS={theme:'sunset',openInNewTab:true,batchSize:10,confirmReport:false};
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

  function applyTheme(t){document.body.setAttribute('data-theme',t||'sunset');}
  function applySettings(s){state.settings=Object.assign({},DEFAULTS,s||{});applyTheme(state.settings.theme);}

  function show(view){
    $('authView').classList.toggle('hidden',view!=='auth');
    $('dashView').classList.toggle('hidden',view!=='dash');
    $('setView').classList.toggle('hidden',view!=='set');
    $('gearBtn').classList.toggle('hidden',view==='auth');
    var sub=$('subtitle');
    sub.textContent=view==='auth'?'Dive into your account':(view==='set'?'Settings':'Your link station');
  }
  function showDash(username){if(username)$('who').textContent=username;show('dash');}

  function setMode(m){
    state.mode=m;
    $('tabLogin').classList.toggle('active',m==='login');
    $('tabSignup').classList.toggle('active',m==='signup');
    $('authBtn').childNodes[0].nodeValue=(m==='login'?'Dive In ':'Create account ');
    clearMsg();
  }
  $('tabLogin').onclick=function(){setMode('login');};
  $('tabSignup').onclick=function(){setMode('signup');};

  $('authForm').onsubmit=function(e){
    e.preventDefault();
    var u=$('username').value.trim(),p=$('password').value;
    if(!u||!p){msg('Enter a username and password.','err');return;}
    var b=$('authBtn');b.disabled=true;
    msg(state.mode==='login'?'Signing in...':'Creating account...','');
    api('/api/'+(state.mode==='login'?'login':'signup'),{method:'POST',body:{username:u,password:p}})
      .then(function(res){
        b.disabled=false;
        if(!res.ok){msg(res.data.error||'Something went wrong.','err');return;}
        setToken(res.data.token);applySettings(res.data.settings);clearMsg();showDash(res.data.username);
      })
      .catch(function(){b.disabled=false;msg('Network error — is the server reachable?','err');});
  };

  $('genBtn').onclick=function(){
    var b=$('genBtn');b.disabled=true;msg('Pulling fresh links...','');
    api('/api/links').then(function(res){
      b.disabled=false;
      if(res.status===401){setToken('');show('auth');setMode('login');msg('Session expired — log in again.','err');return;}
      if(!res.ok){msg(res.data.error||'Could not get links.','err');return;}
      renderLinks(res.data.links||[]);
      var meta='Pool: '+(res.data.poolSize||0)+' live links';
      meta+=res.data.rateLimit?(' · '+res.data.remaining+'/'+res.data.limit+' left today'):' · unlimited (testing)';
      $('poolMeta').textContent=meta;clearMsg();
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };

  function renderLinks(links){
    var L=$('linkList');L.innerHTML='';
    if(!links.length){msg('No links available right now.','err');return;}
    links.forEach(function(url){
      var li=document.createElement('li');
      var a=document.createElement('a');a.href=url;a.target=state.settings.openInNewTab?'_blank':'_top';a.rel='noopener noreferrer';a.textContent=url;
      var blk=document.createElement('button');blk.className='blk';blk.type='button';blk.textContent='blocked';
      var armed=false,timer=null;
      blk.onclick=function(){
        if(state.settings.confirmReport&&!armed){armed=true;blk.classList.add('confirm');blk.textContent='Sure?';timer=setTimeout(function(){armed=false;blk.classList.remove('confirm');blk.textContent='blocked';},2500);return;}
        clearTimeout(timer);blk.disabled=true;blk.textContent='...';
        api('/api/report',{method:'POST',body:{url:url}}).then(function(res){
          if(res.ok){li.parentNode&&li.parentNode.removeChild(li);msg('Reported & removed. Pool: '+res.data.poolSize,'ok');}
          else{blk.disabled=false;blk.classList.remove('confirm');blk.textContent='blocked';msg(res.data.error||'Could not report.','err');}
        }).catch(function(){blk.disabled=false;blk.textContent='blocked';msg('Network error.','err');});
      };
      li.appendChild(a);li.appendChild(blk);L.appendChild(li);
    });
  }

  // settings
  $('gearBtn').onclick=function(){state.draft=Object.assign({},state.settings);paintSettings();clearMsg();show('set');};
  $('backBtn').onclick=function(){applyTheme(state.settings.theme);clearMsg();showDash();};
  function paintSettings(){
    var d=state.draft;
    document.querySelectorAll('[data-theme-pick]').forEach(function(el){el.classList.toggle('sel',el.getAttribute('data-theme-pick')===d.theme);});
    $('setNewTab').classList.toggle('on',d.openInNewTab);
    $('setConfirm').classList.toggle('on',d.confirmReport);
    $('batchVal').textContent=d.batchSize;
  }
  document.querySelectorAll('[data-theme-pick]').forEach(function(el){
    el.onclick=function(){state.draft.theme=el.getAttribute('data-theme-pick');applyTheme(state.draft.theme);paintSettings();};
  });
  $('setNewTab').onclick=function(){state.draft.openInNewTab=!state.draft.openInNewTab;paintSettings();};
  $('setConfirm').onclick=function(){state.draft.confirmReport=!state.draft.confirmReport;paintSettings();};
  $('batchMinus').onclick=function(){state.draft.batchSize=Math.max(1,state.draft.batchSize-1);paintSettings();};
  $('batchPlus').onclick=function(){state.draft.batchSize=Math.min(20,state.draft.batchSize+1);paintSettings();};
  $('saveBtn').onclick=function(){
    var b=$('saveBtn');b.disabled=true;msg('Saving...','');
    api('/api/settings',{method:'POST',body:{settings:state.draft}}).then(function(res){
      b.disabled=false;
      if(!res.ok){msg(res.data.error||'Could not save.','err');return;}
      applySettings(res.data.settings);msg('Settings saved.','ok');showDash();
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };

  $('logoutBtn').onclick=function(){
    api('/api/logout',{method:'POST'});
    setToken('');applySettings(DEFAULTS);show('auth');setMode('login');msg('Logged out.','ok');
  };

  (function init(){
    setMode('login');applyTheme('sunset');
    if(token()){
      api('/api/me').then(function(res){
        if(res.ok){applySettings(res.data.settings);showDash(res.data.username);}
        else{setToken('');show('auth');}
      }).catch(function(){show('auth');});
    }else{show('auth');}
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
    'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:99999999;opacity:0;transition:opacity .3s ease;display:flex;justify-content:center;align-items:center;';

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  wrapper.style.cssText =
    'position:relative;width:420px;height:620px;max-width:92vw;max-height:92vh;background:transparent;border-radius:24px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.4);overflow:hidden;transform:scale(0.92);transition:transform .3s cubic-bezier(0.34,1.56,0.64,1);border:1px solid rgba(255,255,255,0.25);';

  const closeBtn = document.createElement('div');
  closeBtn.innerHTML = '&#x2715;';
  closeBtn.style.cssText =
    'position:absolute;top:18px;left:18px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.25);color:rgba(255,255,255,0.9);font-family:sans-serif;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .25s;z-index:100000000;user-select:none;';
  closeBtn.addEventListener('mouseenter', function () {
    closeBtn.style.transform = 'rotate(90deg) scale(1.1)';
    closeBtn.style.background = 'rgba(251,133,0,0.3)';
  });
  closeBtn.addEventListener('mouseleave', function () {
    closeBtn.style.transform = 'rotate(0) scale(1)';
    closeBtn.style.background = 'rgba(255,255,255,0.15)';
  });

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
    if (targetWrapper) targetWrapper.style.transform = 'scale(0.92)';
    targetOverlay.style.opacity = '0';
    setTimeout(function () {
      if (targetOverlay.parentNode) targetOverlay.parentNode.removeChild(targetOverlay);
    }, 300);
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
