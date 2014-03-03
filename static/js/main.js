/* global Handlebars */
(function (D) {
  var tmpl = Handlebars.templates.charlist,
    blockSelect,
    searchBox,
    blockOnly,
    charList;

  function encodeObject(o) {
    // Converts the given object to URL query style, e.g.
    // { name: 'Andy', email: 'ucdb@andyf.me' }
    // becomes:
    //
    var q = [];

    Object.keys(o).forEach(function (key) {
      q.push(key + "=" + encodeURIComponent(o[key] || ''));
    });
    return "?" + q.join("&");
  }

  function fetchChars(blockId, searchString, callback) {
    var xhr = new XMLHttpRequest(),
      url = '/search';

    xhr.addEventListener('load', function () {
      if (xhr.status === 200) {
        if (callback instanceof Function) {
          callback(null, JSON.parse(xhr.response));
        }
      } else {
        if (callback instanceof Function) {
          callback(xhr.response);
        }
      }
    }, false);

    xhr.open("GET", url +
      encodeObject({ block_id: blockId, name: searchString }), true);

    xhr.send();
  } // ajax()

  function renderList(data) {
    var view = {
        count: data.length,
        characters: data
      };
    charList.innerHTML = tmpl(view);
  }

  function updateList() {
    var blockId = blockSelect.value;

    if (!blockOnly.checked && searchBox.value !== '') {
      blockId = '';
    }

    fetchChars(blockId, searchBox.value, function (err, data) {
      if (err) {
        return alert(err);
      }

      renderList(data);
    });
  }

  D.addEventListener('DOMContentLoaded', function () {
    blockOnly = D.querySelector('#block_only');
    blockSelect = D.querySelector('#block');
    searchBox = D.querySelector('#search');
    charList = D.querySelector('#charlist');

    updateList();
    searchBox.focus();

    blockSelect.addEventListener('change', function () {
      updateList();
    }, false);

    // TODO: delay search for 300ms or so
    searchBox.addEventListener('keyup', function () {
      var lastValue = this.getAttribute('data-last-value');

      if (this.value !== lastValue) {
        this.setAttribute('data-last-value', this.value);
        updateList();
      }
    }, false);

    blockOnly.addEventListener('change', function () {
      updateList();
    }, false);
  }); // DOMContentLoaded
}(window.document));
