/* global Handlebars, UCDB */
(function (D) {
  var tmpl = Handlebars.templates,

    charCache = [],
    searchCount = 0,

    blockSelect,
    blockList,
    searchBox,
    blockOnly,
    excludeMissing,
    wgl4Only,
    charList,

    gCacheIsValid = false,

    searchThrottle;

  function selectText(element) {
    // Select the text content of the given element.
    var range, selection;

    if (D.body.createTextRange) { // IE
      range = D.body.createTextRange();
      range.moveToElementText(element);
      range.select();
    } else if (window.getSelection) { // Moz, Opera, Webkit
      selection = window.getSelection();
      range = D.createRange();
      range.selectNodeContents(element);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }

  function queryStringFromObject(o) {
    // Converts the given object to URL query style, e.g.
    // { name: 'Andy', email: 'ucdb@andyf.me' }
    // becomes:
    // ?name=Andy&email=ucdb%40andyf.me

    var q = [];

    Object.keys(o).forEach(function (key) {
      q.push(key + '=' + encodeURIComponent(o[key] || ''));
    });
    return '?' + q.join('&');
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

    xhr.open('GET', url +
      queryStringFromObject({ block_id: blockId, name: searchString }), true);


    charList.className = 'loading';
    xhr.send();
  } // ajax()

  function renderList() {
    var view = {
        count: charCache.length,
        characters: charCache
      };

    if (view.count !== searchCount) {
      view.count = charCache.length + ' of ' + searchCount + ' matching';
    }

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
    var blockId = blockSelect.getAttribute('data-value');

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

      charCache = data.chars;
      searchCount = data.count;
      renderList();
    });
  }

  function toggleClass(el, className, on) {
    var classes = el.className.split(' '),
      i;

    if (typeof on === 'undefined') {
      // Toggle the class based on what it already is.
      if (classes.length === 0) {
        el.className = className;
        return el;
      }

      i = classes.indexOf(className);
      if (i !== -1) {
        classes.splice(i, 1);
      } else {
        classes.push(className);
      }

      el.className = classes.join(' ');

    } else {
      i = classes.indexOf(className);
      if (on) {
        if (i === -1) {
          classes.push(className);
        }
        // if on && i !== -1, don't need to do anything
      } else {
        if (i !== -1) {
          classes.splice(i, 1);
        }
        // if !on && i === -1, don't need to do anything
      }

      el.className = classes.join(' ');
    }

    return el;
  }

  function removeClass(el, className) {
    toggleClass(el, className, false);
  }

  function hasClass(el, className) {
    var classes;

    if (!el.className) {
      return false;
    }

    classes = el.className.split(' ');

    return classes.indexOf(className) !== -1;
  }

  function setSelectValue(id) {
    var el = blockList.querySelector('a[href="#' + id + '"]'),
      prevSelected = blockList.querySelector('.selected');

    if (prevSelected) {
      prevSelected.className = '';
    }

    if (el) {
      el.className = 'selected';
      blockSelect.setAttribute('data-value', id);
      blockSelect.innerHTML = UCDB.blockLookup[id];
    }
  }

  function setStateFromHash() {
    /* Hash is of the form ':block_id/:search_term/:flags', where:
       - search_term is URI encoded
       - flags contains any of 'b' and 'w', meaning block-only and WGL4-only
         respectively
    */

    var hash = window.location.hash.split('#')[1],
      BLOCK_ONLY = /b/,
      WGL4_ONLY = /w/;

    hash = hash.split('/');

    // Try to use block ID, for backwards compatibility with old URLs.
    setSelectValue(hash[0]);

    if (hash.length !== 3) {
      setHashFromState(true);
    } else {
      searchBox.value = decodeURIComponent(hash[1]);
      blockOnly.checked = BLOCK_ONLY.test(hash[2]);
      wgl4Only.checked = WGL4_ONLY.test(hash[2]);
    }

    if (!gCacheIsValid) {
      updateList();
    }
  }

  function setHashFromState(clientOnly) {
    // Setting gCacheIsValid to true will prevent the hashchange event handler
    // from calling updateList() - this is helpful if we just want to change the
    // hash without making a query to the server, such as when toggling the
    // WGL4-only checkbox.
    if (clientOnly) {
      gCacheIsValid = true;
    }

    window.location.hash = [
      blockSelect.getAttribute('data-value'),
      encodeURIComponent(searchBox.value),
      (blockOnly.checked ? 'b' : '') + (wgl4Only.checked ? 'w' : '')
    ].join('/');

    window.setTimeout(function () {
      gCacheIsValid = false;
    }, 0);

  }

  // Main initialisation function
  // ---------------------------------------------------------------------------
  D.addEventListener('DOMContentLoaded', function () {

    blockSelect = D.querySelector('#block');
    blockList = D.querySelector('#block_list');
    searchBox = D.querySelector('#search');
    blockOnly = D.querySelector('#block_only');
    wgl4Only = D.querySelector('#wgl4_only');
    excludeMissing = {};//D.querySelector('#exclude_missing');
    charList = D.querySelector('#charlist');

    blockList.innerHTML = tmpl.blocklist({ blocks: UCDB.blocks });

    if (window.location.hash) {
      setStateFromHash();
    } else {
      setHashFromState(true);
    }

    updateList();
    searchBox.focus();

    window.addEventListener('hashchange', setStateFromHash);

    // Close dropdown on click anywhere on the page.
    D.addEventListener('click', function (evt) {
      if (!hasClass(evt.target.parentNode, 'dropdown')) {
        removeClass(blockSelect.parentNode, 'open', false);
      }
    }, false);

    blockSelect.addEventListener('click', function () {
      toggleClass(this.parentNode, 'open');
    });

    // --- The rest of these events change state ---
    blockList.addEventListener('click', function (evt) {
      var el = evt.target;

      blockOnly.checked = true;
      setSelectValue(el.getAttribute('href').split('#')[1]);
      setHashFromState();
      toggleClass(blockSelect.parentNode, 'open');

      evt.preventDefault();
    }, false);

    searchBox.addEventListener('input', function () {
      clearTimeout(searchThrottle);
      searchThrottle = setTimeout(function () {
        // No need to explicitly update the list, since it happens when the hash
        // is changed anyway.
        setHashFromState();
      }, 500);
    }, false);

    blockOnly.addEventListener('change', function () {
      setHashFromState();
      if (searchBox.value) {
        updateList();
      }
    }, false);

    wgl4Only.addEventListener('change', function () {
      renderList();
      setHashFromState(true);
    }, false);

    charList.addEventListener('click', function (evt) {
      var el = evt.target,
        parent = el.parentNode;

      if (el.nodeName === 'A') {
        blockOnly.checked = true;
        setSelectValue(el.getAttribute('href').split('#')[1]);
        setHashFromState();

        evt.preventDefault();
        return;
      }

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
