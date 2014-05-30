/* global Handlebars */
(function (D) {
  var tmpl = Handlebars.templates,

    charCache = [],

    blockSelect,
    searchBox,
    blockOnly,
    excludeMissing,
    wgl4Only,
    charList,

    //cx1, cx2,
    searchThrottle;

  /*/
  function charactersMatch(c1, c2) {
    // Checks whether the two characters match, by comparing their rendered
    // images. Uses a global canvas context for performance reasons, to avoid
    // re-creating them for each character.
    var d1, d2,
      i;

    d1 = cx1.getImageData();
    d2 = cx2.getImageData();
    while (i--) {
      if (d1[i] !== d2[i]) {
        return false;
      }
    }

    return true;
  }
  /*/

  function selectText(element) {
    // Select the text content of the given element.
    var range, selection;

    if (D.body.createTextRange) { // ms
      range = D.body.createTextRange();
      range.moveToElementText(element);
      range.select();
    } else if (window.getSelection) { // moz, opera, webkit
      selection = window.getSelection();
      range = D.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

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
      charList.className = '';
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


    charList.className = 'loading';
    xhr.send();
  } // ajax()

  function renderList() {
    var view = {
        count: charCache.length,
        characters: charCache
      };

    if (wgl4Only.checked) {
      view.characters = charCache.filter(function (char) {
        return !!char.wgl4;
      });
      view.count = view.characters.length + ' of ' + charCache.length;
    }

    if (charCache.length === 0) {
      charList.innerHTML = tmpl.no_result();
    } else {
      if (charCache[0].block) {
        view.showBlock = true;
      }
      charList.innerHTML = tmpl.charlist(view);
    }
  }

  function updateList() {
    var blockId = blockSelect.value;

    if (!blockOnly.checked && searchBox.value !== '') {
      blockId = '';
    }

    fetchChars(blockId, searchBox.value, function (err, data) {
      var cv1, cv2, cx1, cx2;

      if (err) {
        return alert(err);
      }

      if (excludeMissing.checked) {
        cv1 = D.createElement('canvas');
        cv2 = D.createElement('canvas');
        cx1 = cv1.getContext('2d');
        cx2 = cv2.getContext('2d');

      }

      charCache = data;
      renderList();
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
    wgl4Only = D.querySelector('#wgl4_only');
    excludeMissing = {};//D.querySelector('#exclude_missing');
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
      if (searchBox.value) {
        updateList();
      }
    }, false);

    wgl4Only.addEventListener('change', function () {
      renderList();
    }, false);

    window.addEventListener('hashchange', function () {
      blockSelect.value = window.location.hash.split("#")[1];
      blockOnly.checked = true;
      updateList();
    });

    charList.addEventListener('click', function (evt) {
      var el = evt.target,
        parent = el.parentNode;

      if (parent.nodeName === 'TD' && parent.className === 'char') {
        // iOS won't show the element as selected unless contentEditable is true
        el.setAttribute('contentEditable', true);
        selectText(el);
        setTimeout(function () {
          el.removeAttribute('contentEditable');
        }, 0);

      }
    });

  }); // DOMContentLoaded
}(window.document));
