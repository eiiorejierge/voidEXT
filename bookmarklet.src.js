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
.badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;margin-left:auto;}
.navitem.active .badge{background:var(--bg);color:var(--text);}
.rep-item{display:flex;align-items:center;gap:11px;background:var(--field);border:1px solid var(--border);border-radius:11px;padding:12px 14px;margin-bottom:9px;cursor:pointer;user-select:none;}
.rep-item .chk{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--border);flex:none;display:flex;align-items:center;justify-content:center;font-size:13px;}
.rep-item.sel .chk{background:var(--text);color:var(--bg);border-color:var(--text);}
.rep-item .lbl{flex:1;font-size:13px;}
.notif{background:var(--field);border:1px solid var(--border);border-radius:11px;padding:13px 15px;margin-bottom:9px;}
.notif.unread{border-color:var(--text);}
.notif .nt{font-size:13px;line-height:1.5;}
.notif .nd{font-size:11px;color:var(--muted);margin-top:6px;}
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
.updbar{position:fixed;top:0;left:0;right:0;z-index:60;background:var(--text);color:var(--bg);font-size:11.5px;text-align:center;padding:8px 12px;letter-spacing:.3px;font-weight:500;cursor:default;}
.updbar b{font-weight:700;}
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
<div id="updateBar" class="updbar hidden"></div>
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
      <button class="navitem" data-nav="report"><span class="ic">⚑</span> Report</button>
      <button class="navitem" data-nav="notifs"><span class="ic">🔔</span> Notifications <span class="badge hidden" id="navBadge">0</span></button>
      <button class="navitem" data-nav="vault"><span class="ic">◍</span> Vault</button>
      <button class="navitem" data-nav="account"><span class="ic">◐</span> Account</button>
      <button class="navitem" data-nav="settings"><span class="ic">⚙</span> Settings</button>
      <button class="navitem" data-nav="help"><span class="ic">?</span> Help</button>
      <div class="spacer"></div>
      <button class="navitem logout" id="logoutBtn"><span class="ic">⏻</span> Log out</button>
    </aside>
    <main class="main">
      <!-- LINKS -->
      <section id="page-links">
        <div class="ptitle">Your Links</div>
        <div class="psub">Add links one at a time — 5 per day, plus any refunded tokens.</div>
        <div class="actions">
          <button class="btn" id="genBtn">Generate a link</button>
          <button class="btn ghost" id="copyBtn">Copy all</button>
          <button class="btn ghost" id="openBtn">Open all</button>
        </div>
        <div class="meter" id="meter"></div>
        <ul class="links" id="linkList"></ul>
        <div class="empty" id="linksEmpty">No links yet — generate one.</div>
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
      <!-- REPORT -->
      <section id="page-report" class="hidden">
        <div class="ptitle">Report Links</div>
        <div class="psub">Select the links that don't work, then send them for review. An admin confirms before anything is blocked.</div>
        <ul class="links" id="reportList" style="margin-top:6px;"></ul>
        <div class="empty" id="reportEmpty">No links to report — generate some first.</div>
        <button class="btn" id="reportBtn" style="margin-top:14px;">Report selected</button>
      </section>
      <!-- NOTIFICATIONS -->
      <section id="page-notifs" class="hidden">
        <div class="ptitle">Notifications</div>
        <div class="psub">Updates about your account and links.</div>
        <div class="actions"><button class="btn ghost" id="notifClear">Clear all</button></div>
        <div id="notifList" style="margin-top:16px;"></div>
        <div class="empty" id="notifEmpty">No notifications yet.</div>
      </section>
      <!-- VAULT -->
      <section id="page-vault" class="hidden">
        <div class="ptitle">Vault</div>
        <div class="psub">Live status of the shared link vault.</div>
        <div class="actions"><button class="btn ghost" id="vaultRefresh">Refresh</button></div>
        <div class="info" style="margin-top:18px;">
          <div class="inforow"><span class="k">Live links in rotation</span><span class="v" id="vPool">—</span></div>
          <div class="inforow"><span class="k">Total links</span><span class="v" id="vTotal">—</span></div>
          <div class="inforow"><span class="k">Blocked / dead</span><span class="v" id="vBlocked">—</span></div>
          <div class="inforow"><span class="k">Your link tokens</span><span class="v" id="vRemain">—</span></div>
        </div>
      </section>
      <!-- ACCOUNT -->
      <section id="page-account" class="hidden">
        <div class="ptitle">Account</div>
        <div class="psub">Your void credentials.</div>
        <div class="info">
          <div class="inforow"><span class="k">Username</span><span class="v" id="acUser">—</span></div>
          <div class="inforow"><span class="k">Member since</span><span class="v" id="acSince">—</span></div>
          <div class="inforow"><span class="k">Link tokens</span><span class="v" id="acRemain">—</span></div>
          <div class="inforow"><span class="k">Theme</span><span class="v" id="acTheme">—</span></div>
        </div>
        <span class="flabel" style="margin-top:26px;">Change password</span>
        <div class="info" style="max-width:360px;">
          <input id="pwCurrent" type="password" placeholder="Current password" autocomplete="off">
          <input id="pwNew" type="password" placeholder="New password" autocomplete="off">
          <button class="btn" id="pwBtn" style="width:100%;">Update password</button>
        </div>
      </section>
      <!-- HELP -->
      <section id="page-help" class="hidden">
        <div class="ptitle">Help</div>
        <div class="psub">How voidEXT works.</div>
        <div class="info">
          <p style="line-height:1.7;margin-bottom:12px;">• Hit <b>Generate Links</b> on the Links page to pull your daily set (5 per day). Your set is saved — it loads automatically next time.</p>
          <p style="line-height:1.7;margin-bottom:12px;">• Click <b>Link 1</b>, <b>Link 2</b>… to open them. Use <b>Open all</b> to launch every link at once.</p>
          <p style="line-height:1.7;margin-bottom:12px;">• If a link is dead or blocked, tap <b>blocked</b> on it — it's pulled from everyone's rotation and reported.</p>
          <p style="line-height:1.7;margin-bottom:12px;">• <b>Vault</b> shows how many links are still live. <b>Settings</b> changes your theme and behavior.</p>
          <p style="line-height:1.7;color:var(--muted);">Links are stored on the server and shown as labels so the URLs don't leak over your shoulder.</p>
          <p style="margin-top:16px;color:var(--muted);font-size:12px;">voidEXT <b>v__VERSION__</b></p>
        </div>
      </section>
      <div class="msg" id="msg"></div>
    </main>
  </div>
