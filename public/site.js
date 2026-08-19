(function () {
  'use strict';

  var bookmarklet = window.__BOOKMARKLET__ || '';
  var links = [document.getElementById('bmLink'), document.getElementById('bmLinkBottom')];
  var code = document.getElementById('bmCode');
  var status = document.getElementById('copyStatus');

  links.forEach(function (link) {
    if (link) link.href = bookmarklet || '#install';
  });
  if (code) code.textContent = bookmarklet || 'Bookmarklet unavailable. Refresh the page and try again.';
  document.getElementById('year').textContent = new Date().getFullYear();

  function checkSystemHealth() {
    var indicator = document.getElementById('systemStatus');
    if (!indicator) return;
    fetch('/api/health', { cache: 'no-store' }).then(function (response) {
      return response.json().then(function (data) { return { ok: response.ok, data: data }; });
    }).then(function (result) {
      var storage = result.data && result.data.storage;
      indicator.classList.remove('degraded', 'offline');
      if (!result.ok || !storage || !storage.reachable) {
        indicator.classList.add('offline');
        indicator.lastChild.textContent = ' Storage offline';
      } else if (!storage.persistent) {
        indicator.classList.add('degraded');
        indicator.lastChild.textContent = ' Local mode';
      } else {
        indicator.lastChild.textContent = ' Database online';
      }
    }).catch(function () {
      indicator.classList.add('offline');
      indicator.lastChild.textContent = ' Status unavailable';
    });
  }


  function loadLatestAnnouncement() {
    var rail = document.getElementById('announcementRail');
    var dismiss = document.getElementById('announcementDismiss');
    var indicator = document.getElementById('systemStatus');
    if (!rail) return;
    fetch('/api/maintenance', { cache: 'no-store' }).then(function (response) {
      return response.json().then(function (data) { return { ok: response.ok, data: data }; });
    }).then(function (statusResult) {
      var maintenance = statusResult.ok && statusResult.data && statusResult.data.maintenance;
      if (maintenance && maintenance.enabled) {
        rail.dataset.maintenance = 'true';
        rail.dataset.id = 'maintenance';
        document.getElementById('announcementTitle').textContent = 'Maintenance in progress';
        document.getElementById('announcementText').textContent = maintenance.message || 'Scale XT is temporarily unavailable.';
        document.getElementById('announcementDate').textContent = maintenance.startedAt
          ? new Date(maintenance.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : 'Now';
        dismiss.hidden = true;
        rail.classList.remove('hidden');
        if (indicator) {
          indicator.classList.remove('degraded');
          indicator.classList.add('offline');
          indicator.lastChild.textContent = ' Maintenance';
        }
        return null;
      }
      delete rail.dataset.maintenance;
      dismiss.hidden = false;
      rail.classList.add('hidden');
      checkSystemHealth();
      return fetch('/api/announcements', { cache: 'no-store' }).then(function (response) {
        return response.json().then(function (data) { return { ok: response.ok, data: data }; });
      });
    }).then(function (result) {
      if (!result) return;
      var item = result.ok && result.data && result.data.announcements && result.data.announcements[0];
      if (!item) return;
      var dismissed = '';
      try { dismissed = sessionStorage.getItem('scale_xt_announcement_dismissed') || ''; } catch (error) {}
      if (dismissed === item.id) return;
      document.getElementById('announcementTitle').textContent = item.title || 'General announcement';
      document.getElementById('announcementText').textContent = item.text || '';
      document.getElementById('announcementDate').textContent = new Date(item.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      rail.dataset.id = item.id || '';
      rail.classList.remove('hidden');
    }).catch(function () { checkSystemHealth(); });
  }

  document.getElementById('announcementDismiss').addEventListener('click', function () {
    var rail = document.getElementById('announcementRail');
    if (rail.dataset.maintenance === 'true') return;
    try { sessionStorage.setItem('scale_xt_announcement_dismissed', rail.dataset.id || 'dismissed'); } catch (error) {}
    rail.classList.add('hidden');
  });

  loadLatestAnnouncement();
  window.setInterval(loadLatestAnnouncement, 30000);

  function copyBookmarklet(button) {
    if (!bookmarklet) {
      if (status) status.textContent = 'The bookmarklet is still loading. Refresh and try once more.';
      return;
    }
    navigator.clipboard.writeText(bookmarklet).then(function () {
      var old = button.textContent;
      button.textContent = 'Copied';
      if (status) status.textContent = 'Copied. Paste it into a bookmark’s URL field.';
      window.setTimeout(function () { button.textContent = old; }, 1800);
    }).catch(function () {
      if (code) {
        var range = document.createRange();
        range.selectNodeContents(code);
        var selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
      if (status) status.textContent = 'Select the highlighted code and copy it manually.';
    });
  }

  document.getElementById('copyCode').addEventListener('click', function () { copyBookmarklet(this); });
  document.getElementById('copyTop').addEventListener('click', function () { copyBookmarklet(this); });
})();
