/* global Handlebars, UCDB */
/* eslint indent: [2, "warn"] */
(function(D) {
  var tmpl = Handlebars.templates,

    charCache = [],
    searchCount = 0,

    blockSelect,
    blockList,
    searchBox,
    blockOnly,
    wgl4Only,
    charList,
    subCharList = D.createDocumentFragment(),

    gCacheIsValid = false,
    currentOffset = 0,

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

    Object.keys(o).forEach(function(key) {
      q.push(key + '=' + encodeURIComponent(o[key] || ''));
    });
    return '?' + q.join('&');
  }

  function fetchChars(blockId, searchString, offset, callback) {
    var xhr = new XMLHttpRequest(),
      url = '/ucdb/search';

    xhr.addEventListener('load', function() {
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

    if (offset) {
      xhr.open('GET', url +
        queryStringFromObject({
          block_id: blockId,
          name: searchString,
          offset: offset
        }), true);
    } else {
      xhr.open('GET', url +
        queryStringFromObject({
          block_id: blockId,
          name: searchString
        }), true);
    }


    charList.className = 'loading';
    xhr.send();
  } // ajax()

  function renderList(appending) {
    var view = {
      count: searchCount,
      characters: charCache
    },
      offset = currentOffset * UCDB.pageSize,
      blockId = blockSelect.getAttribute('data-value'),
      elTemp;

    // Pagination button will be hidden via CSS if wgl4Only.checked, regardless
    // of whether view.canPaginate is true or not, because if a block contains a
    // lot of characters but few in WGL4, clicking 'Load More' might appear to
    // do nothing.
    if (charCache.length < searchCount) {
      view.canPaginate = true;
    }

    if (wgl4Only.checked) {
      view.characters = charCache.filter(function(ch) {
        return !!ch.wgl4;
      });
    }

    // showBlock determines whether a link to each character's block is shown.
    view.showBlock = (!blockOnly.checked && searchBox.value) || blockId === '-1';
    view.numRemaining = searchCount - charCache.length;

    if (appending) {
      // In order to bulk-append, just the rows (rather than the whole heading +
      // full table) and a minimal surrounding table are rendered into a
      // temporary element, then the table's rows are transferred to a document
      // fragment, which is then appended to the table. It's done this way
      // because you can't directly set the .innerHTML of a document fragment
      // or, in IE, a <tbody>, and using DOM functions to build the rows
      // defeats the purpose of using templating in the first place.
      view.characters = view.characters.slice(offset, offset + UCDB.pageSize);
      elTemp = D.createElement('div');
      elTemp.innerHTML =
        '<table><tbody>' +
        tmpl.subcharlist(view) +
        '</tbody></table>';
      elTemp = elTemp.querySelector('tbody');

      while (elTemp.firstChild) {
        subCharList.appendChild(elTemp.removeChild(elTemp.firstChild));
      }
      charList.querySelector('tbody').appendChild(subCharList);

      // The created <div> and its now-empty table child will be
      // garbage-collected once this function finishes, since there's no longer
      // a reference to it.

      elTemp = charList.querySelector('.pagination');
      if (charCache.length >= searchCount) {
        elTemp.parentNode.removeChild(elTemp);
      } else {
        elTemp = elTemp.querySelector('span');
        elTemp.innerHTML = '(' + view.numRemaining + ' remaining)';
      }

    } else {
      if (charCache.length === 0) {
        charList.innerHTML = tmpl.no_result();
      } else {
        charList.innerHTML = tmpl.charlist(view);
      }
    }
  }

  function updateList(appending) {
    var blockId = blockSelect.getAttribute('data-value');

    if (!blockOnly.checked && searchBox.value !== '') {
      blockId = '';
    }

    fetchChars(blockId, searchBox.value, currentOffset, function(err, result) {

      if (err) {
        return alert(err);
      }


      if (appending) {
        charCache = charCache.concat(result.chars);
      } else {
        charCache = result.chars;
      }
      searchCount = result.count;
      renderList(appending);
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
      // Hash is in an unknown state, so reset it.
      setHashFromState(true);
    } else {
      searchBox.value = decodeURIComponent(hash[1]);
      blockOnly.checked = BLOCK_ONLY.test(hash[2]);
      wgl4Only.checked = WGL4_ONLY.test(hash[2]);
    }

    if (!gCacheIsValid) {
      // If state has changed, the whole list will need to be re-rendered, not
      // just part of it.
      currentOffset = 0;
      updateList();
    }
  }

  function setHashFromState(setCacheValid) {
    // The cache should, by default be invalid, so when setCacheValid is true,
    // we need to reset validity back to false after updating the hash.
    if (setCacheValid) {
      gCacheIsValid = true;
      setTimeout(function() {
        gCacheIsValid = false;
      }, 0);
    }

    window.location.hash = [
      blockSelect.getAttribute('data-value'),
      encodeURIComponent(searchBox.value),
      (blockOnly.checked ? 'b' : '') + (wgl4Only.checked ? 'w' : '')
    ].join('/');

  }

  // Main initialisation function
  // ---------------------------------------------------------------------------
  D.addEventListener('DOMContentLoaded', function() {

    blockSelect = D.querySelector('#block');
    blockList = D.querySelector('#block_list');
    searchBox = D.querySelector('#search');
    blockOnly = D.querySelector('#block_only');
    wgl4Only = D.querySelector('#wgl4_only');
    charList = D.querySelector('#charlist');

    Handlebars.registerPartial('subcharlist', tmpl.subcharlist);
    blockList.innerHTML = tmpl.blocklist({ blocks: UCDB.blocks });

    if (window.location.hash) {
      setStateFromHash();
    } else {
      setHashFromState();
    }

    searchBox.focus();

    window.addEventListener('hashchange', setStateFromHash);

    // Close dropdown on click anywhere on the page.
    D.addEventListener('click', function(evt) {
      if (!hasClass(evt.target.parentNode, 'dropdown')) {
        removeClass(blockSelect.parentNode, 'open', false);
      }
    }, false);

    blockSelect.addEventListener('click', function() {
      toggleClass(this.parentNode, 'open');
    });

    // --- The rest of these events change state ---
    blockList.addEventListener('click', function(evt) {
      var el = evt.target;

      blockOnly.checked = true;
      setSelectValue(el.getAttribute('href').split('#')[1]);
      setHashFromState();
      toggleClass(blockSelect.parentNode, 'open');

      evt.preventDefault();
    }, false);

    searchBox.addEventListener('input', function() {
      clearTimeout(searchThrottle);
      searchThrottle = setTimeout(function() {
        setHashFromState();
      }, 500);
    }, false);

    blockOnly.addEventListener('change', function() {
      setHashFromState();
    }, false);

    wgl4Only.addEventListener('change', function() {
      toggleClass(charList, 'wgl4-only', wgl4Only.checked);
      renderList();
      setHashFromState(true);
    }, false);

    charList.addEventListener('click', function(evt) {
      var el = evt.target,
        parent = el.parentNode;

      if (el.nodeName === 'A') {
        blockOnly.checked = true;
        setSelectValue(el.getAttribute('href').split('#')[1]);
        setHashFromState();

        evt.preventDefault();
        return;
      }

      if (el.nodeName === 'BUTTON') {
        currentOffset += 1;
        updateList(true);
        return;
      }

      if (parent.nodeName === 'TD' && parent.classList.contains('char')) {
        const clipText = el.textContent;
        navigator.clipboard
          .writeText(clipText)
          .then(function() {
            parent.classList.add('copied');
            setTimeout(function() {
              parent.classList.remove('copied');
            }, 2000);
          });
      }
    });

  }); // DOMContentLoaded
}(window.document));
