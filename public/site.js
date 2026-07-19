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
