/* Unclinq cookie/tracking consent — geo-gated, shared by the static pages.
 * EU/UK visitors see a soft opt-in strip; tracking (PostHog + Meta Pixel) waits
 * for OK. Everyone else is tracked by default with no banner. Register tracking
 * via unclinqOnConsent(cb) — cb runs only when consent effectively applies. */
(function () {
  var KEY = 'unclinq_consent';
  var callbacks = [];
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function isEU() {
    try { return (Intl.DateTimeFormat().resolvedOptions().timeZone || '').indexOf('Europe/') === 0; }
    catch (e) { return false; }
  }
  // Explicit choice wins; else non-EU defaults on, EU defaults off until OK.
  function effective() { var c = get(); if (c) return c; return isEU() ? 'denied' : 'granted'; }

  window.unclinqConsentGranted = function () { return effective() === 'granted'; };
  window.unclinqOnConsent = function (cb) {
    if (effective() === 'granted') { try { cb(); } catch (e) {} }
    else if (isEU() && !get()) { callbacks.push(cb); } // EU, undecided → wait for OK
    // denied → never
  };

  function run() { callbacks.forEach(function (cb) { try { cb(); } catch (e) {} }); callbacks = []; }
  function hide() { var b = document.getElementById('uq-consent'); if (b) b.parentNode.removeChild(b); }
  function grant() { set('granted'); hide(); run(); }
  function deny() { set('denied'); hide(); callbacks = []; }

  function show() {
    if (document.getElementById('uq-consent')) return;
    var d = document.createElement('div');
    d.id = 'uq-consent';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', 'Cookie notice');
    d.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:9999;max-width:380px;margin:0 auto;background:#FDFBF7;border:1px solid #E6E2D6;border-radius:14px;padding:13px 14px;box-shadow:0 6px 18px rgba(74,55,40,.09);font-family:"Questrial",system-ui,sans-serif;display:flex;align-items:center;gap:12px';
    d.innerHTML =
      '<p style="flex:1;margin:0;font-size:12.5px;line-height:1.5;color:#7A7266">A few cookies help us see what’s working, so we can make Unclinq better. <a href="/privacy/" style="color:#C05B3A">Learn more</a></p>' +
      '<button id="uq-accept" style="flex:none;height:36px;padding:0 16px;border-radius:9px;border:none;background:#C05B3A;color:#fff;font-size:13.5px;font-weight:600;font-family:inherit;cursor:pointer">OK</button>' +
      '<button id="uq-decline" aria-label="Decline" style="flex:none;background:none;border:none;color:#9a9186;font-size:12.5px;padding:4px 2px;text-decoration:underline;font-family:inherit;cursor:pointer">No</button>';
    document.body.appendChild(d);
    document.getElementById('uq-accept').addEventListener('click', grant);
    document.getElementById('uq-decline').addEventListener('click', deny);
  }

  // Only EU/UK visitors who haven't chosen yet see the strip.
  if (isEU() && get() === null) {
    if (document.body) show();
    else document.addEventListener('DOMContentLoaded', show);
  }
})();
