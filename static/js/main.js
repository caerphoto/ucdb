/* global Handlebars */
(function (D) {
  var tmpl = Handlebars.templates,
    blockSelect,
    searchBox,
    blockOnly,
    charList,
    searchThrottle;

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
      if (xhr.status === 200 || xhr.status === 404) {
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

    if (data.length === 0) {
      charList.innerHTML = tmpl.no_result();
    } else if (data[0].block) {
      charList.innerHTML = tmpl.charlist_search(view);
    } else {
      charList.innerHTML = tmpl.charlist(view);
    }
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

  function searchChanged() {
    var lastValue = searchBox.getAttribute('data-last-value');

    if (searchBox.value !== lastValue) {
      searchBox.setAttribute('data-last-value', searchBox.value);
      return true;
    }

    return false;
  }

  D.addEventListener('DOMContentLoaded', function () {
    blockSelect = D.querySelector('#block');
    searchBox = D.querySelector('#search');
    blockOnly = D.querySelector('#block_only');
    charList = D.querySelector('#charlist');

    if (window.location.hash) {
      blockSelect.value = window.location.hash.split("#")[1];
    }
    updateList();
    searchBox.focus();

    blockSelect.addEventListener('change', function () {
      blockOnly.checked = true;
      window.location.hash = this.value;
    }, false);

    searchBox.addEventListener('keyup', function () {
      if (searchChanged()) {
        clearTimeout(searchThrottle);
        searchThrottle = setTimeout(function () {
          updateList();
        }, 300);
      }
    }, false);

    // Handle clicks on the (x) button
    searchBox.addEventListener('click', function () {
      if (searchChanged()) {
        updateList();
      }
    }, false);

    blockOnly.addEventListener('change', function () {
      updateList();
    }, false);

    window.addEventListener('hashchange', function () {
      blockSelect.value = window.location.hash.split("#")[1];
      blockOnly.checked = true;
      updateList();
    });

  }); // DOMContentLoaded
}(window.document));
