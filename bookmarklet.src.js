/* =============================================================================
 * Scale XT bookmarklet (readable source)
 * -----------------------------------------------------------------------------
 * Minimal black-and-white popup that works end to end:
 *   - Log in / Sign up against the Scale XT site
 *   - Links page: generate, copy, open, pin, and report
 *   - Settings page: theme + behavior toggles, saved to your account
 *   - Account page: username, member-since, role, and weekly usage percentage
 *
 * ALL UI renders inside the popup. NO alert()/confirm()/prompt().
 *
 * Build the one-line bookmark with:  node build-bookmarklet.js
 * ============================================================================= */
(function () {
  // <<< CONFIG >>> Point this at your deployed site (no trailing slash).
  const API_BASE = 'https://nebulabkmlinks.shop';
  const APP_URL = API_BASE + '/app.html?v=__VERSION__';

  const OVERLAY_ID = 'nebula-overlay';
  const WRAPPER_ID = 'nebula-wrapper';

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
<title>Scale XT</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:'Space Grotesk',system-ui,sans-serif;}
body{--a1:#a855f7;--a2:#ec4899;--a3:#38bdf8;--grad:linear-gradient(135deg,#a855f7 0%,#ec4899 100%);--grad3:linear-gradient(115deg,#818cf8 0%,#c084fc 32%,#f472b6 62%,#38bdf8 100%);--glow:rgba(168,85,247,0.5);--btn-bg:var(--grad);--btn-fg:#fff;--danger:#fb3b6b;}
body[data-theme="void"]{--bg:radial-gradient(ellipse at 50% -12%,#170d30 0%,#06030e 55%,#000 100%);--text:#fff;--muted:rgba(255,255,255,0.58);--card:rgba(255,255,255,0.05);--border:rgba(255,255,255,0.14);--field:rgba(255,255,255,0.07);--star:#fff;--side:rgba(255,255,255,0.03);}
body[data-theme="nebula"]{--bg:radial-gradient(circle at 22% 12%,#43208a 0%,#1d1145 40%,#0a0518 75%,#04020c 100%);--text:#fff;--muted:rgba(255,255,255,0.6);--card:rgba(255,255,255,0.07);--border:rgba(255,255,255,0.16);--field:rgba(255,255,255,0.09);--star:#e6dcff;--side:rgba(255,255,255,0.05);}
body[data-theme="eclipse"]{--bg:radial-gradient(circle at 30% -12%,#eef0ff 0%,#f4f4f8 55%);--text:#0a0a0a;--muted:rgba(0,0,0,0.55);--card:rgba(255,255,255,0.72);--border:rgba(80,40,140,0.16);--field:rgba(120,80,200,0.06);--star:rgba(130,90,210,0.4);--side:rgba(120,80,200,0.04);--glow:rgba(168,85,247,0.32);}
html,body{height:100%;}
body{background:var(--bg);color:var(--text);overflow:hidden;position:relative;transition:background .5s ease,color .5s ease;}
.neb{position:fixed;border-radius:50%;filter:blur(72px);opacity:.55;z-index:0;pointer-events:none;mix-blend-mode:screen;animation:drift 19s ease-in-out infinite alternate;}
.neb.n1{width:400px;height:400px;left:-90px;top:-70px;background:radial-gradient(circle,#7c3aed,transparent 70%);}
.neb.n2{width:360px;height:360px;right:-80px;top:28%;background:radial-gradient(circle,#ec4899,transparent 70%);animation-delay:-7s;}
.neb.n3{width:320px;height:320px;left:28%;bottom:-110px;background:radial-gradient(circle,#22d3ee,transparent 70%);animation-delay:-13s;}
body[data-theme="eclipse"] .neb{opacity:.3;mix-blend-mode:multiply;}
@keyframes drift{0%{transform:translate(0,0) scale(1);}100%{transform:translate(36px,-26px) scale(1.18);}}
.stars{position:fixed;inset:0;z-index:0;pointer-events:none;background-image:
  radial-gradient(1.6px 1.6px at 25px 35px,var(--star),transparent),
  radial-gradient(1px 1px at 90px 130px,var(--star),transparent),
  radial-gradient(1.6px 1.6px at 170px 60px,#c084fc,transparent),
  radial-gradient(1px 1px at 230px 180px,var(--star),transparent),
  radial-gradient(1px 1px at 320px 90px,#38bdf8,transparent),
  radial-gradient(1.6px 1.6px at 400px 200px,var(--star),transparent);
  background-size:440px 440px;background-repeat:repeat;animation:tw 6s ease-in-out infinite alternate;}
.stars.s2{background-size:280px 280px;opacity:.5;animation-duration:9s;animation-delay:1.5s;}
@keyframes tw{0%{opacity:.3;}100%{opacity:.95;}}
.shell{position:relative;z-index:1;height:100%;display:flex;align-items:center;justify-content:center;padding:18px;}

/* AUTH */
.authcard{position:relative;width:100%;max-width:360px;background:var(--card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:20px;padding:34px 28px;box-shadow:0 24px 60px -24px var(--glow),inset 0 1px 0 rgba(255,255,255,0.08);}
.authcard::before{content:"";position:absolute;inset:0;border-radius:20px;padding:1px;background:var(--grad3);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;opacity:.55;pointer-events:none;}
.brandhead{text-align:center;margin-bottom:22px;}
.logo{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;border:1px solid rgba(255,255,255,0.25);background:var(--grad);margin-bottom:12px;color:#fff;animation:spin 16s linear infinite;box-shadow:0 0 26px var(--glow);}
@keyframes spin{to{transform:rotate(360deg);}}
.brandhead h2{font-weight:700;font-size:25px;letter-spacing:3px;background:var(--grad3);-webkit-background-clip:text;background-clip:text;color:transparent;}
.brandhead p{color:var(--muted);font-size:13px;margin-top:5px;letter-spacing:.5px;}
.tabs{display:flex;background:var(--field);border:1px solid var(--border);border-radius:11px;padding:4px;margin-bottom:18px;}
.tab{flex:1;text-align:center;padding:10px;border-radius:8px;color:var(--muted);font-size:13.5px;font-weight:600;cursor:pointer;transition:.2s;user-select:none;}
.tab.active{background:var(--btn-bg);color:var(--btn-fg);}
input{width:100%;padding:13px 15px;background:var(--field);border:1px solid var(--border);border-radius:11px;outline:none;color:var(--text);font-size:14.5px;margin-bottom:13px;letter-spacing:.3px;}
input::placeholder{color:var(--muted);}
input:focus{border-color:var(--a1);box-shadow:0 0 0 3px rgba(168,85,247,0.18);}
textarea{width:100%;min-height:120px;resize:vertical;padding:13px 15px;background:var(--field);border:1px solid var(--border);border-radius:11px;outline:none;color:var(--text);font-size:14px;line-height:1.5;font-family:inherit;}
textarea::placeholder{color:var(--muted);}
textarea:focus{border-color:var(--a1);box-shadow:0 0 0 3px rgba(168,85,247,0.18);}

/* APP */
.app{width:100%;height:100%;display:flex;background:var(--card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:18px;overflow:hidden;}
.side{width:210px;flex:none;background:var(--side);border-right:1px solid var(--border);padding:22px 16px;display:flex;flex-direction:column;}
.side .brand{display:flex;align-items:center;gap:9px;font-weight:700;font-size:18px;letter-spacing:2px;margin-bottom:26px;padding:0 6px;}
.side .brand .nm{background:var(--grad3);-webkit-background-clip:text;background-clip:text;color:transparent;}
.side .brand .d{width:20px;height:20px;border-radius:50%;border:1px solid rgba(255,255,255,0.3);background:var(--grad);box-shadow:0 0 12px var(--glow);flex:none;}
.navitem{display:flex;align-items:center;gap:10px;width:100%;padding:12px 14px;border:none;background:transparent;color:var(--muted);font-size:14px;font-weight:600;border-radius:10px;cursor:pointer;transition:.18s;text-align:left;font-family:inherit;letter-spacing:.3px;margin-bottom:4px;}
.navitem:hover{background:var(--field);color:var(--text);}
.navitem.active{background:var(--btn-bg);color:var(--btn-fg);box-shadow:0 8px 20px -8px var(--glow);}
.navitem .ic{width:18px;height:18px;flex:none;display:inline-flex;align-items:center;justify-content:center;}
.navitem .ic svg{width:16px;height:16px;display:block;}
.side .spacer{flex:1;}
.navitem.logout{color:var(--muted);}
.navitem.logout:hover{background:rgba(251,59,107,0.18);color:var(--text);}
.badge{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;margin-left:auto;box-shadow:0 0 10px rgba(251,59,107,0.55);}
.navitem.active .badge{background:rgba(255,255,255,0.92);color:var(--a1);box-shadow:none;}
.rep-item{display:flex;align-items:center;gap:11px;background:var(--field);border:1px solid var(--border);border-radius:11px;padding:12px 14px;margin-bottom:9px;cursor:pointer;user-select:none;}
.rep-item .chk{width:20px;height:20px;border-radius:6px;border:1.5px solid var(--border);flex:none;display:flex;align-items:center;justify-content:center;font-size:13px;}
.rep-item.sel{border-color:var(--a1);}
.rep-item.sel .chk{background:var(--grad);color:#fff;border-color:transparent;box-shadow:0 0 10px var(--glow);}
.rep-item .lbl{flex:1;font-size:13px;}
.notif{display:flex;gap:10px;align-items:flex-start;background:var(--field);border:1px solid var(--border);border-radius:11px;padding:13px 15px;margin-bottom:9px;}
.notif .body{flex:1;}
.notif .nt{font-size:13px;line-height:1.5;}
.notif.ann{border-color:var(--a1);background:var(--card);box-shadow:0 0 24px -12px var(--glow);}
.ntag{display:inline-block;font-size:9.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:2px 7px;border-radius:6px;background:var(--grad);color:#fff;margin-right:7px;vertical-align:1px;}
.notif .nd{font-size:11px;color:var(--muted);margin-top:6px;}
.notif .mark{flex:none;background:transparent;border:1px solid var(--border);color:var(--muted);font-size:11px;border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap;font-family:inherit;}
.notif .mark:hover{border-color:var(--text);color:var(--text);}
.suggest{position:absolute;top:100%;left:0;right:0;background:var(--bg);border:1px solid var(--border);border-radius:11px;margin-top:4px;max-height:200px;overflow:auto;z-index:20;}
.suggest .s{padding:10px 13px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);}
.suggest .s:hover,.suggest .s.hl{background:var(--field);}
.suggest .s b{font-weight:700;}
.main{flex:1;padding:30px 32px;overflow-y:auto;position:relative;}
.ptitle{font-size:22px;font-weight:700;letter-spacing:.5px;background:var(--grad3);-webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block;}
.psub{color:var(--muted);font-size:13px;margin-top:4px;margin-bottom:22px;letter-spacing:.3px;}
.actions{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;}
.btn{padding:12px 18px;border:none;border-radius:11px;background:var(--btn-bg);color:var(--btn-fg);font-weight:600;font-size:14px;cursor:pointer;transition:transform .2s,box-shadow .2s,opacity .2s;letter-spacing:.4px;font-family:inherit;box-shadow:0 6px 18px -8px var(--glow);}
.btn:hover{transform:translateY(-2px);box-shadow:0 14px 28px -8px var(--glow);}
.btn:active{transform:translateY(0);}
.btn[disabled]{opacity:.5;cursor:not-allowed;transform:none;box-shadow:none;}
.btn.ghost{background:transparent;border:1px solid var(--border);color:var(--text);box-shadow:none;}
.btn.ghost:hover{border-color:var(--a1);color:var(--text);box-shadow:0 8px 20px -12px var(--glow);}
.meter{margin:16px 0 6px;color:var(--muted);font-size:12.5px;letter-spacing:.3px;}
.bar{height:6px;border-radius:6px;background:var(--field);overflow:hidden;margin-top:7px;max-width:260px;}
.bar > i{display:block;height:100%;background:var(--grad);transition:width .3s;}
.links{list-style:none;margin:18px 0 6px;display:flex;flex-direction:column;gap:9px;}
.links li{display:flex;align-items:center;gap:10px;background:var(--field);border:1px solid var(--border);border-radius:11px;padding:12px 14px;}
.links li.pinned{border-left:3px solid var(--a1);background:linear-gradient(90deg,rgba(168,85,247,0.12),var(--field) 42%);box-shadow:-6px 0 16px -10px var(--glow);}
.links a{flex:1;color:var(--text);font-size:12.5px;text-decoration:none;word-break:break-all;opacity:.92;}
.links a:hover{text-decoration:underline;opacity:1;}
.lact{flex:none;width:30px;height:30px;display:inline-flex;align-items:center;justify-content:center;background:transparent;border:1px solid var(--border);color:var(--muted);border-radius:8px;cursor:pointer;transition:.2s;padding:0;}
.lact:hover{border-color:var(--a1);color:var(--text);}
.lact svg{width:14px;height:14px;display:block;}
.lact.on{background:var(--grad);color:#fff;border-color:transparent;box-shadow:0 0 12px var(--glow);}
.lact.confirm{background:var(--danger);color:#fff;border-color:var(--danger);}
.blk{flex:none;background:transparent;border:1px solid var(--border);color:var(--muted);font-size:11px;border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap;transition:.2s;font-family:inherit;}
.blk:hover{border-color:var(--text);color:var(--text);}
.blk.confirm{background:var(--text);color:var(--bg);border-color:var(--text);}
.empty{color:var(--muted);font-size:13px;padding:14px 0;}
.flabel{display:block;color:var(--muted);font-size:11px;font-weight:600;margin:0 0 10px;text-transform:uppercase;letter-spacing:1px;}
.themes{display:flex;gap:12px;margin-bottom:22px;max-width:360px;}
.swatch{flex:1;height:62px;border-radius:12px;border:2px solid transparent;cursor:pointer;transition:.2s;outline:1px solid var(--border);position:relative;overflow:hidden;}
.swatch:hover{transform:translateY(-2px);}
.swatch.sel{border-color:var(--a1);box-shadow:0 0 0 1px var(--a1),0 10px 24px -10px var(--glow);}
.swatch span{position:absolute;bottom:6px;left:0;right:0;text-align:center;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#fff;mix-blend-mode:difference;}
.swatch.void{background:radial-gradient(ellipse at 50% 0%,#1b1136,#000 72%);}
.swatch.nebula{background:radial-gradient(circle at 30% 25%,#7c3aed,#3b1d6e 45%,#08040f 88%);}
.swatch.eclipse{background:radial-gradient(circle at 30% 20%,#eef0ff,#dfe1f0);}
.trow{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-top:1px solid var(--border);font-size:14px;max-width:420px;}
.switch{width:46px;height:25px;border-radius:13px;border:1px solid var(--border);background:var(--field);position:relative;cursor:pointer;transition:.2s;}
.switch::after{content:"";position:absolute;top:2px;left:2px;width:19px;height:19px;border-radius:50%;background:var(--text);transition:.2s;}
.switch.on{background:var(--grad);border-color:transparent;box-shadow:0 0 12px var(--glow);}
.switch.on::after{transform:translateX(21px);background:#fff;}
.info{max-width:420px;}
.inforow{display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid var(--border);font-size:14px;}
.inforow:first-child{border-top:none;}
.inforow .k{color:var(--muted);letter-spacing:.3px;}
.inforow .v{font-weight:600;}
.bignum{font-size:42px;font-weight:700;letter-spacing:1px;}
.msg{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);font-size:13px;padding:0;border-radius:10px;transition:.2s;z-index:50;max-width:90%;}
.msg.show{padding:11px 16px;}
.msg{box-shadow:0 12px 30px -10px rgba(0,0,0,0.5);}
.msg.err{background:var(--danger);color:#fff;}
.msg.ok{background:var(--btn-bg);color:var(--btn-fg);box-shadow:0 12px 30px -10px var(--glow);}
.hidden{display:none!important;}
/* MESSAGES — conversation list + chat thread */
.convo{display:flex;align-items:center;gap:12px;background:var(--field);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:9px;cursor:pointer;transition:.15s;}
.convo:hover{border-color:var(--a1);box-shadow:0 8px 22px -14px var(--glow);}
.convo .av{width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,0.18);background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:15px;flex:none;text-transform:uppercase;box-shadow:0 0 16px -4px var(--glow);}
.convo .cmid{flex:1;min-width:0;}
.convo .cname{font-size:14px;font-weight:600;}
.convo .cprev{font-size:12px;color:var(--muted);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.convo .cprev.un{color:var(--text);font-weight:600;}
.convo .cmeta{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex:none;}
.convo .ctime{font-size:10.5px;color:var(--muted);white-space:nowrap;}
.convo .cunread{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:var(--danger);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(251,59,107,0.55);}
.chathead{display:flex;align-items:center;gap:11px;margin-bottom:14px;}
.chatback{background:transparent;border:1px solid var(--border);color:var(--text);width:34px;height:34px;border-radius:9px;font-size:22px;line-height:1;cursor:pointer;font-family:inherit;flex:none;display:flex;align-items:center;justify-content:center;padding-bottom:3px;}
.chatback:hover{border-color:var(--text);}
.chatwho{font-size:18px;font-weight:700;letter-spacing:.5px;}
.chatscroll{height:46vh;min-height:200px;max-height:430px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 2px;}
.bub{max-width:76%;padding:9px 13px;border-radius:15px;font-size:13.5px;line-height:1.45;word-break:break-word;white-space:pre-wrap;}
.bub .bt{display:block;font-size:10px;margin-top:5px;letter-spacing:.3px;opacity:.6;}
.bub.them{align-self:flex-start;background:var(--field);border:1px solid var(--border);border-bottom-left-radius:5px;}
.bub.them .bt{color:var(--muted);opacity:1;}
.bub.me{align-self:flex-end;background:var(--btn-bg);color:var(--btn-fg);border-bottom-right-radius:5px;}
.bub.typing{display:flex;gap:5px;align-items:center;padding:13px 15px;}
.bub.typing span{width:6px;height:6px;border-radius:50%;background:var(--muted);display:inline-block;animation:typedot 1.2s infinite ease-in-out;}
.bub.typing span:nth-child(2){animation-delay:.18s;}
.bub.typing span:nth-child(3){animation-delay:.36s;}
@keyframes typedot{0%,60%,100%{transform:translateY(0);opacity:.35;}30%{transform:translateY(-5px);opacity:1;}}
.pdot{width:9px;height:9px;border-radius:50%;background:#9ca3af;display:inline-block;flex:none;}
.pdot.on{background:#22c55e;box-shadow:0 0 7px rgba(34,197,94,.65);}
.pstatus{font-size:11px;color:var(--muted);letter-spacing:.3px;}
.convo .cname{display:flex;align-items:center;gap:7px;}
.cprev .typing-txt{color:#22c55e;font-style:italic;}
.cprev .typing-txt .td{animation:lpulseDots 1.2s steps(1,end) infinite;}
@keyframes lpulseDots{0%{opacity:.2;}50%{opacity:1;}100%{opacity:.2;}}
.chatcompose{display:flex;gap:9px;align-items:center;margin-top:12px;}
.chatcompose input{margin-bottom:0;flex:1;}
.chatcompose .btn{flex:none;}
.chatempty{color:var(--muted);font-size:13px;text-align:center;padding:30px 0;}
/* LOADING SCREEN — cinematic intro "cutscene" */
.loader{position:fixed;inset:0;z-index:45;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:var(--bg);overflow:hidden;transition:opacity .55s ease,transform .55s ease;}
.loader.fade{opacity:0;transform:scale(1.08);pointer-events:none;}
/* white-hot warp burst that flashes out from the centre */
.loader .warp{position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:50%;transform:translate(-50%,-50%) scale(0);background:radial-gradient(circle,#fff 0%,#c084fc 28%,#38bdf8 48%,transparent 72%);opacity:0;animation:warp 1.5s ease-out forwards;}
@keyframes warp{0%{opacity:0;transform:translate(-50%,-50%) scale(0);}10%{opacity:.95;}40%{opacity:.4;}100%{opacity:0;transform:translate(-50%,-50%) scale(70);}}
/* orbit: a planet with a spinning ring, scales + whirls into place */
.loader .orbit{position:relative;width:92px;height:92px;animation:orbIn .9s cubic-bezier(.2,1.25,.4,1) both;}
.loader .orbit::before{content:"";position:absolute;inset:0;border-radius:50%;border:1.5px solid var(--border);}
@keyframes orbIn{0%{opacity:0;transform:scale(.2) rotate(-140deg);}100%{opacity:1;transform:scale(1) rotate(0);}}
.loader .ringline{position:absolute;inset:0;border-radius:50%;border:2px solid transparent;border-top-color:var(--a1);border-right-color:var(--a2);border-bottom-color:var(--a3);animation:lspin .8s linear infinite;}
.loader .planet{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:var(--grad);box-shadow:0 0 26px 6px var(--glow);animation:pulseGlow 1.5s ease-in-out infinite;}
@keyframes pulseGlow{0%,100%{transform:scale(.82);opacity:.8;}50%{transform:scale(1.12);opacity:1;}}
@keyframes lspin{to{transform:rotate(360deg);}}
/* brand: blurred wide letters snap in, then a light sheen sweeps across */
.loader .lbrand{font-weight:700;font-size:30px;letter-spacing:10px;padding-left:10px;background:linear-gradient(100deg,#818cf8 15%,#c084fc 35%,#f472b6 55%,#38bdf8 80%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:brandIn .7s ease both .3s,sheen 2.4s linear infinite 1s;}
@keyframes brandIn{0%{opacity:0;letter-spacing:26px;filter:blur(9px);}100%{opacity:1;letter-spacing:10px;filter:blur(0);}}
@keyframes sheen{0%{background-position:130% 0;}100%{background-position:-130% 0;}}
.updbar{position:fixed;top:0;left:0;right:0;z-index:60;background:var(--grad);color:#fff;font-size:11.5px;text-align:center;padding:8px 12px;letter-spacing:.3px;font-weight:600;cursor:pointer;box-shadow:0 4px 20px -4px var(--glow);}
.updbar:hover{filter:brightness(1.08);}
.updbar b{font-weight:700;}
.updmodal{position:fixed;inset:0;z-index:70;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;}
.updcard{position:relative;width:100%;max-width:440px;max-height:88%;overflow-y:auto;background:var(--card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--border);border-radius:16px;padding:26px 24px;}
.updclose{position:absolute;top:12px;right:14px;width:28px;height:28px;border-radius:8px;background:var(--field);color:var(--text);display:flex;align-items:center;justify-content:center;font-size:12px;cursor:pointer;}
.updclose:hover{background:rgba(239,68,68,0.7);color:#fff;}
.updh{font-size:20px;font-weight:700;letter-spacing:.5px;}
.updver{color:var(--muted);font-size:13px;margin-top:4px;margin-bottom:16px;}
.updsteps{margin:0 0 16px 18px;font-size:13px;line-height:1.8;color:var(--text);}
.updsteps b{font-weight:700;}
.updbox{background:var(--field);border:1px dashed var(--border);border-radius:11px;padding:13px;font-family:ui-monospace,monospace;font-size:10.5px;max-height:130px;overflow:auto;word-break:break-all;color:var(--muted);user-select:all;}
::-webkit-scrollbar{width:7px;}::-webkit-scrollbar-thumb{background:var(--grad);border-radius:10px;}
@media(max-width:640px){
  .app{flex-direction:column;}
  .side{width:100%;flex-direction:row;align-items:center;border-right:none;border-bottom:1px solid var(--border);padding:12px;overflow-x:auto;}
  .side .brand{margin-bottom:0;margin-right:8px;font-size:15px;}
  .navitem{margin-bottom:0;padding:9px 11px;font-size:12.5px;white-space:nowrap;}
  .side .spacer{flex:0;}
  .main{padding:20px 18px;}
}

/* CELESTIAL ALMANAC — warm editorial redesign */
*{font-family:'Instrument Sans','Segoe UI',sans-serif;}
body{
  --paper:#f2efe5;--paper-deep:#e6e1d4;--ink:#171a17;--moss:#244333;--moss-deep:#13251c;
  --acid:#d8ff72;--sage:#c8d3c4;--clay:#c86f55;--danger:#bc513e;
  --a1:var(--acid);--a2:var(--acid);--a3:var(--clay);--grad:var(--acid);--grad3:var(--text);
  --btn-bg:var(--acid);--btn-fg:var(--ink);--glow:rgba(16,35,25,.16);
}
body[data-theme="void"]{--bg:#111b15;--text:#f2efe5;--muted:rgba(242,239,229,.58);--card:#17241c;--border:rgba(242,239,229,.17);--field:rgba(242,239,229,.055);--star:rgba(216,255,114,.48);--side:#0d1611;}
body[data-theme="nebula"]{--bg:#294434;--text:#f4f0e6;--muted:rgba(244,240,230,.64);--card:#345443;--border:rgba(244,240,230,.18);--field:rgba(244,240,230,.07);--star:rgba(216,255,114,.55);--side:#20382a;}
body[data-theme="eclipse"]{--bg:#f2efe5;--text:#171a17;--muted:rgba(23,26,23,.57);--card:#f7f4eb;--border:rgba(23,26,23,.18);--field:rgba(23,26,23,.045);--star:rgba(36,67,51,.3);--side:#e4e8dc;--glow:rgba(36,67,51,.12);--btn-bg:#244333;--btn-fg:#f2efe5;--a1:#244333;}
body{background:var(--bg);letter-spacing:0;}
body::after{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.025;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.88' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
::selection{background:var(--a1);color:var(--ink);}
.neb{filter:none;mix-blend-mode:normal;background:transparent!important;border:1px solid var(--border);opacity:.75;animation:almanacDrift 14s ease-in-out infinite alternate;}
.neb.n1{width:480px;height:480px;left:auto;right:-250px;top:-300px;}
.neb.n2{width:320px;height:320px;right:auto;left:-190px;top:auto;bottom:-170px;animation-delay:-5s;}
.neb.n3{display:none;}
body[data-theme="eclipse"] .neb{opacity:.8;mix-blend-mode:normal;}
@keyframes almanacDrift{to{transform:translate(12px,-9px) rotate(4deg)}}
.stars{opacity:.22;background-image:radial-gradient(1px 1px at 25px 35px,var(--star),transparent),radial-gradient(1px 1px at 170px 60px,var(--star),transparent),radial-gradient(1px 1px at 320px 90px,var(--star),transparent);background-size:390px 390px;animation:none;}
.stars.s2{opacity:.11;background-size:240px 240px;}
.shell{padding:14px;}

.authcard{max-width:410px;background:var(--card);border:1px solid var(--border);border-radius:4px;padding:38px 34px;box-shadow:12px 12px 0 rgba(4,12,7,.28);backdrop-filter:none;}
.authcard::before{content:"PRIVATE / MEMBER ACCESS";inset:auto auto calc(100% + 13px) 0;width:auto;height:auto;padding:0;background:none;color:var(--muted);font-size:9px;font-weight:700;letter-spacing:.16em;-webkit-mask:none;mask:none;opacity:1;}
.brandhead{text-align:left;margin-bottom:27px;position:relative;}
.logo{width:52px;height:52px;border:1px solid var(--text);border-radius:50%;background:transparent;margin-bottom:28px;color:var(--text);animation:none;box-shadow:none;}
.logo::before{content:"";position:absolute;width:68px;height:20px;border:1px solid currentColor;border-radius:50%;transform:rotate(-17deg);}
.logo::after{content:"";position:absolute;width:6px;height:6px;border-radius:50%;background:var(--a1);margin:0 0 34px 52px;}
.brandhead h2{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:48px;line-height:.9;letter-spacing:-.045em;background:none;color:var(--text);}
.brandhead p{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:15px;letter-spacing:0;margin-top:9px;}
.tabs{background:transparent;border:0;border-bottom:1px solid var(--border);border-radius:0;padding:0;margin-bottom:22px;}
.tab{padding:10px 0;border-radius:0;font-size:11px;text-transform:uppercase;letter-spacing:.1em;}
.tab.active{background:transparent;color:var(--text);box-shadow:inset 0 -2px 0 var(--a1);}
input,textarea{background:var(--field);border:1px solid var(--border);border-radius:0;color:var(--text);font-size:14px;letter-spacing:0;transition:border-color .18s,box-shadow .18s;}
input{padding:14px;margin-bottom:11px;}
textarea{padding:14px;}
input:focus,textarea:focus{border-color:var(--a1);box-shadow:0 0 0 3px color-mix(in srgb,var(--a1) 14%,transparent);}

.app{background:var(--card);border:1px solid var(--border);border-radius:7px;box-shadow:0 28px 70px -35px rgba(0,0,0,.48);backdrop-filter:none;}
.side{width:208px;background:var(--side);border-right:1px solid var(--border);padding:21px 15px 16px;}
.side .brand{font-size:17px;letter-spacing:-.03em;margin-bottom:23px;padding:0 6px 19px;border-bottom:1px solid var(--border);}
.side .brand .nm{background:none;color:var(--text);}
.side .brand .d{position:relative;width:20px;height:20px;border:1px solid var(--text);background:transparent;box-shadow:none;}
.side .brand .d::before{content:"";position:absolute;left:50%;top:50%;width:28px;height:8px;border:1px solid currentColor;border-radius:50%;transform:translate(-50%,-50%) rotate(-17deg);}
.side .brand .d::after{content:"";position:absolute;width:4px;height:4px;border-radius:50%;background:var(--a1);right:-3px;top:0;}
.navitem{min-height:40px;padding:10px 11px;border-radius:0;color:var(--muted);font-size:12.5px;font-weight:500;letter-spacing:0;margin-bottom:3px;}
.navitem:hover{background:var(--field);color:var(--text);}
.navitem.active{background:var(--btn-bg);color:var(--btn-fg);box-shadow:3px 3px 0 rgba(0,0,0,.28);}
.navitem .ic{opacity:.82;}
.badge{height:18px;min-width:18px;border-radius:50%;background:var(--clay);box-shadow:none;}
.navitem.active .badge{background:var(--moss);color:var(--acid);}
.navitem.logout:hover{background:rgba(200,111,85,.14);}
.main{padding:35px 38px;}
.ptitle{display:block;font-family:'Instrument Serif',Georgia,serif;font-size:42px;font-weight:400;line-height:.95;letter-spacing:-.045em;background:none;color:var(--text);}
.psub{font-size:12.5px;line-height:1.5;letter-spacing:0;margin:8px 0 26px;max-width:590px;}
.login-requirement{display:flex;align-items:flex-start;gap:11px;max-width:620px;margin:-11px 0 18px;padding:12px 14px;border:1px solid var(--border);border-left:3px solid var(--a1);background:color-mix(in srgb,var(--a1) 6%,var(--field));}
.login-requirement svg{width:17px;height:17px;flex:none;color:var(--a1);margin-top:1px;}
.login-requirement strong{display:block;margin-bottom:3px;font-size:10px;line-height:1.2;letter-spacing:.11em;text-transform:uppercase;color:var(--text);}
.login-requirement span{display:block;font-size:12px;line-height:1.45;color:var(--muted);}
.login-requirement b{color:var(--text);font-weight:600;}
.actions{gap:8px;margin-bottom:10px;}
.btn{min-height:40px;padding:10px 15px;border:1px solid var(--text);border-radius:0;background:var(--btn-bg);color:var(--btn-fg);font-weight:600;font-size:12px;letter-spacing:0;box-shadow:3px 3px 0 rgba(0,0,0,.28);}
.btn:hover{transform:translate(2px,2px);box-shadow:1px 1px 0 rgba(0,0,0,.28);}
.btn.ghost{background:transparent;border:1px solid var(--border);color:var(--text);box-shadow:none;}
.btn.ghost:hover{border-color:var(--text);background:var(--field);box-shadow:none;transform:none;}
.meter{margin:20px 0 7px;font-size:11px;}
.bar{height:4px;border-radius:0;max-width:320px;}
.bar>i{background:var(--a1);}
.links{margin-top:20px;gap:7px;}
.links li{min-height:49px;background:var(--field);border:1px solid var(--border);border-radius:0;padding:9px 11px;transition:transform .16s,border-color .16s;}
.links li:hover{transform:translateX(3px);border-color:var(--text);}
.links li.pinned{border-left:3px solid var(--a1);background:var(--field);box-shadow:none;}
.links a{font-size:12px;text-decoration:none;}
.lact{border-radius:0;width:29px;height:29px;}
.lact.on{background:var(--a1);color:var(--ink);border-color:var(--a1);box-shadow:none;}
.blk{border-radius:0;padding:6px 9px;font-size:10px;}
.rep-item,.notif,.convo{background:var(--field);border:1px solid var(--border);border-radius:0;box-shadow:none;}
.rep-item.sel{border-color:var(--a1);box-shadow:inset 3px 0 0 var(--a1);}
.rep-item .chk{border-radius:0;}
.rep-item.sel .chk{background:var(--a1);color:var(--ink);box-shadow:none;}
.notif.ann{border-color:var(--a1);box-shadow:none;}
.ntag{border-radius:0;background:var(--a1);color:var(--ink);}
.suggest{background:var(--card);border:1px solid var(--text);border-radius:0;box-shadow:4px 4px 0 rgba(0,0,0,.3);}

.themes{max-width:430px;gap:9px;}
.swatch{height:74px;border-radius:0;outline:1px solid var(--border);}
.swatch.sel{border-color:var(--a1);box-shadow:3px 3px 0 var(--a1);}
.swatch.void{background:#111b15;}
.swatch.nebula{background:#294434;}
.swatch.eclipse{background:#f2efe5;}
.swatch span{font-size:9px;mix-blend-mode:normal;color:var(--text);background:rgba(0,0,0,.28);padding:4px 0;bottom:0;}
.swatch.eclipse span{color:var(--ink);background:rgba(255,255,255,.75);}
.trow{max-width:480px;padding:16px 0;}
.switch{width:44px;height:24px;border-radius:20px;}
.switch::after{width:18px;height:18px;}
.switch.on{background:var(--a1);box-shadow:none;}
.switch.on::after{background:var(--ink);}
.info{max-width:500px;}
.inforow{padding:16px 0;}
.bignum{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:54px;letter-spacing:-.04em;}
.empty{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-size:15px;}

.convo{border-radius:0;padding:11px 12px;}
.convo:hover{border-color:var(--text);box-shadow:none;transform:translateX(3px);}
.convo .av{border:1px solid var(--border);background:var(--a1);color:var(--ink);box-shadow:none;}
.chatscroll{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:16px 2px;}
.chatback{border-radius:0;}
.chatwho{font-family:'Instrument Serif',Georgia,serif;font-size:24px;font-weight:400;}
.bub{border-radius:12px;}
.bub.them{background:var(--field);border-bottom-left-radius:0;}
.bub.me{background:var(--btn-bg);color:var(--btn-fg);border-bottom-right-radius:0;}
.pdot.on{background:var(--acid);box-shadow:none;}
.cprev .typing-txt{color:var(--a1);}

.msg{border-radius:0;}
.msg.err{background:var(--danger);}
.msg.ok{background:var(--a1);color:var(--ink);box-shadow:4px 4px 0 rgba(0,0,0,.3);}
.loader{background:var(--bg);gap:20px;}
.loader.fade{transform:scale(1.02);}
.loader .warp{display:none;}
.loader .orbit{width:84px;height:84px;}
.loader .orbit::before{border-color:var(--border);}
.loader .ringline{border:1px solid transparent;border-top-color:var(--a1);border-right-color:var(--a1);animation-duration:1.8s;}
.loader .planet{width:14px;height:14px;margin:-7px 0 0 -7px;background:var(--a1);box-shadow:none;}
.loader .lbrand{font-family:'Instrument Serif',Georgia,serif;font-size:34px;font-weight:400;letter-spacing:2px;padding-left:0;background:none;color:var(--text);animation:brandIn .7s ease both .3s;}
@keyframes brandIn{from{opacity:0;letter-spacing:10px;filter:blur(5px)}to{opacity:1;letter-spacing:2px;filter:none}}
.updbar{background:var(--a1);color:var(--ink);box-shadow:none;}
.updmodal{background:rgba(11,20,14,.72);}
.updcard{background:var(--card);border-radius:0;backdrop-filter:none;box-shadow:10px 10px 0 rgba(0,0,0,.3);}
.updclose,.updbox{border-radius:0;}
.updh{font-family:'Instrument Serif',Georgia,serif;font-size:30px;font-weight:400;}

*:focus-visible{outline:2px solid var(--a1);outline-offset:2px;}
::-webkit-scrollbar{width:8px;height:8px;}
::-webkit-scrollbar-track{background:var(--side);}
::-webkit-scrollbar-thumb{background:var(--muted);border:2px solid var(--side);border-radius:0;}
@media(max-width:640px){
  .shell{padding:8px;}.app{border-radius:4px;}
  .side{padding:10px;border-bottom:1px solid var(--border);}
  .side .brand{padding:0 12px 0 4px;border-bottom:0;border-right:1px solid var(--border);}
  .navitem{padding:9px 10px;}.main{padding:26px 19px;}.ptitle{font-size:37px;}
  .authcard{margin:18px;padding:30px 25px;}.brandhead h2{font-size:43px;}
}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;}}
/* __SCALE XT_V2__ */
</style>
</head>
<body data-theme="void">
<div class="neb n1"></div>
<div class="neb n2"></div>
<div class="neb n3"></div>
<div class="stars"></div>
<div class="stars s2"></div>
<div id="updateBar" class="updbar hidden"></div>
<div id="updModal" class="updmodal hidden">
  <div class="updcard">
    <div class="updclose" id="updClose">&#x2715;</div>
    <div class="updh">Update Scale XT</div>
    <div class="updver" id="updVer">—</div>
    <ol class="updsteps">
      <li>Right-click your <b>Scale XT</b> bookmark and choose <b>Edit</b>.</li>
      <li>Select everything in the <b>URL</b> field and replace it with the code below.</li>
      <li>Save, then re-open Scale XT. Done — no website needed.</li>
    </ol>
    <div class="updbox" id="updCode">Loading latest version…</div>
    <button class="btn" id="updCopy" style="width:100%;margin-top:12px;">Copy new bookmarklet</button>
  </div>
</div>
<div id="commandPalette" class="command-overlay hidden" role="dialog" aria-modal="true" aria-label="Quick actions">
  <div class="command-card">
    <div class="command-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input id="commandInput" type="text" placeholder="Go to or run an action…" autocomplete="off"><kbd>Esc</kbd></div>
    <div class="command-list" id="commandList">
      <button type="button" data-command="generate" data-search="generate new link route"><span class="command-icon">+</span><span><b>Generate a link</b><small>Create a new destination</small></span></button>
      <button type="button" data-command="links" data-search="links home routes"><span class="command-icon">↗</span><span><b>Links</b><small>Return to your workspace</small></span></button>
      <button type="button" data-command="report" data-search="report broken dead link"><span class="command-icon">!</span><span><b>Report links</b><small>Flag destinations that do not work</small></span></button>
      <button type="button" data-command="support" data-search="support bug report help"><span class="command-icon">?</span><span><b>New support report</b><small>Start a conversation about a problem</small></span></button>
      <button type="button" data-command="global" data-search="global public community room chat"><span class="command-icon">◎</span><span><b>Global chat</b><small>Talk with everyone in Scale XT</small></span></button>
      <button type="button" data-command="messages" data-search="messages conversation chat"><span class="command-icon">••</span><span><b>Messages</b><small>Open your conversations</small></span></button>
      <button type="button" data-command="notifications" data-search="notifications announcements alerts"><span class="command-icon">○</span><span><b>Notifications</b><small>See account and service updates</small></span></button>
      <button type="button" data-command="vault" data-search="vault status usage links"><span class="command-icon">□</span><span><b>Vault status</b><small>Check live link availability</small></span></button>
      <button type="button" data-command="updates" data-search="updates version release notes"><span class="command-icon">↑</span><span><b>Updates</b><small>Version status and release notes</small></span></button>
      <button type="button" data-command="settings" data-search="settings theme preferences"><span class="command-icon">◇</span><span><b>Settings</b><small>Theme and link behavior</small></span></button>
      <button type="button" data-command="account" data-search="account profile credits role"><span class="command-icon">@</span><span><b>Account</b><small>Usage, role, and security</small></span></button>
    </div>
    <div class="command-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div>
  </div>
</div><div id="maintenanceMode" class="maintenance-mode hidden" role="status" aria-live="polite">
  <div class="maintenance-card">
    <span class="maintenance-mark" aria-hidden="true"></span>
    <div class="maintenance-kicker">Scale XT status</div>
    <h1>Maintenance</h1>
    <p id="maintenanceNotice">Scale XT is temporarily unavailable while maintenance is in progress.</p>
    <div class="maintenance-foot"><span id="maintenanceSince">Check back shortly.</span><i>Updates automatically</i></div>
  </div>
</div>
<div id="loader" class="loader" aria-label="Loading">
  <span class="loader-circle" aria-hidden="true"></span>
</div>
<div class="shell">

  <!-- AUTH -->
  <div id="authWrap" class="authcard">
    <div class="brandhead">
      <div class="logo"><svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="11" ry="4"/></svg></div>
      <h2>Scale XT</h2>
      <p>Your private link workspace</p>
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
    <div class="authmsg" id="authMsg" role="status" aria-live="polite"></div>
  </div>

  <!-- APP -->
  <div id="app" class="app hidden">
    <aside class="side" aria-label="Primary navigation">
      <div class="brand" title="Scale XT"><span class="d"></span><span class="nm">Scale XT</span></div>
      <button class="navitem active" data-nav="links" data-label="Links" title="Links" aria-label="Links"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 14.5l5-5"/><path d="M11 6.5l1-1a3.5 3.5 0 0 1 5 5l-1 1"/><path d="M13 17.5l-1 1a3.5 3.5 0 0 1-5-5l1-1"/></svg></span><span class="navtext">Links</span></button>
      <button class="navitem" data-nav="global" data-label="Global chat" title="Global chat" aria-label="Global chat"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.3 2.3 3.4 5.1 3.4 8.5S14.3 18.2 12 20.5M12 3.5C9.7 5.8 8.6 8.6 8.6 12s1.1 6.2 3.4 8.5"/></svg></span><span class="navtext">Global chat</span><span class="badge hidden" id="globalBadge">New</span></button>
      <button class="navitem" data-nav="bug" data-label="Support" title="Support" aria-label="Support"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5.5h14v10H9l-4 3v-13z"/><path d="M8 9h8M8 12h5"/></svg></span><span class="navtext">Support</span><span class="badge hidden" id="bugBadge">0</span></button>
      <button class="navitem" data-nav="messages" data-label="Messages" title="Messages" aria-label="Messages"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a7 7 0 0 1-9.5 6.5L5 19.5l1.4-4A7 7 0 1 1 20 11.5z"/></svg></span><span class="navtext">Messages</span><span class="badge hidden" id="msgBadge">0</span></button>
      <div class="spacer"></div>
      <button class="navitem logout" id="logoutBtn" data-label="Log out" title="Log out" aria-label="Log out"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8V5.5A1.5 1.5 0 0 0 12.5 4H6A1.5 1.5 0 0 0 4.5 5.5v13A1.5 1.5 0 0 0 6 20h6.5a1.5 1.5 0 0 0 1.5-1.5V16"/><path d="M9.5 12h10M16.5 9l3 3-3 3"/></svg></span><span class="navtext">Log out</span></button>
    </aside>
    <div class="workspace">
      <header class="utilitybar">
        <div class="utility-context"><span>Workspace</span><strong id="utilityPage">Links</strong></div>
        <button class="command-trigger" id="commandBtn" type="button" aria-label="Open quick actions"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><span>Search or jump</span><kbd>Ctrl K</kbd></button>
        <nav class="utility-actions" aria-label="Tools">
          <button class="utility-btn" data-nav="report" title="Report links" aria-label="Report links"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h12l-2 3.5L17 11H5"/></svg></button>
          <button class="utility-btn" data-nav="notifs" title="Notifications" aria-label="Notifications"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.5 19.5a2 2 0 0 0 3 0"/></svg><span class="badge hidden" id="navBadge">0</span></button>
          <button class="utility-btn" data-nav="vault" title="Vault status" aria-label="Vault status"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9.5V18a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18V9.5"/><path d="M10 13h4"/></svg></button>
          <button class="version-chip" id="versionBtn" type="button" title="Version and updates"><i id="versionDot"></i><span id="versionLabel">v__VERSION__</span><small id="versionState">Checking</small></button>
          <button class="utility-btn" data-nav="account" title="Account" aria-label="Account"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg></button>
          <button class="utility-btn" id="moreBtn" type="button" title="More" aria-label="More options" aria-expanded="false"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg></button>
        </nav>
        <div class="more-menu hidden" id="moreMenu">
          <button type="button" data-nav="updates"><span>Updates</span><span class="badge hidden" id="releaseBadge">New</span></button>
          <button type="button" data-nav="settings">Settings</button>
          <button type="button" data-nav="help">Help</button>
          <a class="hidden" id="staffAdminMenuLink" href="/admin" target="_blank" rel="noopener">Admin dashboard</a>
          <button type="button" class="danger" id="logoutMenuBtn">Log out</button>
        </div>
      </header>
      <main class="main">
      <!-- LINKS -->
      <section id="page-links" class="home-page">
        <div class="home-kicker">Your links</div><div class="ptitle">Links</div>
        <div class="psub">Generate a link and keep the ones you use.</div>
        <aside class="login-requirement" role="note" aria-label="Login required">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
          <div><strong>Login required</strong><span>Private links only open while you are signed in to <b>nebulabkmlinks.shop</b> in this browser.</span></div>
        </aside>

        <aside class="home-announcement hidden" id="homeAnnouncement" aria-live="polite">
          <span class="home-announcement-label">Broadcast</span>
          <div class="home-announcement-copy"><div><strong id="homeAnnouncementTitle">General announcement</strong><time id="homeAnnouncementDate"></time></div><p id="homeAnnouncementText"></p></div>
          <button id="homeAnnouncementDismiss" type="button" aria-label="Dismiss announcement">&#x2715;</button>
        </aside>
        <div class="actions route-composer">
          <button class="btn composer-btn" id="genBtn">Generate link</button>
          <button class="btn ghost" id="copyBtn">Copy all</button>
          <button class="btn ghost" id="openBtn">Open all</button>
        </div>
        <div class="link-tools">
          <input id="linkSearch" type="search" placeholder="Search saved links" autocomplete="off">
          <select id="linkDomain" aria-label="Filter saved links by domain"><option value="">All domains</option></select>
          <button class="btn ghost" id="randomBtn" type="button">Open random</button>
        </div>
        <div class="usage-card">
          <div class="usage-top">
            <div><span class="usage-label">Weekly usage</span><strong id="usageValue">0% used</strong></div>
            <span class="usage-reset">Resets Saturday</span>
          </div>
          <div class="usage-track"><i id="usageFill"></i></div>
          <div class="meter" id="meter">
            <span id="usageAvailable">— available</span>
            <span id="usageCredits">— credits</span>
          </div>
        </div>
        <div class="section-head"><span>Your routes</span><span class="section-count" id="routeCount">0 saved</span></div>
        <ul class="links" id="linkList"></ul>
        <div class="empty" id="linksEmpty">No links yet — generate one.</div>
        <aside class="undo-delete hidden" id="undoDelete" aria-live="polite"><span>Link removed.</span><button type="button" id="undoDeleteBtn">Undo</button></aside>
      </section>
      <!-- SETTINGS -->
      <section id="page-settings" class="hidden">
        <div class="ptitle">Settings</div>
        <div class="psub">Choose the atmosphere that feels right. Saved to your account.</div>
        <span class="flabel">Theme</span>
        <div class="themes">
          <button class="swatch void" data-theme-pick="void"><span>Core</span></button>
          <button class="swatch nebula" data-theme-pick="nebula"><span>Slate</span></button>
          <button class="swatch eclipse" data-theme-pick="eclipse"><span>Paper</span></button>
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
        <label class="flabel" for="reportReason" style="margin-top:14px;">Reason</label>
        <select id="reportReason"><option value="dead">Dead link</option><option value="blocked">Blocked or unavailable</option><option value="wrong-destination">Wrong destination</option><option value="other">Other</option></select>
        <button class="btn" id="reportBtn" style="margin-top:14px;">Report selected</button>
      </section>
      <!-- SUPPORT -->
      <section id="page-bug" class="hidden">
        <div id="supportInbox">
          <div class="support-top"><div><div class="ptitle">Support</div><div class="psub">Bug reports stay organized as conversations, so you can reply until the issue is confirmed fixed.</div></div><button class="btn" id="supportNewBtn">New report</button></div>
          <div id="supportList" class="support-list"></div>
          <div class="empty" id="supportEmpty">No reports yet. If something breaks, start a report here.</div>
        </div>
        <div id="supportNew" class="hidden">
          <div class="chathead"><button class="chatback" id="supportNewBack" type="button">‹</button><div class="chatwho">New bug report</div></div>
          <label class="flabel" for="bugTitleInput">Short title</label>
          <input id="bugTitleInput" type="text" maxlength="80" placeholder="What is broken?">
          <label class="flabel" for="bugText">Details</label>
          <textarea id="bugText" placeholder="What did you do, what did you expect, and what happened instead?"></textarea>
          <button class="btn" id="bugBtn" style="margin-top:12px;">Send report</button>
        </div>
        <div id="supportThread" class="hidden">
          <div class="chathead"><button class="chatback" id="supportBack" type="button">‹</button><div><div class="chatwho" id="supportThreadTitle">Bug report</div><div class="pstatus" id="supportThreadStatus"></div></div></div>
          <div class="support-thread" id="supportMessages"></div>
          <div class="chatcompose"><input id="supportReply" type="text" placeholder="Reply to support..." autocomplete="off"><button class="btn" id="supportReplyBtn">Send</button></div>
        </div>
      </section>
      <!-- GLOBAL CHAT -->
      <section id="page-global" class="hidden">
        <div class="global-head">
          <div><div class="ptitle">Global chat</div><div class="psub">One shared room for everyone using Scale XT.</div></div>
          <div class="global-head-actions"><button class="btn ghost" id="globalMute" type="button">Mute</button><div class="global-presence"><i></i><span id="globalOnline">— online</span></div></div>
        </div>
        <div class="global-room">
          <div class="global-messages" id="globalMessages"></div>
          <div class="global-empty" id="globalEmpty"><span>◎</span><strong>No messages yet</strong><small>Start the room.</small></div>
          <div class="global-compose">
            <input id="globalInput" type="text" maxlength="500" placeholder="Message everyone…" autocomplete="off">
            <span id="globalCount">0 / 500</span>
            <button class="btn" id="globalSend" type="button">Send</button>
          </div>
        </div>
        <div class="global-note">Messages are visible to every signed-in member. You can remove your own messages; staff can moderate the room.</div>
      </section>
      <!-- MESSAGES -->
      <section id="page-messages" class="hidden">
        <!-- INBOX: list of conversations -->
        <div id="msgInbox">
          <div class="ptitle">Messages</div>
          <div class="psub">Your conversations. Tap one to open the thread.</div>
          <div class="actions"><button class="btn" id="msgNew">New message</button></div>
          <div id="convoList" style="margin-top:16px;"></div>
          <div class="empty" id="convoEmpty">No conversations yet — start one.</div>
        </div>
        <!-- NEW: pick someone to message -->
        <div id="msgNewPane" class="hidden">
          <div class="chathead"><button class="chatback" id="newBack" type="button">‹</button><div class="chatwho">New message</div></div>
          <div style="position:relative;max-width:420px;margin-top:6px;">
            <input id="msgUser" type="text" placeholder="To: username" autocomplete="off" style="letter-spacing:0;">
            <div id="msgSuggest" class="suggest hidden"></div>
          </div>
          <button class="btn" id="newStart" style="margin-top:12px;">Start conversation</button>
        </div>
        <!-- THREAD: the conversation itself -->
        <div id="msgThread" class="hidden chatwrap">
          <div class="chathead">
            <button class="chatback" id="msgBack" type="button">‹</button>
            <div class="chatwho" id="threadWith">—</div>
            <span class="pdot" id="threadDot"></span>
            <span class="pstatus" id="threadStatus"></span>
          </div>
          <div class="chatscroll" id="threadMsgs"></div>
          <div class="chatempty hidden" id="threadEmpty">No messages yet — say hi.</div>
          <div class="chatcompose">
            <input id="threadInput" type="text" placeholder="Message…" autocomplete="off" style="letter-spacing:0;">
            <button class="btn" id="threadSend" type="button">Send</button>
          </div>
        </div>
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
          <div class="inforow"><span class="k">Weekly usage</span><span class="v" id="vRemain">—</span></div>
        </div>
      </section>
      <!-- ACCOUNT -->
      <section id="page-account" class="hidden">
        <div class="ptitle">Account</div>
        <div class="psub">Your Scale XT credentials.</div>
        <div class="info">
          <div class="inforow"><span class="k">Username</span><span class="v" id="acUser">—</span></div>
          <div class="inforow"><span class="k">Member since</span><span class="v" id="acSince">—</span></div>
          <div class="inforow"><span class="k">Weekly usage</span><span class="v" id="acRemain">—</span></div>
          <div class="inforow"><span class="k">Available usage</span><span class="v" id="acAvailable">—</span></div>
          <div class="inforow"><span class="k">Usage credits</span><span class="v" id="acCredits">—</span></div>
          <div class="inforow"><span class="k">Role</span><span class="v" id="acRole">Member</span></div>
          <div class="inforow"><span class="k">Theme</span><span class="v" id="acTheme">—</span></div>
          <div class="inforow"><span class="k">Installed version</span><span class="v" id="acVersion">—</span></div>
          <div class="inforow"><span class="k">Latest version</span><span class="v" id="acLatest">Checking…</span></div>
        </div>
        <a class="btn ghost hidden" id="staffAdminLink" href="/admin" target="_blank" rel="noopener" style="margin-top:14px;">Open staff panel</a>
        <span class="flabel" style="margin-top:26px;">Share usage</span>
        <div class="psub" style="margin-bottom:12px;">Give another user one usage credit. You can share with the same person once per hour.</div>
        <div class="info" style="max-width:360px;">
          <div style="position:relative;">
            <input id="giftUser" type="text" placeholder="Username" autocomplete="off" style="letter-spacing:0;">
            <div id="giftSuggest" class="suggest hidden"></div>
          </div>
          <button class="btn" id="giftBtn" style="width:100%;">Share usage</button>
        </div>
        <span class="flabel" style="margin-top:26px;">Change password</span>
        <div class="info" style="max-width:360px;">
          <input id="pwCurrent" type="password" placeholder="Current password" autocomplete="off">
          <input id="pwNew" type="password" placeholder="New password" autocomplete="off">
          <button class="btn" id="pwBtn" style="width:100%;">Update password</button>
          <button class="btn ghost" id="logoutAllBtn" style="width:100%;">Log out all devices</button>
        </div>
      </section>
      <!-- RELEASE NOTES -->
      <section id="page-updates" class="hidden">
        <div class="ptitle">Updates</div>
        <div class="psub">Your installed version and everything that changed.</div>
        <div class="version-panel">
          <div><span>Installed</span><strong id="updatesInstalled">—</strong></div>
          <div><span>Latest</span><strong id="updatesLatest">Checking…</strong></div>
          <button class="btn ghost" id="updatesAction" type="button">Check for updates</button>
        </div>
        <div class="section-head release-heading"><span>Release notes</span><span class="section-count" id="releaseCount">—</span></div>
        <div id="releaseList" class="release-list"></div>
        <div class="empty hidden" id="releaseEmpty">No release notes yet.</div>
      </section>
      <!-- HELP -->
      <section id="page-help" class="hidden">
        <div class="ptitle">Help</div>
        <div class="psub">How Scale XT works.</div>
        <div class="info">
          <p style="line-height:1.7;margin-bottom:12px;">• Use <b>Generate link</b> to add a destination. Weekly usage resets every Saturday.</p>
          <p style="line-height:1.7;margin-bottom:12px;">• Click <b>Link 1</b>, <b>Link 2</b>… to open them. Use <b>Open all</b> to launch every link at once.</p>
          <p style="line-height:1.7;margin-bottom:12px;">• If a link is dead or blocked, tap <b>blocked</b> on it — it's pulled from everyone's rotation and reported.</p>
          <p style="line-height:1.7;margin-bottom:12px;">• <b>Vault</b> shows how many links are still live. <b>Settings</b> changes your theme and behavior.</p>
          <p style="line-height:1.7;color:var(--muted);">Links are stored on the server and shown as labels so the URLs don't leak over your shoulder.</p>
          <p style="margin-top:16px;color:var(--muted);font-size:12px;">Installed: <b id="helpVersion">v__VERSION__</b> <span id="helpVersionState">· checking for updates</span></p>
          <button class="btn ghost" id="helpUpdate" style="margin-top:14px;">Update Scale XT</button>
        </div>
      </section>
      <div class="msg" id="msg"></div>
      </main>
    </div>
  </div>
</div>

<script>
(function(){
  var API=window.location.origin, TOKEN_KEY='voidext_token', APP_VERSION='__VERSION__';
  var versionParam='';
  try{versionParam=new URLSearchParams(window.location.search).get('v')||'';}catch(e){}
  var INSTALLED_VERSION=/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(versionParam)?versionParam:APP_VERSION;
  var DEFAULTS={theme:'void',openInNewTab:true,confirmReport:false};
  var state={mode:'login',signupsEnabled:true,settings:Object.assign({},DEFAULTS),draft:null,account:null,links:[],pinned:[],notifications:[],announcements:[],releases:[],unread:0,reportSel:{}};

  var $=function(id){return document.getElementById(id);};
  function token(){try{return localStorage.getItem(TOKEN_KEY)||'';}catch(e){return'';}}
  function setToken(t){try{t?localStorage.setItem(TOKEN_KEY,t):localStorage.removeItem(TOKEN_KEY);}catch(e){}}
  function msg(t,k){var m=!$('authWrap').classList.contains('hidden')?$('authMsg'):$('msg');m.className=(m.id==='authMsg'?'authmsg':'msg')+' show '+(k||'');m.textContent=t;if(k!=='err')setTimeout(function(){if(m.textContent===t)clearMsg();},2600);}
  function clearMsg(){var a=$('authMsg'),m=$('msg');a.className='authmsg';a.textContent='';m.className='msg';m.textContent='';}
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

  function showAuth(){$('authWrap').classList.remove('hidden');$('app').classList.add('hidden');closeCommand();closeMore();stopHomeAnnouncementWatch();stopGlobalPoll();}
  function showApp(){$('authWrap').classList.add('hidden');$('app').classList.remove('hidden');nav('links');checkReleases();paintVersionState();startHomeAnnouncementWatch();}

  var PAGE_NAMES={links:'Links',global:'Global chat',report:'Report links',bug:'Support',messages:'Messages',notifs:'Notifications',updates:'Updates',vault:'Vault',account:'Account',settings:'Settings',help:'Help'};
  function nav(page){
    ['links','global','report','bug','messages','notifs','updates','vault','account','settings','help'].forEach(function(p){
      $('page-'+p).classList.toggle('hidden',p!==page);
    });
    state.activePage=page;
    $('utilityPage').textContent=PAGE_NAMES[page]||'Scale XT';
    document.querySelectorAll('[data-nav]').forEach(function(el){el.classList.toggle('active',el.getAttribute('data-nav')===page);});
    closeMore();closeCommand();
    if(page==='settings')openSettings();
    if(page==='account')renderAccount();
    if(page==='vault')loadVault();
    if(page==='report')renderReport();
    if(page==='bug')openSupport();else stopSupportPoll();
    if(page==='global')openGlobal();else stopGlobalPoll();
    if(page==='messages')openMessages(); else stopMsgPoll();
    if(page==='notifs')openNotifs();
    if(page==='updates')loadReleases(true);
    clearMsg();
  }
  document.querySelectorAll('[data-nav]').forEach(function(el){el.onclick=function(){nav(el.getAttribute('data-nav'));};});

  function closeMore(){$('moreMenu').classList.add('hidden');$('moreBtn').setAttribute('aria-expanded','false');}
  $('moreBtn').onclick=function(e){e.stopPropagation();var open=$('moreMenu').classList.contains('hidden');closeMore();if(open){$('moreMenu').classList.remove('hidden');$('moreBtn').setAttribute('aria-expanded','true');}};
  $('moreMenu').onclick=function(e){e.stopPropagation();};
  document.addEventListener('click',closeMore);
  $('versionBtn').onclick=function(){if(latestVersion&&isNewer(latestVersion,INSTALLED_VERSION))openUpdate();else nav('updates');};

  var commandIndex=0;
  function commandButtons(){return Array.prototype.filter.call(document.querySelectorAll('[data-command]'),function(el){return !el.classList.contains('hidden');});}
  function paintCommandSelection(){
    var items=commandButtons();
    if(!items.length)return;
    commandIndex=Math.max(0,Math.min(commandIndex,items.length-1));
    items.forEach(function(el,i){el.classList.toggle('selected',i===commandIndex);});
    items[commandIndex].scrollIntoView({block:'nearest'});
  }
  function filterCommands(){
    var q=$('commandInput').value.trim().toLowerCase();
    document.querySelectorAll('[data-command]').forEach(function(el){el.classList.toggle('hidden',!!q&&(el.getAttribute('data-search')||'').indexOf(q)<0);});
    commandIndex=0;paintCommandSelection();
  }
  function openCommand(){
    if($('app').classList.contains('hidden'))return;
    closeMore();$('commandPalette').classList.remove('hidden');$('commandInput').value='';filterCommands();
    setTimeout(function(){$('commandInput').focus();},0);
  }
  function closeCommand(){
    var palette=$('commandPalette');if(!palette)return;
    palette.classList.add('hidden');$('commandInput').value='';
    document.querySelectorAll('[data-command]').forEach(function(el){el.classList.remove('hidden','selected');});
  }
  function runCommand(command){
    closeCommand();
    var pages={links:'links',global:'global',report:'report',messages:'messages',notifications:'notifs',vault:'vault',updates:'updates',settings:'settings',account:'account'};
    if(pages[command]){nav(pages[command]);return;}
    if(command==='generate'){nav('links');setTimeout(function(){$('genBtn').click();},0);return;}
    if(command==='support'){nav('bug');setTimeout(function(){$('supportNewBtn').click();},0);}
  }
  $('commandBtn').onclick=openCommand;
  $('commandInput').addEventListener('input',filterCommands);
  $('commandInput').addEventListener('keydown',function(e){
    var items=commandButtons();
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeCommand();return;}
    if(!items.length)return;
    if(e.key==='ArrowDown'){e.preventDefault();commandIndex=(commandIndex+1)%items.length;paintCommandSelection();}
    else if(e.key==='ArrowUp'){e.preventDefault();commandIndex=(commandIndex-1+items.length)%items.length;paintCommandSelection();}
    else if(e.key==='Enter'){e.preventDefault();runCommand(items[commandIndex].getAttribute('data-command'));}
  });
  document.querySelectorAll('[data-command]').forEach(function(el){el.onclick=function(){runCommand(el.getAttribute('data-command'));};});
  $('commandPalette').onclick=function(e){if(e.target===$('commandPalette'))closeCommand();};
  document.addEventListener('keydown',function(e){
    if((e.ctrlKey||e.metaKey)&&String(e.key).toLowerCase()==='k'){e.preventDefault();openCommand();}
    else if(e.key==='Escape'){closeCommand();closeMore();}
  });

  // tabs
  function setMode(m){
    if(m==='signup'&&!state.signupsEnabled)m='login';
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
        setToken(res.data.token);state.username=res.data.username;applySettings(res.data.settings);state.account=res.data.account||null;state.links=res.data.links||[];state.pinned=res.data.pinned||[];state.notifications=res.data.notifications||[];
        clearMsg();showApp();renderLinks(state.links);setBadge((res.data.notifications||[]).length);setMsgBadge(res.data.messagesUnread||0);startBadgePoll();
      })
      .catch(function(){b.disabled=false;msg('Network error — is the server reachable?','err');});
  };

  // The newest admin announcement appears directly on the bookmark home page.
  // Dismissal is stored per announcement, so a future broadcast appears again.
  var homeAnnouncementPoll=null,homeAnnouncementId='';
  function dismissedAnnouncement(){try{return localStorage.getItem('scale_xt_dismissed_announcement')||'';}catch(e){return'';}}
  function paintHomeAnnouncement(item){
    var panel=$('homeAnnouncement');
    if(!item){homeAnnouncementId='';panel.classList.add('hidden');return;}
    var id=String(item.id||item.at||'');
    if(id&&dismissedAnnouncement()===id){homeAnnouncementId=id;panel.classList.add('hidden');return;}
    homeAnnouncementId=id;
    $('homeAnnouncementTitle').textContent=item.title||'General announcement';
    $('homeAnnouncementText').textContent=item.text||'';
    $('homeAnnouncementDate').textContent=item.at?new Date(item.at).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'';
    panel.classList.remove('hidden');
  }
  function loadHomeAnnouncement(){
    return api('/api/announcements').then(function(res){
      if(!res.ok)return;
      state.announcements=res.data.announcements||[];
      paintHomeAnnouncement(state.announcements[0]||null);
    }).catch(function(){});
  }
  function startHomeAnnouncementWatch(){
    loadHomeAnnouncement();
    if(!homeAnnouncementPoll)homeAnnouncementPoll=setInterval(loadHomeAnnouncement,60000);
  }
  function stopHomeAnnouncementWatch(){if(homeAnnouncementPoll){clearInterval(homeAnnouncementPoll);homeAnnouncementPoll=null;}}
  $('homeAnnouncementDismiss').onclick=function(){
    if(homeAnnouncementId){try{localStorage.setItem('scale_xt_dismissed_announcement',homeAnnouncementId);}catch(e){}}
    $('homeAnnouncement').classList.add('hidden');
  };

  // links page
  $('genBtn').onclick=function(){
    var b=$('genBtn');b.disabled=true;msg('Pulling a link...','');
    api('/api/links').then(function(res){
      b.disabled=false;
      if(res.status===401){setToken('');showAuth();setMode('login');msg('Session expired — log in again.','err');return;}
      if(res.data.links)state.links=res.data.links;
      if(res.data.pinned)state.pinned=res.data.pinned;
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
  function linkDomain(url){try{return new URL(url).hostname.replace(/^www\./,'').toLowerCase();}catch(e){return'';}}
  function syncLinkDomains(links){
    var select=$('linkDomain'),sig=links.map(linkDomain).sort().join('|');
    if(select.getAttribute('data-sig')===sig)return;
    var selected=select.value,domains=[];
    links.forEach(function(url){var domain=linkDomain(url);if(domain&&domains.indexOf(domain)<0)domains.push(domain);});
    domains.sort();select.innerHTML='<option value="">All domains</option>';
    domains.forEach(function(domain){var option=document.createElement('option');option.value=domain;option.textContent=domain;select.appendChild(option);});
    select.value=domains.indexOf(selected)>=0?selected:'';select.setAttribute('data-sig',sig);
  }
  function setSignupsEnabled(enabled){
    state.signupsEnabled=enabled!==false;
    $('tabSignup').classList.toggle('hidden',!state.signupsEnabled);
    $('tabSignup').parentNode.style.gridTemplateColumns=state.signupsEnabled?'1fr 1fr':'1fr';
    $('tabSignup').setAttribute('aria-disabled',state.signupsEnabled?'false':'true');
    $('tabSignup').title=state.signupsEnabled?'':'New account registration is currently closed.';
    if(!state.signupsEnabled&&state.mode==='signup')setMode('login');
  }
  function visibleLinks(){
    var q=$('linkSearch').value.trim().toLowerCase(),domain=$('linkDomain').value;
    return (state.links||[]).filter(function(url){return(!q||url.toLowerCase().indexOf(q)>=0)&&(!domain||linkDomain(url)===domain);});
  }
  $('linkSearch').addEventListener('input',function(){renderLinks(state.links);});
  $('linkDomain').addEventListener('change',function(){renderLinks(state.links);});
  $('randomBtn').onclick=function(){
    var links=visibleLinks();if(!links.length){msg('No saved links match the current filter.','err');return;}
    var url=links[Math.floor(Math.random()*links.length)];window.open(url,state.settings.openInNewTab?'_blank':'_top','noopener');
  };

  function renderUsage(account){
    account=account||{};
    var pct=Math.max(0,Math.min(100,Math.round(Number(account.usagePercent)||0)));
    var available=Math.max(0,Math.floor(Number(account.usageAvailable)||0));
    var credits=Math.max(0,Math.floor(Number(account.usageCredits)||0));
    $('usageValue').textContent=pct+'% used';
    $('usageFill').style.width=pct+'%';
    $('usageAvailable').textContent=available+' link use'+(available===1?'':'s')+' available';
    $('usageCredits').textContent=credits+' usage credit'+(credits===1?'':'s');
  }
  function updateMeter(d){
    if(!d||d.usagePercent==null)return;
    if(!state.account)state.account={};
    state.account.usagePercent=d.usagePercent;
    if(d.usageAvailable!=null)state.account.usageAvailable=d.usageAvailable;
    if(d.usageCredits!=null)state.account.usageCredits=d.usageCredits;
    state.account.resetAt=d.resetAt||state.account.resetAt;
    renderUsage(state.account);
  }
  function renderLinks(links){
    var L=$('linkList');L.innerHTML='';
    syncLinkDomains(links);
    var shown=visibleLinks();
    $('linksEmpty').textContent=links.length?'No saved links match this filter.':'No links yet — generate one.';
    $('linksEmpty').classList.toggle('hidden',shown.length>0);
    $('routeCount').textContent=(shown.length===links.length?links.length:shown.length+' of '+links.length)+' saved';
    if(state.account)renderUsage(state.account);
    else renderUsage({usagePercent:0});
    var pinSet={};(state.pinned||[]).forEach(function(u){pinSet[u]=true;});
    var ordered=shown.slice().sort(function(a,b){
      var pa=pinSet[a]?1:0,pb=pinSet[b]?1:0;
      if(pa!==pb)return pb-pa;                 // pinned to the top
      return links.indexOf(a)-links.indexOf(b);// otherwise keep original order
    });
    var PIN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3H7l3-3-1-6z"/></svg>';
    var TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg>';
    ordered.forEach(function(url,idx){
      var li=document.createElement('li');if(pinSet[url])li.className='pinned';
      var a=document.createElement('a');a.href=url;a.target=state.settings.openInNewTab?'_blank':'_top';a.rel='noopener noreferrer';a.textContent='Private route '+String(idx+1).padStart(2,'0');
      var pin=document.createElement('button');pin.type='button';pin.className='lact'+(pinSet[url]?' on':'');pin.title=pinSet[url]?'Unpin':'Pin';pin.innerHTML=PIN;
      pin.onclick=function(){togglePin(url,!pinSet[url]);};
      var del=document.createElement('button');del.type='button';del.className='lact';del.title='Delete';del.innerHTML=TRASH;
      del.onclick=function(){stageDeleteLink(url);};
      li.appendChild(a);li.appendChild(pin);li.appendChild(del);L.appendChild(li);
    });
  }
  var pendingDelete=null;
  function commitPendingDelete(){
    if(!pendingDelete)return;
    var item=pendingDelete;pendingDelete=null;$('undoDelete').classList.add('hidden');
    api('/api/links/delete',{method:'POST',body:{url:item.url}}).then(function(res){
      if(!res.ok){state.links.splice(Math.min(item.index,state.links.length),0,item.url);if(item.pinned)state.pinned.push(item.url);renderLinks(state.links);msg(res.data.error||'Could not delete.','err');return;}
      state.links=res.data.links||state.links;state.pinned=res.data.pinned||state.pinned;renderLinks(state.links);
    }).catch(function(){state.links.splice(Math.min(item.index,state.links.length),0,item.url);if(item.pinned)state.pinned.push(item.url);renderLinks(state.links);msg('Network error.','err');});
  }
  function stageDeleteLink(url){
    if(pendingDelete)commitPendingDelete();
    var index=state.links.indexOf(url),pinned=state.pinned.indexOf(url)>=0;
    if(index<0)return;
    state.links.splice(index,1);state.pinned=state.pinned.filter(function(item){return item!==url;});renderLinks(state.links);
    pendingDelete={url:url,index:index,pinned:pinned,timer:setTimeout(commitPendingDelete,8000)};
    $('undoDelete').classList.remove('hidden');
  }
  $('undoDeleteBtn').onclick=function(){
    if(!pendingDelete)return;
    var item=pendingDelete;pendingDelete=null;clearTimeout(item.timer);$('undoDelete').classList.add('hidden');
    state.links.splice(Math.min(item.index,state.links.length),0,item.url);if(item.pinned&&state.pinned.indexOf(item.url)<0)state.pinned.push(item.url);renderLinks(state.links);msg('Link restored.','ok');
  };
  function togglePin(url,pin){
    api('/api/links/pin',{method:'POST',body:{url:url,pinned:pin}}).then(function(res){
      if(!res.ok){msg(res.data.error||'Could not update.','err');return;}
      state.links=res.data.links||state.links;state.pinned=res.data.pinned||[];renderLinks(state.links);
    }).catch(function(){msg('Network error.','err');});
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
    var role=a.role||'member';
    var available=Math.max(0,Math.floor(Number(a.usageAvailable)||0));
    var credits=Math.max(0,Math.floor(Number(a.usageCredits)||0));
    $('acUser').textContent=state.username||'—';
    $('acSince').textContent=fmtDate(a.created);
    $('acRemain').textContent=Math.max(0,Math.min(100,Math.round(Number(a.usagePercent)||0)))+'% used';
    $('acAvailable').textContent=available+' link use'+(available===1?'':'s');
    $('acCredits').textContent=credits+' credit'+(credits===1?'':'s');
    $('acRole').textContent=role.charAt(0).toUpperCase()+role.slice(1);
    $('acTheme').textContent=state.settings.theme;
    $('acVersion').textContent='v'+INSTALLED_VERSION;
    $('acLatest').textContent=latestVersion?'v'+latestVersion:'Checking…';
    var isStaff=role==='owner'||role==='admin'||role==='support';
    $('staffAdminLink').classList.toggle('hidden',!isStaff);
    $('staffAdminMenuLink').classList.toggle('hidden',!isStaff);
    api('/api/users').then(function(res){ if(res.ok) giftUsers=res.data.usernames||[]; });
  }

  // Share one weekly usage credit with another user.
  var giftUsers=[], giftHl=-1;
  function giftSuggest(){
    var q=$('giftUser').value.trim().toLowerCase(), box=$('giftSuggest');
    if(!q){box.classList.add('hidden');box.innerHTML='';return;}
    var matches=giftUsers.filter(function(u){return u.toLowerCase().indexOf(q)===0&&u.toLowerCase()!==(state.username||'').toLowerCase();}).slice(0,8);
    if(!matches.length){box.classList.add('hidden');box.innerHTML='';return;}
    giftHl=-1;
    box.innerHTML=matches.map(function(u){return '<div class="s" data-u="'+u.replace(/"/g,'&quot;')+'"><b>'+u.slice(0,q.length).replace(/</g,'&lt;')+'</b>'+u.slice(q.length).replace(/</g,'&lt;')+'</div>';}).join('');
    box.classList.remove('hidden');
    Array.prototype.forEach.call(box.querySelectorAll('.s'),function(el){el.onclick=function(){$('giftUser').value=el.getAttribute('data-u');box.classList.add('hidden');};});
  }
  function sendGift(){
    var to=$('giftUser').value.trim();
    if(!to){msg('Pick a username.','err');return;}
    var b=$('giftBtn');b.disabled=true;msg('Sharing usage...','');
    api('/api/send-token',{method:'POST',body:{to:to}}).then(function(res){
      b.disabled=false;
      if(!res.ok){msg(res.data.error||'Could not send.','err');return;}
      if(res.data.account){state.account=res.data.account;renderAccount();}
      $('giftUser').value='';$('giftSuggest').classList.add('hidden');
      msg('Shared usage with '+res.data.sentTo+'.','ok');
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  }
  $('giftUser').addEventListener('input',giftSuggest);
  $('giftUser').addEventListener('keydown',function(e){
    var box=$('giftSuggest'),items=box.querySelectorAll('.s');
    if(e.key==='Enter'&&box.classList.contains('hidden')){e.preventDefault();sendGift();return;}
    if(box.classList.contains('hidden')||!items.length)return;
    if(e.key==='ArrowDown'){e.preventDefault();giftHl=Math.min(items.length-1,giftHl+1);}
    else if(e.key==='ArrowUp'){e.preventDefault();giftHl=Math.max(0,giftHl-1);}
    else if(e.key==='Enter'){e.preventDefault();$('giftUser').value=items[giftHl>=0?giftHl:0].getAttribute('data-u');box.classList.add('hidden');return;}
    else if(e.key==='Escape'){box.classList.add('hidden');return;}
    else return;
    Array.prototype.forEach.call(items,function(el,i){el.classList.toggle('hl',i===giftHl);});
  });
  $('giftBtn').onclick=sendGift;

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
    api('/api/report',{method:'POST',body:{urls:urls,reason:$('reportReason').value}}).then(function(res){
      b.disabled=false;
      if(!res.ok){msg(res.data.error||'Could not report.','err');return;}
      msg('Reported '+res.data.reported+' link(s) for review.','ok');renderReport();
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };

  // Support tickets: list, full conversation, replies, and lightweight polling.
  var supportItems=[],supportId=null,supportPoll=null,supportSig='';
  function supportOpenStatus(status){return status!=='fixed'&&status!=='dismissed';}
  function supportLabel(status){return status==='waiting'?'Waiting for you':status==='fixed'?'Fixed':status==='dismissed'?'Closed':'Open';}
  function setSupportBadge(count){var badge=$('bugBadge');if(count>0){badge.textContent=count>99?'99+':count;badge.classList.remove('hidden');}else badge.classList.add('hidden');}
  function showSupportView(view){
    $('supportInbox').classList.toggle('hidden',view!=='inbox');
    $('supportNew').classList.toggle('hidden',view!=='new');
    $('supportThread').classList.toggle('hidden',view!=='thread');
  }
  function openSupport(){supportId=null;supportSig='';showSupportView('inbox');loadSupportList();}
  function loadSupportList(){
    api('/api/bugs').then(function(res){
      if(!res.ok)return;
      supportItems=res.data.bugs||[];setSupportBadge(res.data.unread||0);
      var list=$('supportList');list.innerHTML='';
      $('supportEmpty').classList.toggle('hidden',supportItems.length>0);
      supportItems.forEach(function(item){
        var row=document.createElement('button');row.type='button';row.className='support-row'+(item.unread?' unread':'');
        var preview=item.lastMessage&&item.lastMessage.text?item.lastMessage.text:'No replies yet';
        row.innerHTML='<span class="support-row-top"><b>'+esc(item.title)+'</b><time>'+relTime(item.updatedAt)+'</time></span>'+
          '<span class="support-preview">'+esc(preview)+'</span><span class="support-row-foot"><i class="'+esc(item.status)+'">'+esc(supportLabel(item.status))+'</i><span>'+(item.messageCount||0)+' message'+(item.messageCount===1?'':'s')+'</span></span>';
        row.onclick=function(){openSupportThread(item.id);};list.appendChild(row);
      });
    });
  }
  function refreshSupportBadge(){api('/api/bugs').then(function(res){if(res.ok)setSupportBadge(res.data.unread||0);});}
  function openSupportThread(id,quiet){
    supportId=id;showSupportView('thread');
    api('/api/bugs/thread',{method:'POST',body:{id:id}}).then(function(res){
      if(!res.ok||supportId!==id){if(!quiet)msg(res.data.error||'Could not open report.','err');return;}
      renderSupportThread(res.data.bug,quiet);refreshSupportBadge();if(!quiet)startSupportPoll();
    });
  }
  function renderSupportThread(ticket,quiet){
    var sig=(ticket.messages||[]).map(function(item){return item.id;}).join(',')+'|'+ticket.status;
    if(quiet&&sig===supportSig)return;supportSig=sig;
    $('supportThreadTitle').textContent=ticket.title||'Bug report';
    $('supportThreadStatus').textContent=supportLabel(ticket.status)+' · opened '+new Date(ticket.at).toLocaleDateString();
    var box=$('supportMessages'),nearBottom=box.scrollHeight-box.scrollTop-box.clientHeight<50;box.innerHTML='';
    (ticket.messages||[]).forEach(function(item){
      var bubble=document.createElement('div');bubble.className='support-bubble '+(item.from==='user'?'mine':'theirs')+(item.system?' system':'');
      bubble.innerHTML='<div>'+esc(item.text)+'</div><span>'+(item.from==='user'?'You':esc(item.fromName||'Scale XT support'))+' · '+msgTime(item.at)+'</span>';box.appendChild(bubble);
    });
    if(nearBottom||!box._painted)box.scrollTop=box.scrollHeight;box._painted=true;
    $('supportReply').placeholder=supportOpenStatus(ticket.status)?'Reply to support...':'Reply to reopen this report...';
  }
  function sendSupportReply(){
    var text=$('supportReply').value.trim();if(!text||!supportId)return;
    var button=$('supportReplyBtn');button.disabled=true;
    api('/api/bugs/reply',{method:'POST',body:{id:supportId,text:text}}).then(function(res){
      button.disabled=false;if(!res.ok){msg(res.data.error||'Could not send reply.','err');return;}
      $('supportReply').value='';renderSupportThread(res.data.bug);loadSupportList();
    }).catch(function(){button.disabled=false;msg('Network error.','err');});
  }
  function startSupportPoll(){stopSupportPoll();supportPoll=setInterval(function(){if($('page-bug').classList.contains('hidden')||!supportId){stopSupportPoll();return;}openSupportThread(supportId,true);},7000);}
  function stopSupportPoll(){if(supportPoll){clearInterval(supportPoll);supportPoll=null;}}
  $('supportNewBtn').onclick=function(){$('bugTitleInput').value='';$('bugText').value='';showSupportView('new');setTimeout(function(){$('bugTitleInput').focus();},40);};
  $('supportNewBack').onclick=function(){showSupportView('inbox');loadSupportList();};
  $('supportBack').onclick=function(){stopSupportPoll();supportId=null;supportSig='';showSupportView('inbox');loadSupportList();};
  $('bugBtn').onclick=function(){
    var title=$('bugTitleInput').value.trim(),text=$('bugText').value.trim();
    if(text.length<5){msg('Describe the bug in a bit more detail.','err');return;}
    var button=$('bugBtn');button.disabled=true;msg('Sending report...','');
    api('/api/bug',{method:'POST',body:{title:title,text:text}}).then(function(res){
      button.disabled=false;if(!res.ok){msg(res.data.error||'Could not submit.','err');return;}
      $('bugTitleInput').value='';$('bugText').value='';msg('Report sent. You can keep replying here.','ok');openSupportThread(res.data.bug.id);
    }).catch(function(){button.disabled=false;msg('Network error.','err');});
  };
  $('supportReplyBtn').onclick=sendSupportReply;
  $('supportReply').addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();sendSupportReply();}});

  // global chat — one persistent room shared by every signed-in member.
  var globalPoll=null,globalSig='',globalLatestId='';
  function globalMuted(){try{return localStorage.getItem('scale_xt_global_muted')==='1';}catch(e){return false;}}
  function globalSeen(){try{return localStorage.getItem('scale_xt_global_seen')||'';}catch(e){return'';}}
  function setGlobalSeen(id){try{if(id)localStorage.setItem('scale_xt_global_seen',id);}catch(e){}}
  function paintGlobalMute(){$('globalMute').textContent=globalMuted()?'Unmute':'Mute';}
  function paintGlobalBadge(latestId){
    if(latestId)globalLatestId=latestId;
    var badge=$('globalBadge'),viewing=state.activePage==='global';
    if(viewing&&globalLatestId)setGlobalSeen(globalLatestId);
    badge.classList.toggle('hidden',!globalLatestId||viewing||globalMuted()||globalSeen()===globalLatestId);
  }
  function openGlobal(){
    globalSig='';
    loadGlobal(true);
    startGlobalPoll();
    paintGlobalMute();paintGlobalBadge(globalLatestId);
    setTimeout(function(){$('globalInput').focus();},80);
  }
  function loadGlobal(forceScroll){
    api('/api/global/messages').then(function(res){
      if(!res.ok)return;
      var online=Math.max(1,Number(res.data.online)||1);
      $('globalOnline').textContent=online+' online';
      renderGlobal(res.data.messages||[],forceScroll);
    }).catch(function(){});
  }
  function renderGlobal(messages,forceScroll){
    var sig=messages.map(function(message){return message.id;}).join(',');
    if(sig===globalSig&&!forceScroll)return;
    var box=$('globalMessages');
    var atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<70;
    globalSig=sig;
    globalLatestId=messages.length?messages[messages.length-1].id:'';paintGlobalBadge(globalLatestId);
    box.innerHTML='';
    $('globalEmpty').classList.toggle('hidden',messages.length>0);
    messages.forEach(function(message){
      var row=document.createElement('article');row.className='global-message'+(message.mine?' mine':'');
      var avatar=document.createElement('span');avatar.className='global-avatar';avatar.textContent=(message.from||'?').charAt(0).toUpperCase();
      var content=document.createElement('div');content.className='global-message-content';
      var head=document.createElement('div');head.className='global-message-head';
      var name=document.createElement('strong');name.textContent=message.mine?'You':(message.from||'Member');
      head.appendChild(name);
      if(message.role&&message.role!=='member'){
        var role=document.createElement('span');role.className='global-role '+message.role;role.textContent=message.role;head.appendChild(role);
      }
      var time=document.createElement('time');time.textContent=msgTime(message.at);head.appendChild(time);
      var copy=document.createElement('p');copy.textContent=message.text||'';
      content.appendChild(head);content.appendChild(copy);
      row.appendChild(avatar);row.appendChild(content);
      if(message.canDelete){
        var remove=document.createElement('button');remove.type='button';remove.className='global-delete';remove.title='Delete message';remove.setAttribute('aria-label','Delete message');remove.textContent='×';
        remove.onclick=function(){
          if(remove.getAttribute('data-confirm')!=='1'){
            remove.setAttribute('data-confirm','1');remove.textContent='?';
            setTimeout(function(){if(remove.parentNode){remove.removeAttribute('data-confirm');remove.textContent='×';}},1800);
            return;
          }
          remove.disabled=true;
          api('/api/global/delete',{method:'POST',body:{id:message.id}}).then(function(res){
            if(!res.ok){remove.disabled=false;remove.textContent='×';remove.removeAttribute('data-confirm');msg(res.data.error||'Could not delete message.','err');return;}
            loadGlobal(false);
          }).catch(function(){remove.disabled=false;msg('Network error.','err');});
        };
        row.appendChild(remove);
      }
      box.appendChild(row);
    });
    if(forceScroll||atBottom)box.scrollTop=box.scrollHeight;
  }
  function sendGlobal(){
    var input=$('globalInput'),text=input.value.trim();
    if(!text)return;
    var button=$('globalSend');button.disabled=true;
    api('/api/global/send',{method:'POST',body:{text:text}}).then(function(res){
      button.disabled=false;
      if(!res.ok){msg(res.data.error||'Could not send message.','err');return;}
      input.value='';$('globalCount').textContent='0 / 500';input.focus();loadGlobal(true);
    }).catch(function(){button.disabled=false;msg('Network error.','err');});
  }
  function startGlobalPoll(){
    stopGlobalPoll();
    globalPoll=setInterval(function(){
      if($('page-global').classList.contains('hidden')){stopGlobalPoll();return;}
      loadGlobal(false);
    },3000);
  }
  function stopGlobalPoll(){if(globalPoll){clearInterval(globalPoll);globalPoll=null;}}
  $('globalSend').onclick=sendGlobal;
  $('globalInput').addEventListener('keydown',function(event){if(event.key==='Enter'){event.preventDefault();sendGlobal();}});
  $('globalInput').addEventListener('input',function(){$('globalCount').textContent=$('globalInput').value.length+' / 500';});
  $('globalMute').onclick=function(){try{localStorage.setItem('scale_xt_global_muted',globalMuted()?'0':'1');}catch(e){}paintGlobalMute();paintGlobalBadge(globalLatestId);};

  // messages — texting-style: an inbox of conversations, each opening a thread
  // of chat bubbles you reply into. Messages live in the thread (server side),
  // NOT in the recipient's notifications. The open thread polls for new lines.
  var msgUsernames=[], msgHl=-1, msgPoll=null, threadPartner=null, threadSig='';
  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function relTime(ts){
    var d=Date.now()-ts;
    if(d<60000)return 'now';
    if(d<3600000)return Math.floor(d/60000)+'m';
    if(d<86400000)return Math.floor(d/3600000)+'h';
    if(d<604800000)return Math.floor(d/86400000)+'d';
    return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric'});
  }
  function msgTime(ts){
    var d=new Date(ts),now=new Date();
    var t=d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
    if(d.toDateString()===now.toDateString())return t;
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+', '+t;
  }
  function showTyping(on){
    var box=$('threadMsgs'),ex=box.querySelector('.bub.typing');
    if(on){
      if(!ex){ex=document.createElement('div');ex.className='bub them typing';ex.innerHTML='<span></span><span></span><span></span>';box.appendChild(ex);
        if(box.scrollHeight-box.scrollTop-box.clientHeight<80)box.scrollTop=box.scrollHeight;}
    }else if(ex){ex.parentNode.removeChild(ex);}
  }
  function showMsgView(v){
    $('msgInbox').classList.toggle('hidden',v!=='inbox');
    $('msgNewPane').classList.toggle('hidden',v!=='new');
    $('msgThread').classList.toggle('hidden',v!=='thread');
  }
  function setMsgBadge(n){
    var b=$('msgBadge');
    if(n>0){b.textContent=n>99?'99+':n;b.classList.remove('hidden');}else{b.classList.add('hidden');}
  }
  function refreshMsgBadge(){
    api('/api/messages/unread').then(function(res){if(res.ok){setMsgBadge(res.data.unread||0);paintGlobalBadge(res.data.globalLatestId||'');}});
  }

  function openMessages(){
    api('/api/users').then(function(res){ if(res.ok) msgUsernames=res.data.usernames||[]; });
    threadPartner=null;
    showMsgView('inbox');
    loadInbox();
    startMsgPoll();
  }
  function loadInbox(){
    api('/api/messages').then(function(res){
      if(!res.ok)return;
      setMsgBadge(res.data.unread||0);
      renderConvos(res.data.conversations||[]);
    });
  }
  function renderConvos(list){
    var L=$('convoList');L.innerHTML='';
    $('convoEmpty').classList.toggle('hidden',list.length>0);
    list.forEach(function(c){
      var row=document.createElement('div');row.className='convo';
      var prev=(c.last.mine?'You: ':'')+(c.last.text||'');
      var preview=c.typing?'<span class="typing-txt">typing<span class="td">…</span></span>':esc(prev);
      row.innerHTML='<div class="av">'+esc((c.with||'?').charAt(0))+'</div>'+
        '<div class="cmid"><div class="cname"><span class="pdot'+(c.online?' on':'')+'"></span>'+esc(c.with)+'</div>'+
        '<div class="cprev'+(c.unread?' un':'')+(c.typing?' typing':'')+'">'+preview+'</div></div>'+
        '<div class="cmeta"><div class="ctime">'+relTime(c.last.at)+'</div>'+
        (c.unread?'<div class="cunread">'+(c.unread>99?'99+':c.unread)+'</div>':'')+'</div>';
      row.onclick=function(){openThread(c.with);};
      L.appendChild(row);
    });
  }
  function openThread(name){
    threadPartner=name;threadSig='';
    $('threadWith').textContent=name;
    $('threadMsgs').innerHTML='';
    $('threadEmpty').classList.add('hidden');
    $('threadDot').className='pdot';$('threadStatus').textContent='';
    showMsgView('thread');
    fetchThread(true);
    setTimeout(function(){$('threadInput').focus();},60);
  }
  function fetchThread(scroll){
    if(!threadPartner)return;
    api('/api/messages/thread',{method:'POST',body:{with:threadPartner}}).then(function(res){
      if(!res.ok||threadPartner==null)return;
      renderThread(res.data.messages||[],scroll);
      setPresence(!!res.data.online);
      showTyping(!!res.data.typing);
      setMsgBadge(0); // opening/viewing marks this thread read; refresh global count
      refreshMsgBadge();
    });
  }
  function setPresence(online){
    $('threadDot').className='pdot'+(online?' on':'');
    $('threadStatus').textContent=online?'Online':'Offline';
  }
  function renderThread(messages,forceScroll){
    var sig=messages.map(function(m){return m.id;}).join(',');
    if(sig===threadSig&&!forceScroll)return; // nothing new (keeps typing bubble intact)
    var box=$('threadMsgs');
    var atBottom=box.scrollHeight-box.scrollTop-box.clientHeight<40;
    threadSig=sig;
    box.innerHTML='';
    $('threadEmpty').classList.toggle('hidden',messages.length>0);
    messages.forEach(function(m){
      var b=document.createElement('div');b.className='bub '+(m.mine?'me':'them');
      var who=m.mine?'You':esc(m.from||threadPartner);
      b.innerHTML=esc(m.text)+'<span class="bt">'+who+' · '+msgTime(m.at)+'</span>';
      box.appendChild(b);
    });
    if(forceScroll||atBottom)box.scrollTop=box.scrollHeight;
  }
  function sendThreadMsg(){
    var t=$('threadInput').value.trim();
    if(!t||!threadPartner)return;
    var inp=$('threadInput');inp.value='';inp.focus();
    api('/api/message',{method:'POST',body:{to:threadPartner,text:t}}).then(function(res){
      if(!res.ok){msg(res.data.error||'Could not send.','err');inp.value=t;return;}
      fetchThread(true);
    }).catch(function(){msg('Network error.','err');inp.value=t;});
  }
  $('threadSend').onclick=sendThreadMsg;
  $('threadInput').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();sendThreadMsg();}});
  // tell the other side we're typing (throttled — at most one ping every 2.5s)
  var lastTypingPing=0;
  $('threadInput').addEventListener('input',function(){
    if(!threadPartner||!$('threadInput').value)return;
    var now=Date.now();if(now-lastTypingPing<2500)return;lastTypingPing=now;
    api('/api/messages/typing',{method:'POST',body:{with:threadPartner}});
  });
  $('msgBack').onclick=function(){threadPartner=null;showMsgView('inbox');loadInbox();};
  $('msgNew').onclick=function(){$('msgUser').value='';$('msgSuggest').classList.add('hidden');showMsgView('new');setTimeout(function(){$('msgUser').focus();},60);};
  $('newBack').onclick=function(){showMsgView('inbox');};
  $('newStart').onclick=function(){
    var to=$('msgUser').value.trim();
    if(!to){msg('Pick a username.','err');return;}
    openThread(to);
  };

  function startMsgPoll(){
    stopMsgPoll();
    var tick=0;
    // Poll every 1.5s so typing/online stay accurate. In a thread we refetch
    // every tick; on the inbox we refresh every other tick to keep it lighter.
    msgPoll=setInterval(function(){
      if($('page-messages').classList.contains('hidden')){stopMsgPoll();return;}
      tick++;
      if(threadPartner)fetchThread(false); else if(tick%2===0)loadInbox();
    },4000);
  }
  function stopMsgPoll(){ if(msgPoll){clearInterval(msgPoll);msgPoll=null;} }

  // keep the sidebar message badge fresh + broadcast our presence (heartbeat),
  // app-wide on a light interval once logged in.
  var badgePoll=null;
  function heartbeat(){ api('/api/heartbeat',{method:'POST'}); }
  function startBadgePoll(){ if(badgePoll)return; heartbeat();refreshMsgBadge();refreshSupportBadge(); badgePoll=setInterval(function(){heartbeat();refreshMsgBadge();refreshSupportBadge();},12000); }


  function renderSuggest(){
    var q=$('msgUser').value.trim().toLowerCase(), box=$('msgSuggest');
    if(!q){box.classList.add('hidden');box.innerHTML='';return;}
    var matches=msgUsernames.filter(function(u){return u.toLowerCase().indexOf(q)===0;}).slice(0,8);
    if(!matches.length){box.classList.add('hidden');box.innerHTML='';return;}
    msgHl=-1;
    box.innerHTML=matches.map(function(u){return '<div class="s" data-u="'+u.replace(/"/g,'&quot;')+'"><b>'+u.slice(0,q.length).replace(/</g,'&lt;')+'</b>'+u.slice(q.length).replace(/</g,'&lt;')+'</div>';}).join('');
    box.classList.remove('hidden');
    Array.prototype.forEach.call(box.querySelectorAll('.s'),function(el){
      el.onclick=function(){openThread(el.getAttribute('data-u'));};
    });
  }
  $('msgUser').addEventListener('input',renderSuggest);
  $('msgUser').addEventListener('keydown',function(e){
    var box=$('msgSuggest'),items=box.querySelectorAll('.s');
    if(e.key==='Enter'&&box.classList.contains('hidden')){e.preventDefault();$('newStart').click();return;}
    if(box.classList.contains('hidden')||!items.length)return;
    if(e.key==='ArrowDown'){e.preventDefault();msgHl=Math.min(items.length-1,msgHl+1);}
    else if(e.key==='ArrowUp'){e.preventDefault();msgHl=Math.max(0,msgHl-1);}
    else if(e.key==='Enter'){e.preventDefault();openThread(items[msgHl>=0?msgHl:0].getAttribute('data-u'));return;}
    else if(e.key==='Escape'){box.classList.add('hidden');return;}
    else return;
    Array.prototype.forEach.call(items,function(el,i){el.classList.toggle('hl',i===msgHl);});
  });

  // notifications — every notification has its own "Mark as read" button, which
  // tells the server to stop displaying it. The bell badge = how many remain.
  function setBadge(n){
    var b=$('navBadge');
    if(n>0){b.textContent=n;b.classList.remove('hidden');}else{b.classList.add('hidden');}
  }
  function renderNotifs(){
    var L=$('notifList');L.innerHTML='';
    var list=(state.notifications||[]).slice().reverse();
    $('notifEmpty').classList.toggle('hidden',list.length>0);
    setBadge((state.notifications||[]).length);
    list.forEach(function(n){
      var d=document.createElement('div');d.className='notif'+(n.from==='announcement'?' ann':'');
      var body=document.createElement('div');body.className='body';
      var tag=n.from==='announcement'?'<span class="ntag">Announcement</span>':'';
      body.innerHTML='<div class="nt">'+tag+(n.text||'').replace(/</g,'&lt;')+'</div><div class="nd">'+new Date(n.at).toLocaleString()+'</div>';
      var mark=document.createElement('button');mark.className='mark';mark.type='button';mark.textContent='Mark as read';
      mark.onclick=function(){
        mark.disabled=true;mark.textContent='…';
        api('/api/notifications/dismiss',{method:'POST',body:{id:n.id}}).then(function(res){
          if(res.ok){
            state.notifications=res.data.notifications||(state.notifications||[]).filter(function(x){return x.id!==n.id;});
            renderNotifs();
          }else{mark.disabled=false;mark.textContent='Mark as read';msg(res.data.error||'Could not update.','err');}
        }).catch(function(){mark.disabled=false;mark.textContent='Mark as read';msg('Network error.','err');});
      };
      d.appendChild(body);d.appendChild(mark);L.appendChild(d);
    });
  }
  function openNotifs(){ renderNotifs(); }
  $('notifClear').onclick=function(){
    api('/api/notifications/clear',{method:'POST'}).then(function(){state.notifications=[];renderNotifs();msg('Cleared.','ok');});
  };
  function refreshNotifs(){
    api('/api/notifications').then(function(res){
      if(res.ok){state.notifications=res.data.notifications||[];setBadge(state.notifications.filter(function(n){return !n.read;}).length);}
    });
  }

  // release notes
  function releaseSeen(){try{return localStorage.getItem('scale_xt_seen_release')||'';}catch(e){return'';}}
  function setReleaseSeen(id){try{localStorage.setItem('scale_xt_seen_release',id);}catch(e){}}
  function paintReleaseBadge(){
    var latest=state.releases&&state.releases[0],badge=$('releaseBadge');
    if(latest&&releaseSeen()!==latest.id){badge.classList.remove('hidden');}else{badge.classList.add('hidden');}
  }
  function loadReleases(markSeen){
    api('/api/releases').then(function(res){
      if(!res.ok)return;
      state.releases=res.data.releases||[];
      var list=$('releaseList');list.innerHTML='';
      $('releaseEmpty').classList.toggle('hidden',state.releases.length>0);
      state.releases.forEach(function(release){
        var card=document.createElement('article');card.className='release-card';
        var meta=document.createElement('div');meta.className='release-meta';meta.textContent='v'+(release.version||'')+' · '+fmtDate(release.at);
        var title=document.createElement('h3');title.textContent=release.title||'Scale XT update';
        var copy=document.createElement('p');copy.textContent=release.text||'';
        card.appendChild(meta);card.appendChild(title);card.appendChild(copy);list.appendChild(card);
      });
      $('releaseCount').textContent=state.releases.length+' release'+(state.releases.length===1?'':'s');
      if(markSeen&&state.releases[0])setReleaseSeen(state.releases[0].id);
      paintReleaseBadge();
    });
  }
  function checkReleases(){loadReleases(false);}

  // vault page
  function loadVault(){
    $('vPool').textContent='…';$('vTotal').textContent='…';$('vBlocked').textContent='…';$('vRemain').textContent='…';
    api('/api/stats').then(function(res){
      if(!res.ok){msg(res.data.error||'Could not load vault.','err');return;}
      var d=res.data;
      $('vPool').textContent=d.poolSize;$('vTotal').textContent=d.totalLinks;$('vBlocked').textContent=d.blockedCount;
      var pct=Math.max(0,Math.min(100,Math.round(Number(d.usagePercent)||0)));
      var available=Math.max(0,Math.floor(Number(d.usageAvailable)||0));
      $('vRemain').textContent=available+' available · '+pct+'% used';
      if(state.account){
        state.account.usagePercent=pct;
        state.account.usageAvailable=available;
        state.account.usageCredits=Math.max(0,Math.floor(Number(d.usageCredits)||0));
        state.account.resetAt=d.resetAt||state.account.resetAt;
        renderUsage(state.account);
      }
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
      if(res.data.token)setToken(res.data.token);
      $('pwCurrent').value='';$('pwNew').value='';msg('Password updated. Other sessions were signed out.','ok');
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };
  $('logoutAllBtn').onclick=function(){
    var button=$('logoutAllBtn');button.disabled=true;msg('Signing out every device...','');
    api('/api/logout-all',{method:'POST'}).then(function(res){button.disabled=false;if(!res.ok){msg(res.data.error||'Could not revoke sessions.','err');return;}doLogout(false);msg('All devices signed out.','ok');}).catch(function(){button.disabled=false;msg('Network error.','err');});
  };

  function doLogout(callApi){
    if(callApi!==false)api('/api/logout',{method:'POST'});
    if(pendingDelete){clearTimeout(pendingDelete.timer);pendingDelete=null;$('undoDelete').classList.add('hidden');}
    stopMsgPoll();stopGlobalPoll();stopSupportPoll();if(badgePoll){clearInterval(badgePoll);badgePoll=null;}setMsgBadge(0);setSupportBadge(0);threadPartner=null;supportId=null;
    setToken('');state.username=null;state.account=null;state.links=[];applySettings(DEFAULTS);showAuth();setMode('login');msg('Logged out.','ok');
  }
  $('logoutBtn').onclick=doLogout;
  $('logoutMenuBtn').onclick=doLogout;

  var maintenancePoll=null;
  function paintMaintenance(maintenance){
    maintenance=maintenance||{};
    var panel=$('maintenanceMode');
    if(maintenance.enabled){
      $('maintenanceNotice').textContent=maintenance.message||'Scale XT is temporarily unavailable while maintenance is in progress.';
      $('maintenanceSince').textContent=maintenance.startedAt?'Started '+new Date(maintenance.startedAt).toLocaleString():'Check back shortly.';
      panel.classList.remove('hidden');
    }else{
      panel.classList.add('hidden');
    }
  }
  function checkMaintenance(){
    api('/api/maintenance').then(function(res){
      if(res.ok){paintMaintenance(res.data.maintenance);setSignupsEnabled(res.data.signupsEnabled!==false);}
    }).catch(function(){});
  }
  function startMaintenanceWatch(){
    checkMaintenance();
    if(!maintenancePoll)maintenancePoll=setInterval(checkMaintenance,10000);
  }

  // version / update check
  function isNewer(a,b){
    var pa=String(a).split('.').map(Number),pb=String(b).split('.').map(Number);
    for(var i=0;i<3;i++){var x=pa[i]||0,y=pb[i]||0;if(x>y)return true;if(x<y)return false;}
    return false;
  }
  var latestVersion=APP_VERSION,versionPoll=null;
  function updateReady(){return !!latestVersion&&isNewer(latestVersion,INSTALLED_VERSION);}
  function paintVersionState(){
    var ready=updateReady(),latest=latestVersion||APP_VERSION;
    $('versionLabel').textContent='v'+INSTALLED_VERSION;
    $('versionState').textContent=ready?'Update ready':'Current';
    $('versionDot').classList.toggle('update',ready);
    $('versionBtn').classList.toggle('update',ready);
    $('updatesInstalled').textContent='v'+INSTALLED_VERSION;
    $('updatesLatest').textContent='v'+latest;
    $('updatesAction').textContent=ready?'Install update':'Check again';
    $('updatesAction').classList.toggle('attention',ready);
    $('helpVersion').textContent='v'+INSTALLED_VERSION;
    $('helpVersionState').textContent=ready?' · v'+latest+' is ready':' · up to date';
    if($('acVersion'))$('acVersion').textContent='v'+INSTALLED_VERSION;
    if($('acLatest'))$('acLatest').textContent='v'+latest;
  }
  function checkVersion(announce){
    return api('/api/version').then(function(res){
      if(!res.ok||!res.data.version)throw new Error('version unavailable');
      latestVersion=res.data.version;paintVersionState();
      var bar=$('updateBar');
      if(updateReady()){
        bar.innerHTML='<span class="update-toast-icon">↑</span><span><b>Scale XT v'+latestVersion+' is ready</b><small>You are using v'+INSTALLED_VERSION+'. Tap to update.</small></span>';
        bar.classList.remove('hidden');bar.onclick=openUpdate;
      }else{
        bar.classList.add('hidden');bar.onclick=null;
        if(announce)msg('Scale XT v'+INSTALLED_VERSION+' is up to date.','ok');
      }
    }).catch(function(){
      $('versionState').textContent='Check failed';
      $('updatesLatest').textContent='Unavailable';
      if(announce)msg('Could not check for updates.','err');
    });
  }
  function startVersionWatch(){if(versionPoll)return;versionPoll=setInterval(function(){checkVersion(false);},900000);}
  function openUpdate(){
    var target=latestVersion||APP_VERSION;
    $('updVer').textContent=updateReady()?'v'+INSTALLED_VERSION+'  →  v'+target:'Installed v'+INSTALLED_VERSION;
    $('updCode').textContent='Loading latest version…';
    $('updModal').classList.remove('hidden');
    api('/api/bookmarklet').then(function(res){
      if(res.ok&&res.data.code){
        $('updCode').textContent=res.data.code;
        if(res.data.version){
          latestVersion=res.data.version;paintVersionState();
          $('updVer').textContent=isNewer(res.data.version,INSTALLED_VERSION)?'v'+INSTALLED_VERSION+'  →  v'+res.data.version:'Latest version: v'+res.data.version;
        }
      }else{$('updCode').textContent='Could not load the latest code. Try again, or reinstall from the site.';}
    }).catch(function(){$('updCode').textContent='Network error — could not load the latest code.';});
  }
  $('updatesAction').onclick=function(){if(updateReady())openUpdate();else checkVersion(true);};
  $('helpUpdate').onclick=openUpdate;
  $('updClose').onclick=function(){$('updModal').classList.add('hidden');};
  $('updModal').onclick=function(e){if(e.target===$('updModal'))$('updModal').classList.add('hidden');};
  $('updCopy').onclick=function(){
    var text=$('updCode').textContent||'';
    if(!text||text.indexOf('javascript:')!==0){msg('Nothing to copy yet.','err');return;}
    function done(){msg('Copied! Paste it over your bookmark’s URL.','ok');}
    function fallback(){var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(e){msg('Copy failed — select the code and copy manually.','err');}document.body.removeChild(ta);}
    try{if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,fallback);}else fallback();}catch(e){fallback();}
  };
  // Remove the loader as soon as the real session check is complete.
  function hideLoader(){
    var l=$('loader');if(!l||l._hiding)return;l._hiding=true;
    requestAnimationFrame(function(){
      l.classList.add('fade');
      setTimeout(function(){if(l.parentNode)l.parentNode.removeChild(l);},160);
    });
  }

  (function init(){
    setMode('login');applyTheme('void');paintVersionState();checkVersion(false);startVersionWatch();startMaintenanceWatch();
    if(token()){
      api('/api/me').then(function(res){
        if(res.ok){state.username=res.data.username;applySettings(res.data.settings);state.account=res.data.account||null;state.links=res.data.links||[];state.pinned=res.data.pinned||[];state.notifications=res.data.notifications||[];showApp();renderLinks(state.links);setBadge((res.data.notifications||[]).length);setMsgBadge(res.data.messagesUnread||0);startBadgePoll();}
        else{setToken('');showAuth();}
        hideLoader();
      }).catch(function(){showAuth();hideLoader();});
    }else{showAuth();hideLoader();}
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
    'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(2,5,6,0.82);z-index:99999999;opacity:0;transition:opacity .16s ease;display:flex;justify-content:center;align-items:center;';

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  wrapper.style.cssText =
    'position:relative;width:min(980px,94vw);height:min(690px,90vh);background:#050505;border-radius:8px;box-shadow:0 30px 100px rgba(0,0,0,0.68),0 0 0 1px #333;overflow:hidden;transform:scale(0.985) translateY(4px);transition:transform .16s ease-out;';

  const closeBtn = document.createElement('div');
  closeBtn.innerHTML = '&#x2715;';
  closeBtn.style.cssText =
    'position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:4px;border:1px solid #333;background:#0b0b0b;color:#8a8a8a;font-family:Consolas,monospace;font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:.12s;z-index:100000000;user-select:none;';
  closeBtn.addEventListener('mouseenter', function () { closeBtn.style.background = '#fff'; closeBtn.style.color = '#000'; });
  closeBtn.addEventListener('mouseleave', function () { closeBtn.style.background = '#0b0b0b'; closeBtn.style.color = '#8a8a8a'; });

  const iframe = document.createElement('iframe');
  iframe.title = 'Scale XT';
  iframe.src = APP_URL;
  iframe.style.cssText = 'width:100%;height:100%;border:none;background:#050505;';

  wrapper.appendChild(closeBtn);
  wrapper.appendChild(iframe);
  overlay.appendChild(wrapper);
  document.body.appendChild(overlay);

  requestAnimationFrame(function () {
    overlay.style.opacity = '1';
    wrapper.style.transform = 'scale(1) translateY(0)';
  });


  function closePopup(el) {
    const targetOverlay = el || overlay;
    const targetWrapper = targetOverlay.querySelector('#' + WRAPPER_ID);
    if (targetWrapper) targetWrapper.style.transform = 'scale(0.985)';
    targetOverlay.style.opacity = '0';
    setTimeout(function () {
      if (targetOverlay.parentNode) targetOverlay.parentNode.removeChild(targetOverlay);
    }, 170);
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
