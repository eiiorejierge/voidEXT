/* =============================================================================
 * voidEXT bookmarklet (readable source)
 * -----------------------------------------------------------------------------
 * Large black & white space-themed app popup (starfield, sidebar menu) that
 * works end to end:
 *   - Log in / Sign up against the voidEXT site
 *   - Links page: generate your daily set (5/day), copy-all, open-all, report
 *   - Settings page: theme + behavior toggles, saved to your account
 *   - Account page: username, member-since, daily usage
 *
 * ALL UI renders inside the popup. NO alert()/confirm()/prompt().
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
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:'Space Grotesk',system-ui,sans-serif;}
body[data-theme="void"]{--bg:#000;--text:#fff;--muted:rgba(255,255,255,0.55);--card:rgba(255,255,255,0.05);--border:rgba(255,255,255,0.14);--field:rgba(255,255,255,0.07);--btn-bg:#fff;--btn-fg:#000;--star:#fff;--side:rgba(255,255,255,0.03);}
body[data-theme="nebula"]{--bg:radial-gradient(circle at 28% 20%,#1c1c22 0%,#050507 70%);--text:#fff;--muted:rgba(255,255,255,0.55);--card:rgba(255,255,255,0.06);--border:rgba(255,255,255,0.14);--field:rgba(255,255,255,0.08);--btn-bg:#fff;--btn-fg:#000;--star:#d8d8ec;--side:rgba(255,255,255,0.04);}
body[data-theme="eclipse"]{--bg:#f4f4f5;--text:#0a0a0a;--muted:rgba(0,0,0,0.55);--card:rgba(255,255,255,0.7);--border:rgba(0,0,0,0.13);--field:rgba(0,0,0,0.05);--btn-bg:#000;--btn-fg:#fff;--star:rgba(0,0,0,0.4);--side:rgba(0,0,0,0.03);}
html,body{height:100%;}
body{background:var(--bg);color:var(--text);overflow:hidden;position:relative;transition:background .5s ease,color .5s ease;}
.stars{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:
  radial-gradient(1.5px 1.5px at 25px 35px,var(--star),transparent),
  radial-gradient(1px 1px at 90px 130px,var(--star),transparent),
  radial-gradient(1.5px 1.5px at 170px 60px,var(--star),transparent),
  radial-gradient(1px 1px at 230px 180px,var(--star),transparent),
  radial-gradient(1px 1px at 320px 90px,var(--star),transparent),
  radial-gradient(1.5px 1.5px at 400px 200px,var(--star),transparent);
  background-size:440px 440px;background-repeat:repeat;animation:tw 6s ease-in-out infinite alternate;}
.stars.s2{background-size:280px 280px;opacity:.5;animation-duration:9s;animation-delay:1.5s;}
@keyframes tw{0%{opacity:.3;}100%{opacity:.9;}}
.shell{position:relative;z-index:1;height:100%;display:flex;align-items:center;justify-content:center;padding:18px;}

/* AUTH */
.authcard{width:100%;max-width:360px;background:var(--card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:18px;padding:34px 28px;}
.brandhead{text-align:center;margin-bottom:22px;}
.logo{display:inline-flex;align-items:center;justify-content:center;width:54px;height:54px;border-radius:50%;border:1px solid var(--border);background:var(--field);margin-bottom:12px;color:var(--text);animation:spin 16s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.brandhead h2{font-weight:700;font-size:24px;letter-spacing:3px;}
.brandhead p{color:var(--muted);font-size:13px;margin-top:5px;letter-spacing:.5px;}
.tabs{display:flex;background:var(--field);border:1px solid var(--border);border-radius:11px;padding:4px;margin-bottom:18px;}
.tab{flex:1;text-align:center;padding:10px;border-radius:8px;color:var(--muted);font-size:13.5px;font-weight:600;cursor:pointer;transition:.2s;user-select:none;}
.tab.active{background:var(--btn-bg);color:var(--btn-fg);}
input{width:100%;padding:13px 15px;background:var(--field);border:1px solid var(--border);border-radius:11px;outline:none;color:var(--text);font-size:14.5px;margin-bottom:13px;letter-spacing:.3px;}
input::placeholder{color:var(--muted);}
input:focus{border-color:var(--text);}

/* APP */
.app{width:100%;height:100%;display:flex;background:var(--card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:18px;overflow:hidden;}
.side{width:210px;flex:none;background:var(--side);border-right:1px solid var(--border);padding:22px 16px;display:flex;flex-direction:column;}
.side .brand{display:flex;align-items:center;gap:9px;font-weight:700;font-size:18px;letter-spacing:2px;margin-bottom:26px;padding:0 6px;}
.side .brand .d{width:20px;height:20px;border-radius:50%;border:1px solid var(--border);background:var(--field);}
.navitem{display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;border:none;background:transparent;color:var(--muted);font-size:14px;font-weight:600;border-radius:10px;cursor:pointer;transition:.18s;text-align:left;font-family:inherit;letter-spacing:.3px;margin-bottom:4px;}
.navitem:hover{background:var(--field);color:var(--text);}
.navitem.active{background:var(--btn-bg);color:var(--btn-fg);}
.navitem .ic{width:18px;text-align:center;}
.side .spacer{flex:1;}
.navitem.logout{color:var(--muted);}
.navitem.logout:hover{background:rgba(239,68,68,0.16);color:var(--text);}
.main{flex:1;padding:30px 32px;overflow-y:auto;position:relative;}
.ptitle{font-size:22px;font-weight:700;letter-spacing:.5px;}
.psub{color:var(--muted);font-size:13px;margin-top:4px;margin-bottom:22px;letter-spacing:.3px;}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;}
.btn{padding:12px 18px;border:none;border-radius:11px;background:var(--btn-bg);color:var(--btn-fg);font-weight:600;font-size:14px;cursor:pointer;transition:.2s;letter-spacing:.4px;font-family:inherit;}
.btn:hover{opacity:.88;transform:translateY(-1px);}
.btn:active{transform:translateY(0);}
.btn[disabled]{opacity:.5;cursor:not-allowed;transform:none;}
.btn.ghost{background:transparent;border:1px solid var(--border);color:var(--text);}
.btn.ghost:hover{border-color:var(--text);}
.meter{margin:16px 0 6px;color:var(--muted);font-size:12.5px;letter-spacing:.3px;}
.bar{height:6px;border-radius:6px;background:var(--field);overflow:hidden;margin-top:7px;max-width:260px;}
.bar > i{display:block;height:100%;background:var(--text);transition:width .3s;}
.links{list-style:none;margin:18px 0 6px;display:flex;flex-direction:column;gap:9px;}
.links li{display:flex;align-items:center;gap:10px;background:var(--field);border:1px solid var(--border);border-radius:11px;padding:12px 14px;}
.links a{flex:1;color:var(--text);font-size:12.5px;text-decoration:none;word-break:break-all;opacity:.92;}
.links a:hover{text-decoration:underline;opacity:1;}
.blk{flex:none;background:transparent;border:1px solid var(--border);color:var(--muted);font-size:11px;border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap;transition:.2s;font-family:inherit;}
.blk:hover{border-color:var(--text);color:var(--text);}
.blk.confirm{background:var(--text);color:var(--bg);border-color:var(--text);}
.empty{color:var(--muted);font-size:13px;padding:14px 0;}
.flabel{display:block;color:var(--muted);font-size:11px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;}
.themes{display:flex;gap:12px;margin-bottom:22px;max-width:360px;}
.swatch{flex:1;height:60px;border-radius:12px;border:2px solid transparent;cursor:pointer;transition:.2s;outline:1px solid var(--border);position:relative;}
.swatch.sel{border-color:var(--text);}
.swatch span{position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#fff;mix-blend-mode:difference;}
.swatch.void{background:#000;}
.swatch.nebula{background:radial-gradient(circle at 35% 30%,#2a2a30,#000);}
.swatch.eclipse{background:#f4f4f5;}
.trow{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-top:1px solid var(--border);font-size:14px;max-width:420px;}
.switch{width:46px;height:25px;border-radius:13px;border:1px solid var(--border);background:var(--field);position:relative;cursor:pointer;transition:.2s;}
.switch::after{content:"";position:absolute;top:2px;left:2px;width:19px;height:19px;border-radius:50%;background:var(--text);transition:.2s;}
.switch.on{background:var(--text);}
.switch.on::after{transform:translateX(21px);background:var(--bg);}
.info{max-width:420px;}
.inforow{display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid var(--border);font-size:14px;}
.inforow:first-child{border-top:none;}
.inforow .k{color:var(--muted);letter-spacing:.3px;}
.inforow .v{font-weight:600;}
.bignum{font-size:42px;font-weight:700;letter-spacing:1px;}
.msg{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);font-size:13px;padding:0;border-radius:10px;transition:.2s;z-index:50;max-width:90%;}
.msg.show{padding:11px 16px;}
.msg.err{background:rgba(239,68,68,0.92);color:#fff;}
.msg.ok{background:var(--btn-bg);color:var(--btn-fg);}
.hidden{display:none!important;}
::-webkit-scrollbar{width:7px;}::-webkit-scrollbar-thumb{background:var(--border);border-radius:10px;}
@media(max-width:640px){
  .app{flex-direction:column;}
  .side{width:100%;flex-direction:row;align-items:center;border-right:none;border-bottom:1px solid var(--border);padding:12px;overflow-x:auto;}
  .side .brand{margin-bottom:0;margin-right:8px;font-size:15px;}
  .navitem{margin-bottom:0;padding:9px 11px;font-size:12.5px;white-space:nowrap;}
  .side .spacer{flex:0;}
  .main{padding:20px 18px;}
}
</style>
</head>
<body data-theme="void">
<div class="stars"></div>
<div class="stars s2"></div>
<div class="shell">

  <!-- AUTH -->
  <div id="authWrap" class="authcard">
    <div class="brandhead">
      <div class="logo"><svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="11" ry="4"/></svg></div>
      <h2>voidEXT</h2>
      <p>Enter the void</p>
    </div>
    <div class="tabs">
      <div class="tab active" id="tabLogin">Log in</div>
      <div class="tab" id="tabSignup">Sign up</div>
    </div>
    <form id="authForm" autocomplete="off">
      <input id="username" type="text" placeholder="Username" autocomplete="off" required>
      <input id="password" type="password" placeholder="Password" autocomplete="off" required>
      <button type="submit" class="btn" id="authBtn" style="width:100%;">Log in</button>
    </form>
  </div>

  <!-- APP -->
  <div id="app" class="app hidden">
    <aside class="side">
      <div class="brand"><span class="d"></span>voidEXT</div>
      <button class="navitem active" data-nav="links"><span class="ic">✦</span> Links</button>
      <button class="navitem" data-nav="settings"><span class="ic">⚙</span> Settings</button>
      <button class="navitem" data-nav="account"><span class="ic">◐</span> Account</button>
      <div class="spacer"></div>
      <button class="navitem logout" id="logoutBtn"><span class="ic">⏻</span> Log out</button>
    </aside>
    <main class="main">
      <!-- LINKS -->
      <section id="page-links">
        <div class="ptitle">Your Links</div>
        <div class="psub">Pull your daily set from the vault — 5 per day.</div>
        <div class="actions">
          <button class="btn" id="genBtn">Generate Links</button>
          <button class="btn ghost" id="copyBtn">Copy all</button>
          <button class="btn ghost" id="openBtn">Open all</button>
        </div>
        <div class="meter" id="meter"></div>
        <div class="bar"><i id="bar" style="width:0%"></i></div>
        <ul class="links" id="linkList"></ul>
        <div class="empty" id="linksEmpty">No links yet — hit Generate.</div>
      </section>
      <!-- SETTINGS -->
      <section id="page-settings" class="hidden">
        <div class="ptitle">Settings</div>
        <div class="psub">Personalize your void. Saved to your account.</div>
        <span class="flabel">Theme</span>
        <div class="themes">
          <button class="swatch void" data-theme-pick="void"><span>Void</span></button>
          <button class="swatch nebula" data-theme-pick="nebula"><span>Nebula</span></button>
          <button class="swatch eclipse" data-theme-pick="eclipse"><span>Eclipse</span></button>
        </div>
        <div class="trow"><span>Open links in new tab</span><button class="switch" id="setNewTab"></button></div>
        <div class="trow"><span>Confirm before reporting</span><button class="switch" id="setConfirm"></button></div>
        <button class="btn" id="saveBtn" style="margin-top:20px;">Save settings</button>
      </section>
      <!-- ACCOUNT -->
      <section id="page-account" class="hidden">
        <div class="ptitle">Account</div>
        <div class="psub">Your void credentials.</div>
        <div class="info">
          <div class="inforow"><span class="k">Username</span><span class="v" id="acUser">—</span></div>
          <div class="inforow"><span class="k">Member since</span><span class="v" id="acSince">—</span></div>
          <div class="inforow"><span class="k">Links used today</span><span class="v" id="acUsed">—</span></div>
          <div class="inforow"><span class="k">Remaining today</span><span class="v" id="acRemain">—</span></div>
          <div class="inforow"><span class="k">Theme</span><span class="v" id="acTheme">—</span></div>
        </div>
      </section>
      <div class="msg" id="msg"></div>
    </main>
  </div>
</div>

<script>
(function(){
  var API='${API_BASE}', TOKEN_KEY='voidext_token';
  var DEFAULTS={theme:'void',openInNewTab:true,confirmReport:false};
  var state={mode:'login',settings:Object.assign({},DEFAULTS),draft:null,account:null,links:[]};

  var $=function(id){return document.getElementById(id);};
  function token(){try{return localStorage.getItem(TOKEN_KEY)||'';}catch(e){return'';}}
  function setToken(t){try{t?localStorage.setItem(TOKEN_KEY,t):localStorage.removeItem(TOKEN_KEY);}catch(e){}}
  function msg(t,k){var m=$('msg');m.className='msg show '+(k||'');m.textContent=t;if(k!=='err')setTimeout(function(){if(m.textContent===t)clearMsg();},2600);}
  function clearMsg(){var m=$('msg');m.className='msg';m.textContent='';}
  function fmtDate(ts){if(!ts)return '—';return new Date(ts).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});}

  function api(path,opts){
    opts=opts||{};
    var h={'Content-Type':'application/json'};
    if(token())h['Authorization']='Bearer '+token();
    return fetch(API+path,{method:opts.method||'GET',headers:h,body:opts.body?JSON.stringify(opts.body):undefined})
      .then(function(r){return r.json().catch(function(){return{};}).then(function(j){return{ok:r.ok,status:r.status,data:j};});});
  }

  function applyTheme(t){document.body.setAttribute('data-theme',t||'void');}
  function applySettings(s){state.settings=Object.assign({},DEFAULTS,s||{});applyTheme(state.settings.theme);}

  function showAuth(){$('authWrap').classList.remove('hidden');$('app').classList.add('hidden');}
  function showApp(){$('authWrap').classList.add('hidden');$('app').classList.remove('hidden');nav('links');}

  function nav(page){
    ['links','settings','account'].forEach(function(p){
      $('page-'+p).classList.toggle('hidden',p!==page);
    });
    document.querySelectorAll('[data-nav]').forEach(function(el){el.classList.toggle('active',el.getAttribute('data-nav')===page);});
    if(page==='settings')openSettings();
    if(page==='account')renderAccount();
    clearMsg();
  }
  document.querySelectorAll('[data-nav]').forEach(function(el){el.onclick=function(){nav(el.getAttribute('data-nav'));};});

  // tabs
  function setMode(m){
    state.mode=m;
    $('tabLogin').classList.toggle('active',m==='login');
    $('tabSignup').classList.toggle('active',m==='signup');
    $('authBtn').textContent=m==='login'?'Log in':'Create account';
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
        setToken(res.data.token);state.username=res.data.username;applySettings(res.data.settings);state.account=res.data.account||null;state.links=res.data.links||[];
        clearMsg();showApp();renderLinks(state.links);
      })
      .catch(function(){b.disabled=false;msg('Network error — is the server reachable?','err');});
  };

  // links page
  $('genBtn').onclick=function(){
    var b=$('genBtn');b.disabled=true;msg('Pulling fresh links...','');
    api('/api/links').then(function(res){
      b.disabled=false;
      if(res.status===401){setToken('');showAuth();setMode('login');msg('Session expired — log in again.','err');return;}
      if(!res.ok){msg(res.data.error||'Could not get links.','err');updateMeter(res.data);return;}
      state.links=res.data.links||[];renderLinks(state.links);updateMeter(res.data);clearMsg();
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };
  $('copyBtn').onclick=function(){
    if(!state.links.length){msg('Nothing to copy yet.','err');return;}
    var text=state.links.join('\\n');
    try{
      if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(function(){msg('Copied '+state.links.length+' links.','ok');},fallbackCopy);}
      else fallbackCopy();
    }catch(e){fallbackCopy();}
    function fallbackCopy(){var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');msg('Copied '+state.links.length+' links.','ok');}catch(e){msg('Copy failed.','err');}document.body.removeChild(ta);}
  };
  $('openBtn').onclick=function(){
    if(!state.links.length){msg('Nothing to open yet.','err');return;}
    state.links.forEach(function(u){window.open(u,'_blank','noopener');});
    msg('Opening '+state.links.length+' tabs...','ok');
  };

  function updateMeter(d){
    if(!d||d.remaining==null){return;}
    var used=(d.limit||5)-d.remaining;
    $('meter').textContent=used+' / '+(d.limit||5)+' used today · '+d.remaining+' left';
    $('bar').style.width=Math.round(used/(d.limit||5)*100)+'%';
    if(state.account){state.account.used=used;state.account.remaining=d.remaining;state.account.limit=d.limit;}
  }
  function renderLinks(links){
    var L=$('linkList');L.innerHTML='';
    $('linksEmpty').classList.toggle('hidden',links.length>0);
    $('genBtn').textContent=links.length?'Regenerate Links':'Generate Links';
    if(state.account){
      var lim=state.account.limit||5,rem=(state.account.remaining==null?lim:state.account.remaining),used=lim-rem;
      $('meter').textContent=used+' / '+lim+' used today · '+rem+' left';
      $('bar').style.width=Math.round(used/lim*100)+'%';
    }
    links.forEach(function(url){
      var li=document.createElement('li');
      var a=document.createElement('a');a.href=url;a.target=state.settings.openInNewTab?'_blank':'_top';a.rel='noopener noreferrer';a.textContent=url;
      var blk=document.createElement('button');blk.className='blk';blk.type='button';blk.textContent='blocked';
      var armed=false,timer=null;
      blk.onclick=function(){
        if(state.settings.confirmReport&&!armed){armed=true;blk.classList.add('confirm');blk.textContent='Sure?';timer=setTimeout(function(){armed=false;blk.classList.remove('confirm');blk.textContent='blocked';},2500);return;}
        clearTimeout(timer);blk.disabled=true;blk.textContent='...';
        api('/api/report',{method:'POST',body:{url:url}}).then(function(res){
          if(res.ok){state.links=state.links.filter(function(x){return x!==url;});li.parentNode&&li.parentNode.removeChild(li);$('linksEmpty').classList.toggle('hidden',state.links.length>0);msg('Reported & removed. Pool: '+res.data.poolSize,'ok');}
          else{blk.disabled=false;blk.classList.remove('confirm');blk.textContent='blocked';msg(res.data.error||'Could not report.','err');}
        }).catch(function(){blk.disabled=false;blk.textContent='blocked';msg('Network error.','err');});
      };
      li.appendChild(a);li.appendChild(blk);L.appendChild(li);
    });
  }

  // settings page
  function openSettings(){
    state.draft=Object.assign({},state.settings);
    document.querySelectorAll('[data-theme-pick]').forEach(function(el){el.classList.toggle('sel',el.getAttribute('data-theme-pick')===state.draft.theme);});
    $('setNewTab').classList.toggle('on',state.draft.openInNewTab);
    $('setConfirm').classList.toggle('on',state.draft.confirmReport);
  }
  document.querySelectorAll('[data-theme-pick]').forEach(function(el){
    el.onclick=function(){state.draft.theme=el.getAttribute('data-theme-pick');applyTheme(state.draft.theme);document.querySelectorAll('[data-theme-pick]').forEach(function(x){x.classList.toggle('sel',x===el);});};
  });
  $('setNewTab').onclick=function(){state.draft.openInNewTab=!state.draft.openInNewTab;$('setNewTab').classList.toggle('on',state.draft.openInNewTab);};
  $('setConfirm').onclick=function(){state.draft.confirmReport=!state.draft.confirmReport;$('setConfirm').classList.toggle('on',state.draft.confirmReport);};
  $('saveBtn').onclick=function(){
    var b=$('saveBtn');b.disabled=true;msg('Saving...','');
    api('/api/settings',{method:'POST',body:{settings:state.draft}}).then(function(res){
      b.disabled=false;
      if(!res.ok){msg(res.data.error||'Could not save.','err');return;}
      applySettings(res.data.settings);msg('Settings saved.','ok');
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };

  // account page
  function renderAccount(){
    var a=state.account||{};
    $('acUser').textContent=state.username||'—';
    $('acSince').textContent=fmtDate(a.created);
    var lim=a.limit||5,rem=(a.remaining==null?lim:a.remaining);
    $('acUsed').textContent=(lim-rem)+' / '+lim;
    $('acRemain').textContent=rem;
    $('acTheme').textContent=state.settings.theme;
  }

  $('logoutBtn').onclick=function(){
    api('/api/logout',{method:'POST'});
    setToken('');state.username=null;state.account=null;state.links=[];applySettings(DEFAULTS);showAuth();setMode('login');msg('Logged out.','ok');
  };

  (function init(){
    setMode('login');applyTheme('void');
    if(token()){
      api('/api/me').then(function(res){
        if(res.ok){state.username=res.data.username;applySettings(res.data.settings);state.account=res.data.account||null;state.links=res.data.links||[];showApp();renderLinks(state.links);}
        else{setToken('');showAuth();}
      }).catch(function(){showAuth();});
    }else{showAuth();}
  })();
})();
</script>
</body>
</html>`;

  // --------------------------------------------------------------------------
  // Overlay + iframe shell (host-page side) — large popup
  // --------------------------------------------------------------------------
  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:99999999;opacity:0;transition:opacity .25s ease;display:flex;justify-content:center;align-items:center;';

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  wrapper.style.cssText =
    'position:relative;width:min(960px,94vw);height:min(680px,90vh);background:transparent;border-radius:20px;box-shadow:0 30px 70px -15px rgba(0,0,0,0.7);overflow:hidden;transform:scale(0.97);transition:transform .25s cubic-bezier(0.34,1.3,0.64,1);';

  const closeBtn = document.createElement('div');
  closeBtn.innerHTML = '&#x2715;';
  closeBtn.style.cssText =
    'position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.12);color:#fff;font-family:sans-serif;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s;z-index:100000000;user-select:none;';
  closeBtn.addEventListener('mouseenter', function () { closeBtn.style.background = 'rgba(239,68,68,0.8)'; });
  closeBtn.addEventListener('mouseleave', function () { closeBtn.style.background = 'rgba(255,255,255,0.12)'; });

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
    if (targetWrapper) targetWrapper.style.transform = 'scale(0.97)';
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
