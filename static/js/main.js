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

    searchThrottle;

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
      encodeObject({ block_id: blockId, name: searchString }), true);


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
    } else {
      window.location.hash = '-1';
    }
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

    if (window.location.hash) {
      setSelectValue(window.location.hash.split('#')[1]);
    }
    updateList();
    searchBox.focus();

    blockSelect.addEventListener('click', function () {
      toggleClass(this.parentNode, 'open');
    });

    blockList.addEventListener('click', function (evt) {
      var el = evt.target;

      blockOnly.checked = true;
      setSelectValue(el.getAttribute('href').split('#')[1]);
      toggleClass(blockSelect.parentNode, 'open');
    }, false);

    searchBox.addEventListener('input', function () {
      clearTimeout(searchThrottle);
      searchThrottle = setTimeout(function () {
        updateList();
      }, 500);
    }, false);

    blockOnly.addEventListener('change', function () {
      if (searchBox.value) {
        updateList();
      }
    }, false);

    D.addEventListener('click', function (evt) {
      if (!hasClass(evt.target.parentNode, 'dropdown')) {
        removeClass(blockSelect.parentNode, 'open', false);
      }
    }, false);

    wgl4Only.addEventListener('change', function () {
      renderList();
    }, false);

    window.addEventListener('hashchange', function () {
      var hash = window.location.hash.split('#')[1];
      setSelectValue(hash);
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