</div>

<script>
(function(){
  var API='${API_BASE}', TOKEN_KEY='voidext_token', BUILT_VERSION='__VERSION__';
  var DEFAULTS={theme:'void',openInNewTab:true,confirmReport:false};
  var state={mode:'login',settings:Object.assign({},DEFAULTS),draft:null,account:null,links:[],notifications:[],unread:0,reportSel:{}};

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
    ['links','report','notifs','vault','account','settings','help'].forEach(function(p){
      $('page-'+p).classList.toggle('hidden',p!==page);
    });
    document.querySelectorAll('[data-nav]').forEach(function(el){el.classList.toggle('active',el.getAttribute('data-nav')===page);});
    if(page==='settings')openSettings();
    if(page==='account')renderAccount();
    if(page==='vault')loadVault();
    if(page==='report')renderReport();
    if(page==='notifs')openNotifs();
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
        setToken(res.data.token);state.username=res.data.username;applySettings(res.data.settings);state.account=res.data.account||null;state.links=res.data.links||[];state.notifications=res.data.notifications||[];
        clearMsg();showApp();renderLinks(state.links);setBadge(res.data.unread||0);
      })
      .catch(function(){b.disabled=false;msg('Network error — is the server reachable?','err');});
  };

  // links page
  $('genBtn').onclick=function(){
    var b=$('genBtn');b.disabled=true;msg('Pulling a link...','');
    api('/api/links').then(function(res){
      b.disabled=false;
      if(res.status===401){setToken('');showAuth();setMode('login');msg('Session expired — log in again.','err');return;}
      if(res.data.links)state.links=res.data.links;
      renderLinks(state.links);updateMeter(res.data);
      if(!res.ok){msg(res.data.error||'Could not get a link.','err');return;}
      if(res.data.added===null){msg(res.data.note||'No new links available.','err');return;}
      clearMsg();
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
    var rem=d.remaining;
    $('meter').textContent=rem+' link token'+(rem===1?'':'s');
    if(state.account){state.account.remaining=rem;state.account.limit=d.limit;}
  }
  function renderLinks(links){
    var L=$('linkList');L.innerHTML='';
    $('linksEmpty').classList.toggle('hidden',links.length>0);
    $('genBtn').textContent='Generate a link';
    if(state.account){
      var rem=(state.account.remaining==null?(state.account.limit||5):state.account.remaining);
      $('meter').textContent=rem+' link token'+(rem===1?'':'s');
    }
    links.forEach(function(url,idx){
      var li=document.createElement('li');
      var a=document.createElement('a');a.href=url;a.target=state.settings.openInNewTab?'_blank':'_top';a.rel='noopener noreferrer';a.textContent='Link '+(idx+1);
      li.appendChild(a);L.appendChild(li);
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
    var rem=(a.remaining==null?(a.limit||5):a.remaining);
    $('acRemain').textContent=rem+' link token'+(rem===1?'':'s');
    $('acTheme').textContent=state.settings.theme;
  }

  // report page
  function renderReport(){
    var L=$('reportList');L.innerHTML='';
    state.reportSel={};
    $('reportEmpty').classList.toggle('hidden',state.links.length>0);
    $('reportBtn').style.display=state.links.length?'':'none';
    state.links.forEach(function(url,idx){
      var row=document.createElement('div');row.className='rep-item';
      row.innerHTML='<span class="chk"></span><span class="lbl">Link '+(idx+1)+'</span>';
      row.onclick=function(){
        var on=!state.reportSel[url];state.reportSel[url]=on;
        row.classList.toggle('sel',on);row.querySelector('.chk').textContent=on?'✓':'';
      };
      L.appendChild(row);
    });
  }
  $('reportBtn').onclick=function(){
    var urls=Object.keys(state.reportSel||{}).filter(function(u){return state.reportSel[u];});
    if(!urls.length){msg('Select at least one link.','err');return;}
    var b=$('reportBtn');b.disabled=true;msg('Sending report...','');
    api('/api/report',{method:'POST',body:{urls:urls}}).then(function(res){
      b.disabled=false;
      if(!res.ok){msg(res.data.error||'Could not report.','err');return;}
      msg('Reported '+res.data.reported+' link(s) for review.','ok');renderReport();
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };

  // notifications
  function setBadge(n){
    state.unread=n;
    var b=$('navBadge');
    if(n>0){b.textContent=n;b.classList.remove('hidden');}else{b.classList.add('hidden');}
  }
  function renderNotifs(){
    var L=$('notifList');L.innerHTML='';
    var list=(state.notifications||[]).slice().reverse();
    $('notifEmpty').classList.toggle('hidden',list.length>0);
    list.forEach(function(n){
      var d=document.createElement('div');d.className='notif'+(n.read?'':' unread');
      d.innerHTML='<div class="nt">'+(n.text||'').replace(/</g,'&lt;')+'</div><div class="nd">'+new Date(n.at).toLocaleString()+'</div>';
      L.appendChild(d);
    });
  }
  function openNotifs(){
    renderNotifs();
    if(state.unread>0){
      api('/api/notifications/read',{method:'POST'});
      (state.notifications||[]).forEach(function(n){n.read=true;});
      setBadge(0);
    }
  }
  $('notifClear').onclick=function(){
    api('/api/notifications/clear',{method:'POST'}).then(function(){state.notifications=[];renderNotifs();setBadge(0);msg('Cleared.','ok');});
  };
  function refreshNotifs(){
    api('/api/notifications').then(function(res){
      if(res.ok){state.notifications=res.data.notifications||[];setBadge(state.notifications.filter(function(n){return !n.read;}).length);}
    });
  }

  // vault page
  function loadVault(){
    $('vPool').textContent='…';$('vTotal').textContent='…';$('vBlocked').textContent='…';$('vRemain').textContent='…';
    api('/api/stats').then(function(res){
      if(!res.ok){msg(res.data.error||'Could not load vault.','err');return;}
      var d=res.data;
      $('vPool').textContent=d.poolSize;$('vTotal').textContent=d.totalLinks;$('vBlocked').textContent=d.blockedCount;
      var vr=(d.remaining==null?0:d.remaining);
      $('vRemain').textContent=vr+' link token'+(vr===1?'':'s');
      if(state.account){state.account.remaining=d.remaining;state.account.used=d.used;state.account.limit=d.limit;}
    }).catch(function(){msg('Network error.','err');});
  }
  $('vaultRefresh').onclick=loadVault;

  // change password
  $('pwBtn').onclick=function(){
    var cur=$('pwCurrent').value,nw=$('pwNew').value;
    if(!cur||!nw){msg('Fill in both password fields.','err');return;}
    var b=$('pwBtn');b.disabled=true;msg('Updating...','');
    api('/api/password',{method:'POST',body:{current:cur,newPassword:nw}}).then(function(res){
      b.disabled=false;
      if(!res.ok){msg(res.data.error||'Could not update.','err');return;}
      $('pwCurrent').value='';$('pwNew').value='';msg('Password updated.','ok');
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };

  $('logoutBtn').onclick=function(){
    api('/api/logout',{method:'POST'});
    setToken('');state.username=null;state.account=null;state.links=[];applySettings(DEFAULTS);showAuth();setMode('login');msg('Logged out.','ok');
  };

  // version / update check
  function isNewer(a,b){
    var pa=String(a).split('.').map(Number),pb=String(b).split('.').map(Number);
    for(var i=0;i<3;i++){var x=pa[i]||0,y=pb[i]||0;if(x>y)return true;if(x<y)return false;}
    return false;
  }
  function checkVersion(){
    api('/api/version').then(function(res){
      if(res.ok&&res.data.version&&isNewer(res.data.version,BUILT_VERSION)){
        var bar=$('updateBar');
        bar.innerHTML='⬆ Update available: <b>v'+BUILT_VERSION+'</b> → <b>v'+res.data.version+'</b> · reinstall voidEXT from the site to update';
        bar.classList.remove('hidden');
      }
    }).catch(function(){});
  }

  (function init(){
    setMode('login');applyTheme('void');checkVersion();
    if(token()){
      api('/api/me').then(function(res){
        if(res.ok){state.username=res.data.username;applySettings(res.data.settings);state.account=res.data.account||null;state.links=res.data.links||[];state.notifications=res.data.notifications||[];showApp();renderLinks(state.links);setBadge(res.data.unread||0);}
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
