/* =============================================================================
 * voidEXT bookmarklet (readable source)
 * -----------------------------------------------------------------------------
 * Black & white space-themed glass popup (starfield, monochrome UI) that works
 * end to end:
 *   - Log in / Sign up against the voidEXT site
 *   - Dashboard that loads your saved links, or generates a new set (5/day)
 *   - A "blocked" button on each link (pulls it from server rotation)
 *   - A Settings panel (theme, open-in-new-tab, confirm-before-report, batch
 *     size) saved to your account on the server
 *
 * ALL UI renders inside the popup. NO alert()/confirm()/prompt() — no
 * "<site> says..." browser dialogs.
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
body[data-theme="void"]{--bg:#000;--text:#fff;--muted:rgba(255,255,255,0.55);--card:rgba(255,255,255,0.05);--border:rgba(255,255,255,0.16);--field:rgba(255,255,255,0.07);--btn-bg:#fff;--btn-fg:#000;--star:#ffffff;--planet:rgba(255,255,255,0.07);}
body[data-theme="nebula"]{--bg:radial-gradient(circle at 30% 22%,#1c1c22 0%,#050507 70%);--text:#fff;--muted:rgba(255,255,255,0.55);--card:rgba(255,255,255,0.06);--border:rgba(255,255,255,0.16);--field:rgba(255,255,255,0.08);--btn-bg:#fff;--btn-fg:#000;--star:#d8d8ec;--planet:rgba(255,255,255,0.08);}
body[data-theme="eclipse"]{--bg:#f4f4f5;--text:#0a0a0a;--muted:rgba(0,0,0,0.55);--card:rgba(255,255,255,0.7);--border:rgba(0,0,0,0.14);--field:rgba(0,0,0,0.05);--btn-bg:#000;--btn-fg:#fff;--star:rgba(0,0,0,0.45);--planet:rgba(0,0,0,0.06);}
body{min-height:100vh;display:flex;justify-content:center;align-items:center;background:var(--bg);color:var(--text);overflow:hidden;position:relative;padding:18px;transition:background .5s ease,color .5s ease;}
.stars{position:absolute;inset:0;z-index:0;pointer-events:none;background-image:
  radial-gradient(1.5px 1.5px at 25px 35px,var(--star),transparent),
  radial-gradient(1px 1px at 80px 120px,var(--star),transparent),
  radial-gradient(1.5px 1.5px at 160px 60px,var(--star),transparent),
  radial-gradient(1px 1px at 200px 175px,var(--star),transparent),
  radial-gradient(1px 1px at 120px 215px,var(--star),transparent),
  radial-gradient(1.5px 1.5px at 290px 95px,var(--star),transparent),
  radial-gradient(1px 1px at 330px 200px,var(--star),transparent);
  background-size:340px 340px;background-repeat:repeat;animation:twinkle 5s ease-in-out infinite alternate;}
.stars.s2{background-size:230px 230px;opacity:.55;animation-duration:8s;animation-delay:1.2s;}
@keyframes twinkle{0%{opacity:.3;}100%{opacity:.95;}}
.planet{position:absolute;top:-50px;right:-40px;width:170px;height:170px;border-radius:50%;background:radial-gradient(circle at 35% 35%,var(--text) 0%,transparent 68%);opacity:.10;z-index:0;}
.card{position:relative;z-index:10;width:100%;max-width:360px;max-height:90vh;overflow-y:auto;padding:30px 26px;background:var(--card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:20px;box-shadow:0 24px 60px rgba(0,0,0,0.5);}
.gear{position:absolute;top:16px;right:16px;width:34px;height:34px;border-radius:9px;background:var(--field);border:1px solid var(--border);color:var(--text);font-size:15px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.3s;z-index:11;}
.gear:hover{transform:rotate(60deg);}
.gear.hidden{display:none;}
.header{text-align:center;margin-bottom:22px;}
.logo{display:inline-flex;align-items:center;justify-content:center;width:54px;height:54px;border-radius:50%;border:1px solid var(--border);background:var(--field);margin-bottom:12px;color:var(--text);animation:spin 14s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
.header h2{font-weight:700;font-size:24px;letter-spacing:2px;}
.header p{color:var(--muted);font-size:13px;margin-top:5px;letter-spacing:.5px;}
.tabs{display:flex;background:var(--field);border:1px solid var(--border);border-radius:11px;padding:4px;margin-bottom:18px;}
.tab{flex:1;text-align:center;padding:10px;border-radius:8px;color:var(--muted);font-size:13.5px;font-weight:600;cursor:pointer;transition:.2s;user-select:none;}
.tab.active{background:var(--btn-bg);color:var(--btn-fg);}
.input-group{position:relative;margin-bottom:14px;}
.input-group input{width:100%;padding:13px 15px;background:var(--field);border:1px solid var(--border);border-radius:11px;outline:none;color:var(--text);font-size:14.5px;transition:.2s;letter-spacing:.3px;}
.input-group input::placeholder{color:var(--muted);}
.input-group input:focus{border-color:var(--text);}
.btn{width:100%;padding:13px;border:none;border-radius:11px;background:var(--btn-bg);color:var(--btn-fg);font-weight:600;font-size:14.5px;cursor:pointer;transition:.2s;letter-spacing:.5px;font-family:inherit;}
.btn:hover{opacity:.88;transform:translateY(-1px);}
.btn:active{transform:translateY(0);}
.btn[disabled]{opacity:.5;cursor:not-allowed;transform:none;}
.btn-ghost{width:100%;padding:11px;border:1px solid var(--border);border-radius:11px;background:transparent;color:var(--muted);font-weight:600;font-size:13px;cursor:pointer;margin-top:9px;transition:.2s;letter-spacing:.5px;font-family:inherit;}
.btn-ghost:hover{color:var(--text);border-color:var(--text);}
.welcome{font-size:15px;margin-bottom:6px;text-align:center;letter-spacing:.3px;}
.welcome b{font-weight:700;}
.meta{color:var(--muted);font-size:12px;text-align:center;margin:11px 0;letter-spacing:.3px;}
.links{list-style:none;margin:14px 0 6px;max-height:38vh;overflow-y:auto;}
.links li{display:flex;align-items:center;gap:8px;background:var(--field);border:1px solid var(--border);border-radius:10px;padding:9px 11px;margin-bottom:8px;}
.links a{flex:1;color:var(--text);font-size:12px;text-decoration:none;word-break:break-all;opacity:.9;}
.links a:hover{text-decoration:underline;opacity:1;}
.blk{flex:none;background:transparent;border:1px solid var(--border);color:var(--muted);font-size:11px;border-radius:7px;padding:5px 9px;cursor:pointer;white-space:nowrap;transition:.2s;font-family:inherit;}
.blk:hover{border-color:var(--text);color:var(--text);}
.blk.confirm{background:var(--text);color:var(--bg);border-color:var(--text);}
.flabel{display:block;color:var(--muted);font-size:11px;font-weight:600;margin-bottom:9px;text-transform:uppercase;letter-spacing:1px;}
.themes{display:flex;gap:10px;margin-bottom:18px;}
.swatch{flex:1;height:46px;border-radius:11px;border:2px solid transparent;cursor:pointer;transition:.2s;outline:1px solid var(--border);}
.swatch.sel{border-color:var(--text);}
.swatch.void{background:#000;}
.swatch.nebula{background:radial-gradient(circle at 35% 30%,#2a2a30,#000);}
.swatch.eclipse{background:#f4f4f5;}
.trow{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-top:1px solid var(--border);font-size:13.5px;}
.switch{width:44px;height:24px;border-radius:12px;border:1px solid var(--border);background:var(--field);position:relative;cursor:pointer;transition:.2s;}
.switch::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:var(--text);transition:.2s;}
.switch.on{background:var(--text);}
.switch.on::after{transform:translateX(20px);background:var(--bg);}
.stepper{display:flex;align-items:center;gap:5px;}
.stepper button{width:28px;height:28px;border-radius:8px;border:1px solid var(--border);background:var(--field);color:var(--text);font-size:16px;cursor:pointer;line-height:1;font-family:inherit;}
.stepper span{min-width:26px;text-align:center;font-weight:600;}
.msg{margin-top:13px;font-size:12.5px;text-align:center;border-radius:9px;padding:0;transition:.2s;letter-spacing:.3px;}
.msg.show{padding:9px 11px;}
.msg.err{background:rgba(239,68,68,0.16);border:1px solid rgba(239,68,68,0.4);color:var(--text);}
.msg.ok{background:rgba(255,255,255,0.1);border:1px solid var(--border);color:var(--text);}
.hidden{display:none!important;}
::-webkit-scrollbar{width:6px;}::-webkit-scrollbar-thumb{background:var(--border);border-radius:10px;}
</style>
</head>
<body data-theme="void">
<div class="stars"></div>
<div class="stars s2"></div>
<div class="planet"></div>

<div class="card">
  <button class="gear hidden" id="gearBtn" title="Settings">&#9881;</button>
  <div class="header">
    <div class="logo">
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="11" ry="4"/></svg>
    </div>
    <h2>voidEXT</h2>
    <p id="subtitle">Enter the void</p>
  </div>

  <!-- AUTH -->
  <div id="authView">
    <div class="tabs">
      <div class="tab active" id="tabLogin">Log in</div>
      <div class="tab" id="tabSignup">Sign up</div>
    </div>
    <form id="authForm" autocomplete="off">
      <div class="input-group"><input id="username" type="text" placeholder="Username" autocomplete="off" required></div>
      <div class="input-group"><input id="password" type="password" placeholder="Password" autocomplete="off" required></div>
      <button type="submit" class="btn" id="authBtn">Log in</button>
    </form>
  </div>

  <!-- DASHBOARD -->
  <div id="dashView" class="hidden">
    <div class="welcome">Welcome, <b id="who"></b></div>
    <div class="meta" id="poolMeta">Ready when you are.</div>
    <button class="btn" id="genBtn">Generate Links</button>
    <ul class="links" id="linkList"></ul>
    <button class="btn-ghost" id="logoutBtn">Log out</button>
  </div>

  <!-- SETTINGS -->
  <div id="setView" class="hidden">
    <span class="flabel">Theme</span>
    <div class="themes">
      <button class="swatch void" data-theme-pick="void" title="Void"></button>
      <button class="swatch nebula" data-theme-pick="nebula" title="Nebula"></button>
      <button class="swatch eclipse" data-theme-pick="eclipse" title="Eclipse"></button>
    </div>
    <div class="trow"><span>Open links in new tab</span><button class="switch" id="setNewTab"></button></div>
    <div class="trow"><span>Confirm before reporting</span><button class="switch" id="setConfirm"></button></div>
    <div class="trow"><span>Links per generate</span>
      <div class="stepper"><button id="batchMinus">&minus;</button><span id="batchVal">5</span><button id="batchPlus">+</button></div>
    </div>
    <button class="btn" id="saveBtn" style="margin-top:16px;">Save settings</button>
    <button class="btn-ghost" id="backBtn">Back</button>
  </div>

  <div class="msg" id="msg"></div>
</div>

<script>
(function(){
  var API='${API_BASE}', TOKEN_KEY='voidext_token';
  var DEFAULTS={theme:'void',openInNewTab:true,batchSize:5,confirmReport:false};
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

  function applyTheme(t){document.body.setAttribute('data-theme',t||'void');}
  function applySettings(s){state.settings=Object.assign({},DEFAULTS,s||{});applyTheme(state.settings.theme);}

  function show(view){
    $('authView').classList.toggle('hidden',view!=='auth');
    $('dashView').classList.toggle('hidden',view!=='dash');
    $('setView').classList.toggle('hidden',view!=='set');
    $('gearBtn').classList.toggle('hidden',view==='auth');
    var sub=$('subtitle');
    sub.textContent=view==='auth'?'Enter the void':(view==='set'?'Settings':'Your link station');
  }
  function showDash(username,links){
    if(username)$('who').textContent=username;
    show('dash');
    if(Array.isArray(links)&&links.length){
      renderLinks(links);
      $('genBtn').textContent='Regenerate Links';
      $('poolMeta').textContent='Your saved links ('+links.length+').';
    }else{
      $('linkList').innerHTML='';
      $('genBtn').textContent='Generate Links';
      $('poolMeta').textContent='Ready when you are.';
    }
  }

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
        setToken(res.data.token);applySettings(res.data.settings);clearMsg();showDash(res.data.username,res.data.links);
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
      $('genBtn').textContent='Regenerate Links';
      var meta='Pool: '+(res.data.poolSize||0)+' live links';
      meta+=res.data.rateLimit?(' · '+res.data.remaining+'/'+res.data.limit+' left today'):' · unlimited';
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

  $('gearBtn').onclick=function(){state.draft=Object.assign({},state.settings);paintSettings();clearMsg();show('set');};
  $('backBtn').onclick=function(){applyTheme(state.settings.theme);clearMsg();show('dash');};
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
  $('batchPlus').onclick=function(){state.draft.batchSize=Math.min(5,state.draft.batchSize+1);paintSettings();};
  $('saveBtn').onclick=function(){
    var b=$('saveBtn');b.disabled=true;msg('Saving...','');
    api('/api/settings',{method:'POST',body:{settings:state.draft}}).then(function(res){
      b.disabled=false;
      if(!res.ok){msg(res.data.error||'Could not save.','err');return;}
      applySettings(res.data.settings);msg('Settings saved.','ok');show('dash');
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };

  $('logoutBtn').onclick=function(){
    api('/api/logout',{method:'POST'});
    setToken('');applySettings(DEFAULTS);show('auth');setMode('login');msg('Logged out.','ok');
  };

  (function init(){
    setMode('login');applyTheme('void');
    if(token()){
      api('/api/me').then(function(res){
        if(res.ok){applySettings(res.data.settings);showDash(res.data.username,res.data.links);}
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
    'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:99999999;opacity:0;transition:opacity .25s ease;display:flex;justify-content:center;align-items:center;';

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  wrapper.style.cssText =
    'position:relative;width:400px;height:600px;max-width:94vw;max-height:94vh;background:transparent;border-radius:20px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.6);overflow:hidden;transform:scale(0.95);transition:transform .25s cubic-bezier(0.34,1.4,0.64,1);';

  const closeBtn = document.createElement('div');
  closeBtn.innerHTML = '&#x2715;';
  closeBtn.style.cssText =
    'position:absolute;top:16px;left:16px;width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.12);color:#fff;font-family:sans-serif;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.2s;z-index:100000000;user-select:none;';
  closeBtn.addEventListener('mouseenter', function () { closeBtn.style.background = 'rgba(255,255,255,0.3)'; });
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
