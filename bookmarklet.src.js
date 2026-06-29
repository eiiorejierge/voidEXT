/* =============================================================================
 * Nebula bookmarklet (readable source)
 * -----------------------------------------------------------------------------
 * Large black & white space-themed app popup (starfield, sidebar menu) that
 * works end to end:
 *   - Log in / Sign up against the Nebula site
 *   - Links page: generate your daily set (5/day), copy-all, open-all, report
 *   - Settings page: theme + behavior toggles, saved to your account
 *   - Account page: username, member-since, daily usage
 *
 * ALL UI renders inside the popup. NO alert()/confirm()/prompt().
 *
 * Build the one-line bookmark with:  node build-bookmarklet.js
 * ============================================================================= */
(function () {
  // <<< CONFIG >>> Point this at your deployed site (no trailing slash).
  const API_BASE = 'https://nebulabkm.xyz';

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
<title>Nebula</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
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
    <div class="updh">Update Nebula</div>
    <div class="updver" id="updVer">—</div>
    <ol class="updsteps">
      <li>Right-click your <b>Nebula</b> bookmark and choose <b>Edit</b>.</li>
      <li>Select everything in the <b>URL</b> field and replace it with the code below.</li>
      <li>Save, then re-open Nebula. Done — no website needed.</li>
    </ol>
    <div class="updbox" id="updCode">Loading latest version…</div>
    <button class="btn" id="updCopy" style="width:100%;margin-top:12px;">Copy new bookmarklet</button>
  </div>
</div>
<div id="loader" class="loader">
  <div class="warp"></div>
  <div class="orbit"><span class="ringline"></span><span class="planet"></span></div>
  <div class="lbrand">NEBULA</div>
</div>
<div class="shell">

  <!-- AUTH -->
  <div id="authWrap" class="authcard">
    <div class="brandhead">
      <div class="logo"><svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="11" ry="4"/></svg></div>
      <h2>Nebula</h2>
      <p>Enter the nebula</p>
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
      <div class="brand"><span class="d"></span><span class="nm">Nebula</span></div>
      <button class="navitem active" data-nav="links"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 14.5l5-5"/><path d="M11 6.5l1-1a3.5 3.5 0 0 1 5 5l-1 1"/><path d="M13 17.5l-1 1a3.5 3.5 0 0 1-5-5l1-1"/></svg></span> Links</button>
      <button class="navitem" data-nav="report"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h12l-2 3.5L17 11H5"/></svg></span> Report</button>
      <button class="navitem" data-nav="bug"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 8a3 3 0 0 1 6 0"/><rect x="8" y="8" width="8" height="9" rx="4"/><path d="M12 8.5v8.5M4 11h4M16 11h4M4.5 16.5h3.5M16 16.5h3.5M5 7l2 1.5M19 7l-2 1.5"/></svg></span> Bug</button>
      <button class="navitem" data-nav="messages"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a7 7 0 0 1-9.5 6.5L5 19.5l1.4-4A7 7 0 1 1 20 11.5z"/></svg></span> Messages <span class="badge hidden" id="msgBadge">0</span></button>
      <button class="navitem" data-nav="notifs"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7"/><path d="M10.5 19.5a2 2 0 0 0 3 0"/></svg></span> Notifications <span class="badge hidden" id="navBadge">0</span></button>
      <button class="navitem" data-nav="vault"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9.5V18a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 18V9.5"/><path d="M10 13h4"/></svg></span> Vault</button>
      <button class="navitem" data-nav="account"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg></span> Account</button>
      <button class="navitem" data-nav="settings"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg></span> Settings</button>
      <button class="navitem" data-nav="help"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.7 1.2c0 1.6-2.2 2-2.2 3.3"/><path d="M12 17.2v.01"/></svg></span> Help</button>
      <div class="spacer"></div>
      <button class="navitem logout" id="logoutBtn"><span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8V5.5A1.5 1.5 0 0 0 12.5 4H6A1.5 1.5 0 0 0 4.5 5.5v13A1.5 1.5 0 0 0 6 20h6.5a1.5 1.5 0 0 0 1.5-1.5V16"/><path d="M9.5 12h10M16.5 9l3 3-3 3"/></svg></span> Log out</button>
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
        <div class="psub">Personalize your nebula. Saved to your account.</div>
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
      <!-- BUG -->
      <section id="page-bug" class="hidden">
        <div class="ptitle">Report a Bug</div>
        <div class="psub">Found something broken? Tell us what happened. Helpful reports can earn you up to <b>10 link tokens</b> once reviewed.</div>
        <textarea id="bugText" placeholder="Describe the bug — what you did, what you expected, what happened instead..."></textarea>
        <button class="btn" id="bugBtn" style="margin-top:12px;">Submit bug report</button>
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
          <div class="inforow"><span class="k">Your link tokens</span><span class="v" id="vRemain">—</span></div>
        </div>
      </section>
      <!-- ACCOUNT -->
      <section id="page-account" class="hidden">
        <div class="ptitle">Account</div>
        <div class="psub">Your nebula credentials.</div>
        <div class="info">
          <div class="inforow"><span class="k">Username</span><span class="v" id="acUser">—</span></div>
          <div class="inforow"><span class="k">Member since</span><span class="v" id="acSince">—</span></div>
          <div class="inforow"><span class="k">Link tokens</span><span class="v" id="acRemain">—</span></div>
          <div class="inforow"><span class="k">Theme</span><span class="v" id="acTheme">—</span></div>
        </div>
        <span class="flabel" style="margin-top:26px;">Send a link token</span>
        <div class="psub" style="margin-bottom:12px;">Gift one of your link tokens to another user — max 1 per person per hour.</div>
        <div class="info" style="max-width:360px;">
          <div style="position:relative;">
            <input id="giftUser" type="text" placeholder="Username" autocomplete="off" style="letter-spacing:0;">
            <div id="giftSuggest" class="suggest hidden"></div>
          </div>
          <button class="btn" id="giftBtn" style="width:100%;">Send 1 token</button>
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
        <div class="psub">How Nebula works.</div>
        <div class="info">
          <p style="line-height:1.7;margin-bottom:12px;">• Hit <b>Generate Links</b> on the Links page to pull your daily set (5 per day). Your set is saved — it loads automatically next time.</p>
          <p style="line-height:1.7;margin-bottom:12px;">• Click <b>Link 1</b>, <b>Link 2</b>… to open them. Use <b>Open all</b> to launch every link at once.</p>
          <p style="line-height:1.7;margin-bottom:12px;">• If a link is dead or blocked, tap <b>blocked</b> on it — it's pulled from everyone's rotation and reported.</p>
          <p style="line-height:1.7;margin-bottom:12px;">• <b>Vault</b> shows how many links are still live. <b>Settings</b> changes your theme and behavior.</p>
          <p style="line-height:1.7;color:var(--muted);">Links are stored on the server and shown as labels so the URLs don't leak over your shoulder.</p>
          <p style="margin-top:16px;color:var(--muted);font-size:12px;">Nebula <b>v__VERSION__</b></p>
          <button class="btn ghost" id="helpUpdate" style="margin-top:14px;">Update Nebula</button>
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
  var state={mode:'login',settings:Object.assign({},DEFAULTS),draft:null,account:null,links:[],pinned:[],notifications:[],unread:0,reportSel:{}};

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
    ['links','report','bug','messages','notifs','vault','account','settings','help'].forEach(function(p){
      $('page-'+p).classList.toggle('hidden',p!==page);
    });
    document.querySelectorAll('[data-nav]').forEach(function(el){el.classList.toggle('active',el.getAttribute('data-nav')===page);});
    if(page==='settings')openSettings();
    if(page==='account')renderAccount();
    if(page==='vault')loadVault();
    if(page==='report')renderReport();
    if(page==='messages')openMessages(); else stopMsgPoll();
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
        setToken(res.data.token);state.username=res.data.username;applySettings(res.data.settings);state.account=res.data.account||null;state.links=res.data.links||[];state.pinned=res.data.pinned||[];state.notifications=res.data.notifications||[];
        clearMsg();showApp();renderLinks(state.links);setBadge((res.data.notifications||[]).length);setMsgBadge(res.data.messagesUnread||0);startBadgePoll();
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
    var pinSet={};(state.pinned||[]).forEach(function(u){pinSet[u]=true;});
    var ordered=links.slice().sort(function(a,b){
      var pa=pinSet[a]?1:0,pb=pinSet[b]?1:0;
      if(pa!==pb)return pb-pa;                 // pinned to the top
      return links.indexOf(a)-links.indexOf(b);// otherwise keep original order
    });
    var PIN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l-1 6 3 3H7l3-3-1-6z"/></svg>';
    var TRASH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg>';
    ordered.forEach(function(url,idx){
      var li=document.createElement('li');if(pinSet[url])li.className='pinned';
      var a=document.createElement('a');a.href=url;a.target=state.settings.openInNewTab?'_blank':'_top';a.rel='noopener noreferrer';a.textContent='Link '+(idx+1);
      var pin=document.createElement('button');pin.type='button';pin.className='lact'+(pinSet[url]?' on':'');pin.title=pinSet[url]?'Unpin':'Pin';pin.innerHTML=PIN;
      pin.onclick=function(){togglePin(url,!pinSet[url]);};
      var del=document.createElement('button');del.type='button';del.className='lact';del.title='Delete';del.innerHTML=TRASH;
      del.onclick=function(){
        if(del.getAttribute('data-c')==='1'){deleteLink(url);return;}
        del.setAttribute('data-c','1');del.classList.add('confirm');del.title='Click again to delete';
        setTimeout(function(){del.removeAttribute('data-c');del.classList.remove('confirm');del.title='Delete';},2500);
      };
      li.appendChild(a);li.appendChild(pin);li.appendChild(del);L.appendChild(li);
    });
  }
  function togglePin(url,pin){
    api('/api/links/pin',{method:'POST',body:{url:url,pinned:pin}}).then(function(res){
      if(!res.ok){msg(res.data.error||'Could not update.','err');return;}
      state.links=res.data.links||state.links;state.pinned=res.data.pinned||[];renderLinks(state.links);
    }).catch(function(){msg('Network error.','err');});
  }
  function deleteLink(url){
    api('/api/links/delete',{method:'POST',body:{url:url}}).then(function(res){
      if(!res.ok){msg(res.data.error||'Could not delete.','err');return;}
      state.links=res.data.links||[];state.pinned=res.data.pinned||[];renderLinks(state.links);msg('Link deleted.','ok');
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
    $('acUser').textContent=state.username||'—';
    $('acSince').textContent=fmtDate(a.created);
    var rem=(a.remaining==null?(a.limit||5):a.remaining);
    $('acRemain').textContent=rem+' link token'+(rem===1?'':'s');
    $('acTheme').textContent=state.settings.theme;
    api('/api/users').then(function(res){ if(res.ok) giftUsers=res.data.usernames||[]; });
  }

  // gift a link token to another user (autocomplete + send; server caps 1/hr/person)
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
    var b=$('giftBtn');b.disabled=true;msg('Sending token...','');
    api('/api/send-token',{method:'POST',body:{to:to}}).then(function(res){
      b.disabled=false;
      if(!res.ok){msg(res.data.error||'Could not send.','err');return;}
      if(res.data.account){state.account=res.data.account;renderAccount();}
      $('giftUser').value='';$('giftSuggest').classList.add('hidden');
      msg('Sent 1 token to '+res.data.sentTo+'.','ok');
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
    api('/api/report',{method:'POST',body:{urls:urls}}).then(function(res){
      b.disabled=false;
      if(!res.ok){msg(res.data.error||'Could not report.','err');return;}
      msg('Reported '+res.data.reported+' link(s) for review.','ok');renderReport();
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };

  // bug report
  $('bugBtn').onclick=function(){
    var t=$('bugText').value.trim();
    if(t.length<5){msg('Describe the bug in a bit more detail.','err');return;}
    var b=$('bugBtn');b.disabled=true;msg('Submitting...','');
    api('/api/bug',{method:'POST',body:{text:t}}).then(function(res){
      b.disabled=false;
      if(!res.ok){msg(res.data.error||'Could not submit.','err');return;}
      $('bugText').value='';msg('Thanks! Your bug report was submitted for review.','ok');
    }).catch(function(){b.disabled=false;msg('Network error.','err');});
  };

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
    api('/api/messages/unread').then(function(res){if(res.ok)setMsgBadge(res.data.unread||0);});
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
    },1500);
  }
  function stopMsgPoll(){ if(msgPoll){clearInterval(msgPoll);msgPoll=null;} }

  // keep the sidebar message badge fresh + broadcast our presence (heartbeat),
  // app-wide on a light interval once logged in.
  var badgePoll=null;
  function heartbeat(){ api('/api/heartbeat',{method:'POST'}); }
  function startBadgePoll(){ if(badgePoll)return; heartbeat();refreshMsgBadge(); badgePoll=setInterval(function(){heartbeat();refreshMsgBadge();},12000); }


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
    stopMsgPoll();if(badgePoll){clearInterval(badgePoll);badgePoll=null;}setMsgBadge(0);threadPartner=null;
    setToken('');state.username=null;state.account=null;state.links=[];applySettings(DEFAULTS);showAuth();setMode('login');msg('Logged out.','ok');
  };

  // version / update check
  function isNewer(a,b){
    var pa=String(a).split('.').map(Number),pb=String(b).split('.').map(Number);
    for(var i=0;i<3;i++){var x=pa[i]||0,y=pb[i]||0;if(x>y)return true;if(x<y)return false;}
    return false;
  }
  var latestVersion=null;
  function checkVersion(){
    api('/api/version').then(function(res){
      if(res.ok&&res.data.version&&isNewer(res.data.version,BUILT_VERSION)){
        latestVersion=res.data.version;
        var bar=$('updateBar');
        bar.innerHTML='<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:5px;"><path d="M12 19V6M6 12l6-6 6 6"/></svg>Update available: <b>v'+BUILT_VERSION+'</b> → <b>v'+latestVersion+'</b> · tap to update';
        bar.classList.remove('hidden');
        bar.onclick=openUpdate;
      }
    }).catch(function(){});
  }
  function openUpdate(){
    $('updVer').textContent='v'+BUILT_VERSION+'  →  v'+(latestVersion||'?');
    $('updCode').textContent='Loading latest version…';
    $('updModal').classList.remove('hidden');
    api('/api/bookmarklet').then(function(res){
      if(res.ok&&res.data.code){
        $('updCode').textContent=res.data.code;
        if(res.data.version)$('updVer').textContent='v'+BUILT_VERSION+'  →  v'+res.data.version;
      }else{$('updCode').textContent='Could not load the latest code. Try again, or reinstall from the site.';}
    }).catch(function(){$('updCode').textContent='Network error — could not load the latest code.';});
  }
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

  // Hold the cutscene on screen for a minimum beat so the intro animation always
  // plays, even when the session data comes back instantly, then fade + remove.
  var LOADER_AT=Date.now(), LOADER_MIN=2000;
  function hideLoader(){
    var l=$('loader');if(!l||l._hiding)return;l._hiding=true;
    var wait=Math.max(0,LOADER_MIN-(Date.now()-LOADER_AT));
    setTimeout(function(){
      l.classList.add('fade');
      setTimeout(function(){if(l.parentNode)l.parentNode.removeChild(l);},600);
    },wait);
  }

  (function init(){
    setMode('login');applyTheme('void');checkVersion();
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
    'position:fixed;top:0;left:0;width:100vw;height:100vh;background:radial-gradient(circle at 50% 40%,rgba(40,12,70,0.6),rgba(4,2,12,0.74));backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);z-index:99999999;opacity:0;transition:opacity .25s ease;display:flex;justify-content:center;align-items:center;';

  const wrapper = document.createElement('div');
  wrapper.id = WRAPPER_ID;
  wrapper.style.cssText =
    'position:relative;width:min(960px,94vw);height:min(680px,90vh);background:transparent;border-radius:20px;box-shadow:0 40px 90px -20px rgba(124,58,237,0.55),0 10px 40px -10px rgba(236,72,153,0.4),0 0 0 1px rgba(255,255,255,0.06);overflow:hidden;transform:scale(0.97);transition:transform .25s cubic-bezier(0.34,1.3,0.64,1);';

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
