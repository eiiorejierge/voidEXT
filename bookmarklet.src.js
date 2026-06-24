/* =============================================================================
 * voidEXT bookmarklet (readable source)
 * -----------------------------------------------------------------------------
 * Injects a beach-themed glass popup on any page with:
 *   - Login / Sign Up tabs (talks to the voidEXT site)
 *   - A dashboard that generates a rotating batch of links from the server
 *   - A "report blocked" button on each link (pulls it from server rotation)
 *
 * ALL UI is rendered inside the popup/iframe. There are NO alert()/confirm()/
 * prompt() calls, so you never get the "<site> says..." browser dialog.
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
:root{--primary:#0077b6;--accent:#fb8500;--bg-sky-top:#ffb5a7;--bg-sky-mid:#ffcad4;--bg-ocean-top:#90e0ef;--bg-ocean-bot:#0077b6;--glass:rgba(255,255,255,0.15);--glass-border:rgba(255,255,255,0.25);}
*{box-sizing:border-box;margin:0;padding:0;font-family:'Outfit',sans-serif;}
body{min-height:100vh;display:flex;justify-content:center;align-items:center;background:linear-gradient(135deg,var(--bg-sky-top) 0%,var(--bg-sky-mid) 35%,var(--bg-ocean-top) 70%,var(--bg-ocean-bot) 100%);overflow:hidden;position:relative;}
.sun{position:absolute;top:40px;right:50px;width:70px;height:70px;background:radial-gradient(circle,#fff7ed 20%,#fdba74 70%,#fb8500 100%);border-radius:50%;box-shadow:0 0 30px #fdba74,0 0 60px #fb8500;animation:floatSun 8s ease-in-out infinite alternate;z-index:1;}
@keyframes floatSun{0%{transform:translateY(0) scale(1);}100%{transform:translateY(-15px) scale(1.03);}}
.cloud{position:absolute;background:rgba(255,255,255,0.35);border-radius:100px;z-index:1;}
.cloud-1{width:120px;height:40px;top:10%;left:60px;}
.cloud-2{width:80px;height:28px;top:22%;left:-40px;opacity:0.8;}
.waves{position:absolute;bottom:0;left:0;width:100%;height:90px;z-index:2;}
.parallax>use{animation:move-forever 25s cubic-bezier(.55,.5,.45,.5) infinite;}
.parallax>use:nth-child(1){animation-delay:-2s;animation-duration:7s;}
.parallax>use:nth-child(2){animation-delay:-3s;animation-duration:10s;}
.parallax>use:nth-child(3){animation-delay:-4s;animation-duration:13s;}
.parallax>use:nth-child(4){animation-delay:-5s;animation-duration:20s;}
@keyframes move-forever{0%{transform:translate3d(-90px,0,0);}100%{transform:translate3d(85px,0,0);}}
.wave1{fill:rgba(144,224,239,0.3);}.wave2{fill:rgba(72,202,228,0.5);}.wave3{fill:rgba(0,150,199,0.4);}.wave4{fill:#f5ebe0;}
.card{position:relative;width:100%;max-width:360px;max-height:88vh;overflow-y:auto;padding:32px 26px;background:var(--glass);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid var(--glass-border);border-radius:24px;box-shadow:0 15px 35px rgba(0,0,0,0.15);z-index:10;}
.header{text-align:center;margin-bottom:22px;}
.logo{display:inline-flex;justify-content:center;align-items:center;width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.2);border:1px solid rgba(255,255,255,0.3);margin-bottom:12px;color:#fff;animation:pulseLogo 3s ease-in-out infinite;}
@keyframes pulseLogo{0%,100%{transform:scale(1);}50%{transform:scale(1.05);}}
.header h2{color:#fff;font-weight:700;font-size:24px;letter-spacing:-0.5px;text-shadow:0 2px 4px rgba(0,0,0,0.1);}
.header p{color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px;}
.tabs{display:flex;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:12px;padding:4px;margin-bottom:18px;}
.tab{flex:1;text-align:center;padding:9px;border-radius:9px;color:rgba(255,255,255,0.8);font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;user-select:none;}
.tab.active{background:rgba(255,255,255,0.25);color:#fff;}
.input-group{position:relative;margin-bottom:16px;}
.input-group input{width:100%;padding:14px 16px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:12px;outline:none;color:#fff;font-size:15px;transition:all .3s;}
.input-group input::placeholder{color:rgba(255,255,255,0.6);}
.input-group input:focus{background:rgba(255,255,255,0.2);border-color:#fff;}
.btn{width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(90deg,var(--accent) 0%,#ff9e00 100%);color:#fff;font-weight:600;font-size:15px;cursor:pointer;box-shadow:0 8px 20px rgba(251,133,0,0.3);transition:all .25s;display:flex;justify-content:center;align-items:center;gap:8px;}
.btn:hover{transform:translateY(-2px);box-shadow:0 12px 25px rgba(251,133,0,0.45);}
.btn:active{transform:translateY(1px);}
.btn[disabled]{opacity:.6;cursor:not-allowed;transform:none;}
.btn-ghost{background:rgba(255,255,255,0.12);box-shadow:none;border:1px solid rgba(255,255,255,0.2);}
.msg{margin-top:14px;font-size:13px;text-align:center;border-radius:10px;padding:0;min-height:0;color:#fff;transition:all .2s;}
.msg.show{padding:10px 12px;}
.msg.err{background:rgba(220,40,40,0.25);border:1px solid rgba(255,120,120,0.4);}
.msg.ok{background:rgba(40,180,99,0.22);border:1px solid rgba(120,255,170,0.35);}
.hidden{display:none!important;}
.welcome{color:#fff;text-align:center;margin-bottom:14px;}
.welcome b{font-weight:700;}
.meta{color:rgba(255,255,255,0.75);font-size:12px;text-align:center;margin-bottom:14px;}
.links{list-style:none;margin:16px 0 8px;max-height:34vh;overflow-y:auto;}
.links li{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.18);border-radius:10px;padding:9px 11px;margin-bottom:8px;}
.links a{flex:1;color:#fff;font-size:12.5px;text-decoration:none;word-break:break-all;}
.links a:hover{text-decoration:underline;}
.report{flex:none;background:rgba(220,40,40,0.25);border:1px solid rgba(255,120,120,0.4);color:#fff;font-size:11px;border-radius:8px;padding:5px 8px;cursor:pointer;white-space:nowrap;}
.report:hover{background:rgba(220,40,40,0.45);}
.row{display:flex;gap:10px;margin-top:10px;}
.row .btn{flex:1;}
::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.25);border-radius:10px;}
</style>
</head>
<body>
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
  <div class="header">
    <div class="logo">
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12a4 4 0 1 1 8 0"/><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
    </div>
    <h2>voidEXT</h2>
    <p id="subtitle">Sign in to ride the wave</p>
  </div>

  <!-- AUTH VIEW -->
  <div id="authView">
    <div class="tabs">
      <div class="tab active" id="tabLogin">Login</div>
      <div class="tab" id="tabSignup">Sign Up</div>
    </div>
    <form id="authForm" autocomplete="off">
      <div class="input-group"><input id="username" type="text" placeholder="Username" autocomplete="off" required></div>
      <div class="input-group"><input id="password" type="password" placeholder="Password" autocomplete="off" required></div>
      <button type="submit" class="btn" id="authBtn">Login</button>
    </form>
  </div>

  <!-- DASHBOARD VIEW -->
  <div id="dashView" class="hidden">
    <div class="welcome">Welcome, <b id="who"></b> 🌊</div>
    <div class="meta" id="poolMeta"></div>
    <button class="btn" id="genBtn">Generate Links</button>
    <ul class="links" id="linkList"></ul>
    <div class="row">
      <button class="btn btn-ghost" id="logoutBtn">Log out</button>
    </div>
  </div>

  <div class="msg" id="msg"></div>
</div>

<script>
(function(){
  var API = '${API_BASE}';
  var TOKEN_KEY = 'voidext_token';
  var mode = 'login';

  var $ = function(id){ return document.getElementById(id); };
  function token(){ try { return localStorage.getItem(TOKEN_KEY) || ''; } catch(e){ return ''; } }
  function setToken(t){ try { t ? localStorage.setItem(TOKEN_KEY,t) : localStorage.removeItem(TOKEN_KEY); } catch(e){} }

  function showMsg(text, kind){
    var m = $('msg');
    m.className = 'msg show ' + (kind||'');
    m.textContent = text;
  }
  function clearMsg(){ var m=$('msg'); m.className='msg'; m.textContent=''; }

  function api(pathname, opts){
    opts = opts || {};
    var headers = { 'Content-Type':'application/json' };
    if (token()) headers['Authorization'] = 'Bearer ' + token();
    return fetch(API + pathname, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function(r){
      return r.json().catch(function(){ return {}; }).then(function(j){ return { ok:r.ok, status:r.status, data:j }; });
    });
  }

  // ---- view switching ----
  function showAuth(){ $('authView').classList.remove('hidden'); $('dashView').classList.add('hidden'); $('subtitle').textContent = 'Sign in to ride the wave'; }
  function showDash(username){
    $('authView').classList.add('hidden'); $('dashView').classList.remove('hidden');
    $('subtitle').textContent = 'Your link station';
    $('who').textContent = username;
    $('linkList').innerHTML = '';
  }

  // ---- tabs ----
  function setMode(m){
    mode = m;
    $('tabLogin').classList.toggle('active', m==='login');
    $('tabSignup').classList.toggle('active', m==='signup');
    $('authBtn').textContent = m==='login' ? 'Login' : 'Create account';
    clearMsg();
  }
  $('tabLogin').addEventListener('click', function(){ setMode('login'); });
  $('tabSignup').addEventListener('click', function(){ setMode('signup'); });

  // ---- auth submit ----
  $('authForm').addEventListener('submit', function(e){
    e.preventDefault();
    var u = $('username').value.trim();
    var p = $('password').value;
    if (!u || !p){ showMsg('Enter a username and password.', 'err'); return; }
    var btn = $('authBtn'); btn.disabled = true;
    showMsg(mode==='login' ? 'Signing in...' : 'Creating account...', '');
    api('/api/' + (mode==='login'?'login':'signup'), { method:'POST', body:{ username:u, password:p } })
      .then(function(res){
        btn.disabled = false;
        if (!res.ok){ showMsg(res.data.error || 'Something went wrong.', 'err'); return; }
        setToken(res.data.token);
        clearMsg();
        showDash(res.data.username);
      })
      .catch(function(){ btn.disabled = false; showMsg('Network error — is the server reachable?', 'err'); });
  });

  // ---- generate links ----
  $('genBtn').addEventListener('click', function(){
    var btn = $('genBtn'); btn.disabled = true;
    showMsg('Pulling fresh links...', '');
    api('/api/links').then(function(res){
      btn.disabled = false;
      if (res.status === 401){ setToken(''); showAuth(); showMsg('Session expired — please log in again.', 'err'); return; }
      if (!res.ok){ showMsg(res.data.error || 'Could not get links.', 'err'); return; }
      renderLinks(res.data.links || []);
      var meta = 'Pool: ' + (res.data.poolSize||0) + ' live links';
      if (res.data.rateLimit) meta += ' · ' + res.data.remaining + '/' + res.data.limit + ' left today';
      else meta += ' · unlimited (testing)';
      $('poolMeta').textContent = meta;
      clearMsg();
    }).catch(function(){ btn.disabled = false; showMsg('Network error.', 'err'); });
  });

  function renderLinks(links){
    var list = $('linkList'); list.innerHTML = '';
    if (!links.length){ showMsg('No links available right now.', 'err'); return; }
    links.forEach(function(url){
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = url;
      var rep = document.createElement('button');
      rep.className = 'report'; rep.type = 'button'; rep.textContent = 'blocked';
      rep.addEventListener('click', function(){
        rep.disabled = true; rep.textContent = '...';
        api('/api/report', { method:'POST', body:{ url:url } }).then(function(res){
          if (res.ok){ li.parentNode && li.parentNode.removeChild(li); showMsg('Reported & removed from rotation. Pool: ' + res.data.poolSize, 'ok'); }
          else { rep.disabled = false; rep.textContent = 'blocked'; showMsg(res.data.error || 'Could not report.', 'err'); }
        }).catch(function(){ rep.disabled=false; rep.textContent='blocked'; showMsg('Network error.', 'err'); });
      });
      li.appendChild(a); li.appendChild(rep); list.appendChild(li);
    });
  }

  // ---- logout ----
  $('logoutBtn').addEventListener('click', function(){
    api('/api/logout', { method:'POST' });
    setToken(''); showAuth(); setMode('login'); showMsg('Logged out.', 'ok');
  });

  // ---- boot: resume session if a valid token exists ----
  (function init(){
    setMode('login');
    if (token()){
      api('/api/me').then(function(res){
        if (res.ok) showDash(res.data.username);
        else { setToken(''); showAuth(); }
      }).catch(function(){ showAuth(); });
    } else {
      showAuth();
    }
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
    'position:absolute;top:18px;right:18px;width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.15);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.25);color:rgba(255,255,255,0.9);font-family:sans-serif;font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .25s;z-index:100000000;user-select:none;';
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
  function closeExisting(el) {
    closePopup(el);
  }

  closeBtn.addEventListener('click', function () {
    closePopup();
  });
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closePopup();
  });
  const handleEscape = function (e) {
    if (e.key === 'Escape') {
      closePopup();
      window.removeEventListener('keydown', handleEscape);
    }
  };
  window.addEventListener('keydown', handleEscape);
  iframe.addEventListener('load', function () {
    try {
      iframe.contentWindow.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closePopup();
      });
    } catch (err) {}
  });
})();
