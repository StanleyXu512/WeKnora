/* Shared behavior for reusable business components. */
(function () {
  if (window.ChintBusinessComponents) return;

  window.ChintBusinessComponents = { version: '2.1' };

  var selects = Array.prototype.slice.call(document.querySelectorAll('[data-select]'));

  function initializeSelect(root) {
    if (root.dataset.selectInitialized === 'true' || root.hasAttribute('data-multiple')) return;
    var trigger = root.querySelector('.select__trigger');
    var text = root.querySelector('.select__text');
    var panel = root.querySelector('.select__panel');
    var clear = root.querySelector('.select__clear');
    var options = panel ? Array.prototype.slice.call(panel.querySelectorAll('.select__option')) : [];
    if (!trigger || !text || !panel || !options.length) return;

    root.dataset.selectInitialized = 'true';
    function setOpen(open, restoreFocus) {
      root.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
      if (!open && restoreFocus) trigger.focus();
    }
    function isPlaceholder(option) {
      return option && option.dataset.placeholder === 'true';
    }
    function selectOption(option) {
      options.forEach(function (item) {
        var selected = item === option;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-selected', String(selected));
      });
      text.textContent = option.textContent.trim();
      text.classList.toggle('select__placeholder', isPlaceholder(option));
      root.classList.toggle('has-value', !isPlaceholder(option));
      root.classList.remove('is-error');
      setOpen(false, false);
    }
    function clearSelection() {
      options.forEach(function (option) {
        option.classList.remove('is-selected');
        option.setAttribute('aria-selected', 'false');
      });
      text.textContent = root.dataset.placeholder || '请选择';
      text.classList.add('select__placeholder');
      root.classList.remove('has-value', 'is-error');
      setOpen(false, false);
    }
    function getSelectedIndex() {
      var selected = options.findIndex(function (option) { return option.classList.contains('is-selected'); });
      return selected >= 0 ? selected : 0;
    }

    var selectedOption = options.find(function (option) { return option.classList.contains('is-selected'); });
    if (selectedOption) selectOption(selectedOption);

    trigger.addEventListener('click', function (event) {
      if (clear && event.target.closest('.select__clear')) return;
      setOpen(!root.classList.contains('is-open'), false);
    });
    if (clear) {
      clear.addEventListener('click', function (event) {
        event.stopPropagation();
        clearSelection();
      });
    }
    trigger.addEventListener('keydown', function (event) {
      var index = getSelectedIndex();
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setOpen(true, false);
        options[event.key === 'ArrowDown' ? (index + 1) % options.length : (index - 1 + options.length) % options.length].focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(!root.classList.contains('is-open'), false);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false, false);
      }
    });
    options.forEach(function (option) {
      option.tabIndex = 0;
      option.addEventListener('click', function () { selectOption(option); });
      option.addEventListener('keydown', function (event) {
        var index = options.indexOf(option);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          options[event.key === 'ArrowDown' ? (index + 1) % options.length : (index - 1 + options.length) % options.length].focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectOption(option);
          trigger.focus();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false, true);
        }
      });
    });
  }

  selects.forEach(initializeSelect);
  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-select]')) return;
    selects.forEach(function (root) {
      var trigger = root.querySelector('.select__trigger');
      if (trigger && root.classList.contains('is-open')) {
        root.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    selects.forEach(function (root) {
      var trigger = root.querySelector('.select__trigger');
      if (trigger && root.classList.contains('is-open')) {
        root.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.focus();
      }
    });
  });

  var uploads = Array.prototype.slice.call(document.querySelectorAll('[data-upload]'));

  function initializeUpload(root) {
    if (root.dataset.uploadInitialized === 'true') return;
    var drop = root.querySelector('.upload__drop');
    var fileInput = root.querySelector('input[type="file"]');
    var list = root.querySelector('.upload__list');
    if (!drop || !fileInput || !list) return;

    root.dataset.uploadInitialized = 'true';

    function createIcon(name, className, label) {
      var iconNames = { 'x': 'ri-close-line', 'file-text': 'ri-file-text-line', 'circle-check': 'ri-checkbox-circle-line' };
      var fontIcon = document.createElement('i');
      fontIcon.className = className + ' ' + iconNames[name];
      if (label) {
        fontIcon.setAttribute('role', 'img');
        fontIcon.setAttribute('aria-label', label);
      } else {
        fontIcon.setAttribute('aria-hidden', 'true');
      }
      return fontIcon;
    }

    function formatFileSize(bytes) {
      return bytes < 1024 * 1024
        ? Math.max(1, Math.round(bytes / 1024)) + ' KB'
        : (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function addFile(file) {
      var item = document.createElement('div');
      var name = document.createElement('span');
      var size = document.createElement('span');
      var remove = document.createElement('button');

      item.className = 'upload__item is-success';
      item.setAttribute('role', 'listitem');
      name.className = 'upload__name';
      name.textContent = file.name;
      size.className = 'upload__size';
      size.textContent = formatFileSize(file.size);
      remove.className = 'btn btn--icon upload__remove';
      remove.type = 'button';
      remove.setAttribute('aria-label', '移除文件 ' + file.name);
      remove.title = '移除附件';
      remove.appendChild(createIcon('x', 'icon'));
      remove.addEventListener('click', function () { item.remove(); });
      item.appendChild(createIcon('file-text', 'icon'));
      item.appendChild(name);
      item.appendChild(size);
      item.appendChild(createIcon('circle-check', 'icon icon--status', '上传成功'));
      item.appendChild(remove);
      list.appendChild(item);
    }

    function addFiles(files) {
      Array.prototype.forEach.call(files, addFile);
    }

    drop.addEventListener('click', function () { fileInput.click(); });
    drop.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInput.click();
      }
    });
    fileInput.addEventListener('change', function () {
      addFiles(fileInput.files);
      fileInput.value = '';
    });
    drop.addEventListener('dragover', function (event) {
      event.preventDefault();
      drop.classList.add('is-dragover');
    });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-dragover'); });
    drop.addEventListener('drop', function (event) {
      event.preventDefault();
      drop.classList.remove('is-dragover');
      addFiles(event.dataTransfer.files);
    });
  }

  uploads.forEach(initializeUpload);

  var datepickers = Array.prototype.slice.call(document.querySelectorAll('[data-datepicker]'));
  datepickers.forEach(function (datepicker) {
    if (datepicker.dataset.datepickerInitialized === 'true') return;
    var trigger = datepicker.querySelector('.datepicker__trigger');
    var input = datepicker.querySelector('.datepicker__trigger .input');
    var panel = datepicker.querySelector('.datepicker__panel');
    var title = datepicker.querySelector('.datepicker__title');
    var grid = datepicker.querySelector('.datepicker__grid');
    var cells = Array.prototype.slice.call(datepicker.querySelectorAll('.datepicker__cell:not(.is-other-month)'));
    var month = 8;
    var year = 2026;
    if (!trigger || !input || !panel) return;

    function setOpen(open, restoreFocus) {
      datepicker.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
      if (!open && restoreFocus) trigger.focus();
    }
    function selectValue(value) {
      input.value = value;
      datepicker.querySelectorAll('.datepicker__shortcut').forEach(function (shortcut) {
        shortcut.classList.toggle('is-selected', shortcut.dataset.dateValue === value);
      });
      setOpen(false, false);
    }
    function renderMonth() {
      var label = year + ' 年 ' + String(month + 1).padStart(2, '0') + ' 月';
      title.textContent = label;
      if (grid) grid.setAttribute('aria-label', label);
    }

    trigger.addEventListener('click', function () { setOpen(!datepicker.classList.contains('is-open'), false); });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(!datepicker.classList.contains('is-open'), false);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false, true);
      }
    });
    datepicker.querySelectorAll('[data-datepicker-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        var action = button.dataset.datepickerAction;
        if (action === 'prev-year') year -= 1;
        if (action === 'next-year') year += 1;
        if (action === 'prev-month') {
          month -= 1;
          if (month < 0) { month = 11; year -= 1; }
        }
        if (action === 'next-month') {
          month += 1;
          if (month > 11) { month = 0; year += 1; }
        }
        renderMonth();
      });
    });
    datepicker.querySelectorAll('.datepicker__shortcut').forEach(function (shortcut) {
      shortcut.addEventListener('click', function () { selectValue(shortcut.dataset.dateValue); });
    });
    cells.forEach(function (cell) {
      cell.tabIndex = 0;
      cell.addEventListener('click', function () {
        cells.forEach(function (item) { item.classList.remove('is-selected'); item.setAttribute('aria-selected', 'false'); });
        cell.classList.add('is-selected');
        cell.setAttribute('aria-selected', 'true');
        selectValue(year + '-' + String(month + 1).padStart(2, '0') + '-' + cell.textContent.trim().padStart(2, '0'));
      });
      cell.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          cell.click();
        }
      });
    });
  });

  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-datepicker]')) return;
    datepickers.forEach(function (datepicker) {
      var trigger = datepicker.querySelector('.datepicker__trigger');
      if (trigger && datepicker.classList.contains('is-open')) setOpenDatepicker(datepicker, trigger);
    });
  });

  function setOpenDatepicker(datepicker, trigger) {
    datepicker.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  }

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    datepickers.forEach(function (datepicker) {
      var trigger = datepicker.querySelector('.datepicker__trigger');
      if (trigger && datepicker.classList.contains('is-open')) {
        setOpenDatepicker(datepicker, trigger);
        trigger.focus();
      }
    });
  });

  var overflows = Array.prototype.slice.call(document.querySelectorAll('.biz-action-bar__overflow'));

  overflows.forEach(function (overflow) {
    var parts = getParts(overflow);
    if (!parts.trigger || !parts.menu) return;
    var isOpen = parts.trigger.getAttribute('aria-expanded') === 'true';
    parts.menu.hidden = !isOpen;
    if (!isOpen) parts.menu.classList.remove('is-open');
  });

  function getParts(overflow) {
    return {
      trigger: overflow.querySelector('[aria-haspopup="menu"]'),
      menu: overflow._bizMenu || overflow.querySelector('[role="menu"]')
    };
  }

  function getItems(menu) {
    return Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'));
  }

  function portalMenu(overflow, menu) {
    overflow._bizMenu = menu;
    menu.classList.add('biz-action-bar__menu--portal');
    positionPortalMenu(overflow, menu);
  }

  function restoreMenu(menu) {
    menu.classList.remove('biz-action-bar__menu--portal');
    menu.style.removeProperty('--biz-action-menu-top');
    menu.style.removeProperty('--biz-action-menu-left');
  }

  function positionPortalMenu(overflow, menu) {
    if (!menu.classList.contains('biz-action-bar__menu--portal')) return;
    var trigger = overflow.querySelector('[aria-haspopup="menu"]');
    if (!trigger) return;
    var triggerRect = trigger.getBoundingClientRect();
    var menuRect = menu.getBoundingClientRect();
    var edge = 8;
    var left = Math.min(Math.max(edge, triggerRect.right - menuRect.width), window.innerWidth - menuRect.width - edge);
    var top = triggerRect.bottom + 4;
    if (top + menuRect.height > window.innerHeight - edge) top = triggerRect.top - menuRect.height - 4;
    menu.style.setProperty('--biz-action-menu-left', Math.max(edge, left) + 'px');
    menu.style.setProperty('--biz-action-menu-top', Math.max(edge, top) + 'px');
  }

  function getInlineActionGroup(actionBar) {
    return actionBar.querySelector('.biz-action-bar__actions');
  }

  function getInlineButtons(actionBar) {
    var actionGroup = getInlineActionGroup(actionBar);
    if (!actionGroup) return [];
    return Array.prototype.slice.call(actionGroup.children).filter(function (child) {
      return child.matches('.btn');
    });
  }

  function getInlineAvailableWidth(actionBar) {
    var context = actionBar.querySelector('.biz-action-bar__context');
    var contextWidth = context ? context.getBoundingClientRect().width : 0;
    var actionBarGap = context ? getGap(actionBar) : 0;
    var getActionGroupWidth = function (width) {
      return Math.max(0, width - contextWidth - actionBarGap);
    };
    var container = actionBar.parentElement;
    if (!container) return getActionGroupWidth(actionBar.clientWidth);

    var containerStyle = getComputedStyle(container);
    var containerWidth = container.clientWidth -
      (parseFloat(containerStyle.paddingLeft) || 0) -
      (parseFloat(containerStyle.paddingRight) || 0);
    var children = Array.prototype.slice.call(container.children);
    var actionBarIndex = children.indexOf(actionBar);
    var leftChildren = actionBarIndex > 0 ? children.slice(0, actionBarIndex).filter(function (child) {
      return !child.hidden && child.getBoundingClientRect().width > 0;
    }) : [];
    if (!leftChildren.length) return getActionGroupWidth(actionBar.clientWidth);

    var firstLeftRect = leftChildren[0].getBoundingClientRect();
    var lastLeftRect = leftChildren[leftChildren.length - 1].getBoundingClientRect();
    var actionBarRect = actionBar.getBoundingClientRect();
    if (actionBarRect.width >= containerWidth - 1 || actionBarRect.top > lastLeftRect.bottom + 1) {
      return getActionGroupWidth(actionBar.clientWidth);
    }

    var safeGap = parseFloat(getComputedStyle(actionBar).getPropertyValue('--biz-action-bar-inline-safe-gap')) || 0;
    var leftContentWidth = lastLeftRect.right - firstLeftRect.left;
    var maxActionBarWidth = Math.max(0, containerWidth - leftContentWidth - safeGap);
    return getActionGroupWidth(Math.min(actionBar.clientWidth, maxActionBarWidth));
  }

  function getGap(actionBar) {
    var style = getComputedStyle(actionBar);
    return parseFloat(style.columnGap || style.gap) || 0;
  }

  function createOverflowItem(button) {
    var item = document.createElement('button');
    item.className = 'btn btn--text biz-action-bar__menu-item';
    item.type = 'button';
    item.setAttribute('role', 'menuitem');
    item.textContent = button.textContent.trim();
    item._sourceButton = button;
    return item;
  }

  function syncInlineOverflow(actionBar, overflow) {
    var parts = getParts(overflow);
    if (!parts.trigger || !parts.menu) return;

    getItems(parts.menu).forEach(function (item) {
      if (item.hasAttribute('data-generated-overflow')) item.remove();
    });
    getInlineButtons(actionBar).forEach(function (button) {
      button.hidden = false;
    });

    var buttons = getInlineButtons(actionBar);
    var visibleButtons = buttons.slice();
    var actionGroup = getInlineActionGroup(actionBar);
    var gap = getGap(actionGroup || actionBar);
    var triggerWidth = parts.trigger.getBoundingClientRect().width;
    var availableWidth = getInlineAvailableWidth(actionBar);
    var directWidth = function () {
      return visibleButtons.reduce(function (total, button) {
        return total + button.getBoundingClientRect().width;
      }, 0) + triggerWidth + Math.max(visibleButtons.length, 0) * gap;
    };

    while (visibleButtons.length > 1 && directWidth() > availableWidth) {
      var hideIndex = -1;
      for (var index = visibleButtons.length - 1; index >= 0; index -= 1) {
        if (!visibleButtons[index].classList.contains('btn--primary')) {
          hideIndex = index;
          break;
        }
      }
      if (hideIndex < 0) hideIndex = visibleButtons.length - 1;
      visibleButtons[hideIndex].hidden = true;
      visibleButtons.splice(hideIndex, 1);
    }

    var hiddenButtons = buttons.filter(function (button) {
      return button.hidden;
    });
    hiddenButtons.slice().reverse().forEach(function (button) {
      var item = createOverflowItem(button);
      item.setAttribute('data-generated-overflow', 'true');
      parts.menu.insertBefore(item, parts.menu.firstChild);
    });
    parts.menu.hidden = true;
    parts.trigger.setAttribute('aria-expanded', 'false');
    overflow.hidden = getItems(parts.menu).length === 0;
  }

  function getTableActionButtons(actionCell) {
    return Array.prototype.slice.call(actionCell.querySelectorAll('button, a')).filter(function (control) {
      return !control.closest('.biz-action-bar__overflow');
    });
  }

  function normalizeTableOverflowActions(actionCell) {
    var overflow = actionCell.querySelector('.biz-action-bar__overflow');
    var parts = overflow && getParts(overflow);
    if (!parts || !parts.menu) return;
    var directButtons = getTableActionButtons(actionCell);
    var host = directButtons.length ? directButtons[0].parentElement : actionCell;
    getItems(parts.menu).filter(function (item) {
      return !item.hasAttribute('data-generated-overflow');
    }).forEach(function (item) {
      item.className = 'btn btn--link btn--sm';
      item.removeAttribute('role');
      if (host === actionCell || overflow.parentElement === host) host.insertBefore(item, overflow);
      else host.appendChild(item);
    });
    Array.prototype.slice.call(parts.menu.querySelectorAll('.dropdown__divider')).forEach(function (divider) {
      divider.remove();
    });
  }

  function ensureTableOverflow(actionCell, buttons) {
    var overflow = actionCell.querySelector('.biz-action-bar__overflow');
    if (overflow || buttons.length < 2) return overflow;
    var host = buttons[0].parentElement;
    var sameHost = host && host !== actionCell && buttons.every(function (button) {
      return button.parentElement === host;
    });
    overflow = document.createElement('div');
    overflow.className = 'biz-action-bar__overflow';
    var trigger = document.createElement('button');
    trigger.className = 'btn btn--link btn--sm btn--icon';
    trigger.type = 'button';
    trigger.setAttribute('aria-label', '更多操作');
    trigger.title = '更多操作';
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.innerHTML = '<i class="icon icon-table ri-more-line" aria-hidden="true"></i>';
    var menu = document.createElement('div');
    menu.className = 'biz-action-bar__menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;
    overflow.appendChild(trigger);
    overflow.appendChild(menu);
    (sameHost ? host : actionCell).appendChild(overflow);
    return overflow;
  }

  function getTableActionWidth(actionCell, buttons, trigger) {
    var controls = buttons.concat(trigger ? [trigger] : []).filter(function (control) {
      return !control.hidden && control.getClientRects().length > 0;
    });
    if (!controls.length) return 0;
    var left = Math.min.apply(null, controls.map(function (control) { return control.getBoundingClientRect().left; }));
    var right = Math.max.apply(null, controls.map(function (control) { return control.getBoundingClientRect().right; }));
    var style = getComputedStyle(actionCell);
    return right - left + (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
  }

  function getTableActionMaxWidth(actionCell) {
    var value = parseFloat(getComputedStyle(actionCell).getPropertyValue('--size-table-actions-max-width'));
    return Number.isFinite(value) ? value : 200;
  }

  function syncTableOverflow(actionCell) {
    normalizeTableOverflowActions(actionCell);
    var buttons = getTableActionButtons(actionCell);
    var overflow = ensureTableOverflow(actionCell, buttons);
    if (!overflow) return;
    if (tableResizeObserver) tableResizeObserver.observe(actionCell);
    bindOverflow(overflow);
    var parts = getParts(overflow);
    if (!parts.trigger || !parts.menu) return;

    getItems(parts.menu).forEach(function (item) {
      if (item.hasAttribute('data-generated-overflow')) item.remove();
    });
    buttons.forEach(function (button) {
      button.hidden = false;
    });
    parts.trigger.hidden = true;
    overflow.hidden = true;

    var visibleButtons = buttons.slice();
    var authoredItems = getItems(parts.menu);
    var maxWidth = getTableActionMaxWidth(actionCell);
    var shouldOverflow = authoredItems.length > 0;
    if (getTableActionWidth(actionCell, visibleButtons, null) > maxWidth && visibleButtons.length > 1) {
      shouldOverflow = true;
      overflow.hidden = false;
      parts.trigger.hidden = false;
      while (visibleButtons.length > 1 && getTableActionWidth(actionCell, visibleButtons, parts.trigger) > maxWidth) {
        var hideIndex = -1;
        for (var index = visibleButtons.length - 1; index >= 0; index -= 1) {
          if (!visibleButtons[index].classList.contains('btn--primary')) {
            hideIndex = index;
            break;
          }
        }
        if (hideIndex < 0) hideIndex = visibleButtons.length - 1;
        visibleButtons[hideIndex].hidden = true;
        visibleButtons.splice(hideIndex, 1);
      }
    }
    if (shouldOverflow) {
      overflow.hidden = false;
      parts.trigger.hidden = false;
    }

    var hiddenButtons = buttons.filter(function (button) { return button.hidden; });
    hiddenButtons.slice().reverse().forEach(function (button) {
      var item = createOverflowItem(button);
      item.setAttribute('data-generated-overflow', 'true');
      parts.menu.insertBefore(item, parts.menu.firstChild);
    });
    parts.menu.hidden = true;
    parts.trigger.setAttribute('aria-expanded', 'false');
    overflow.hidden = authoredItems.length === 0 && hiddenButtons.length === 0;
    parts.trigger.hidden = overflow.hidden;
  }

  function syncTableOverflows() {
    Array.prototype.slice.call(document.querySelectorAll('.table .is-actions, .table .op')).forEach(function (actionCell) {
      syncTableOverflow(actionCell);
    });
  }

  function setOpen(overflow, isOpen, restoreFocus) {
    var parts = getParts(overflow);
    if (!parts.trigger || !parts.menu) return;
    if (isOpen) portalMenu(overflow, parts.menu);
    parts.menu.hidden = !isOpen;
    parts.trigger.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) positionPortalMenu(overflow, parts.menu);
    else restoreMenu(parts.menu);
    if (isOpen && restoreFocus) {
      var firstItem = getItems(parts.menu)[0];
      if (firstItem) firstItem.focus();
    }
    if (!isOpen && restoreFocus) parts.trigger.focus();
  }

  function closeOthers(except) {
    overflows.forEach(function (overflow) {
      if (overflow !== except) setOpen(overflow, false, false);
    });
  }

  function bindOverflow(overflow) {
    if (overflow.dataset.bizOverflowInitialized === 'true') return;
    var parts = getParts(overflow);
    if (!parts.trigger || !parts.menu) return;
    overflow.dataset.bizOverflowInitialized = 'true';
    if (overflows.indexOf(overflow) < 0) overflows.push(overflow);

    parts.trigger.addEventListener('click', function (event) {
      event.stopPropagation();
      var isOpen = parts.trigger.getAttribute('aria-expanded') === 'true';
      closeOthers(overflow);
      setOpen(overflow, !isOpen, true);
    });

    parts.trigger.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        closeOthers(overflow);
        setOpen(overflow, true, true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(overflow, false, true);
      }
    });

    parts.menu.addEventListener('click', function (event) {
      var item = event.target.closest('[role="menuitem"]');
      if (!item) return;
      setOpen(overflow, false, true);
      if (item._sourceButton) item._sourceButton.click();
      overflow.dispatchEvent(new CustomEvent('biz-action-select', {
        bubbles: true,
        detail: { item: item, label: item.textContent.trim(), source: item._sourceButton || null }
      }));
    });

    parts.menu.addEventListener('keydown', function (event) {
      var items = getItems(parts.menu);
      var currentIndex = items.indexOf(document.activeElement);
      var nextIndex;
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(overflow, false, true);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        nextIndex = event.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex < 0) nextIndex = items.length - 1;
        if (nextIndex >= items.length) nextIndex = 0;
        if (items[nextIndex]) items[nextIndex].focus();
      } else if (event.key === 'Home') {
        event.preventDefault();
        if (items[0]) items[0].focus();
      } else if (event.key === 'End') {
        event.preventDefault();
        if (items[items.length - 1]) items[items.length - 1].focus();
      }
    });
  }

  overflows.slice().forEach(bindOverflow);

  function repositionOpenMenus() {
    overflows.forEach(function (overflow) {
      var parts = getParts(overflow);
      if (parts.menu && !parts.menu.hidden) positionPortalMenu(overflow, parts.menu);
    });
  }

  window.addEventListener('resize', repositionOpenMenus);
  window.addEventListener('scroll', repositionOpenMenus, true);

  var inlineBars = overflows.map(function (overflow) {
    return {
      overflow: overflow,
      actionBar: overflow.closest('.biz-action-bar--inline')
    };
  }).filter(function (entry) {
    return entry.actionBar;
  });
  inlineBars.forEach(function (entry) {
    syncInlineOverflow(entry.actionBar, entry.overflow);
  });
  syncTableOverflows();
  if (window.ResizeObserver) {
    var resizeObserver = new ResizeObserver(function () {
      inlineBars.forEach(function (entry) {
        syncInlineOverflow(entry.actionBar, entry.overflow);
      });
    });
    inlineBars.forEach(function (entry) {
      resizeObserver.observe(entry.actionBar);
    });
  }
  window.addEventListener('resize', function () {
    inlineBars.forEach(function (entry) {
      syncInlineOverflow(entry.actionBar, entry.overflow);
    });
  });
  if (window.ResizeObserver) {
    var tableResizeObserver = new ResizeObserver(function (entries) {
      entries.forEach(function (entry) {
        syncTableOverflow(entry.target);
      });
    });
    Array.prototype.slice.call(document.querySelectorAll('.table .is-actions, .table .op')).forEach(function (actionCell) {
      tableResizeObserver.observe(actionCell);
    });
  } else {
    window.addEventListener('resize', syncTableOverflows);
  }
  if (window.MutationObserver) {
    var tableMutationObserver = new MutationObserver(function (mutations) {
      var shouldSync = mutations.some(function (mutation) {
        return !mutation.target.closest || !mutation.target.closest('.biz-action-bar__menu');
      });
      if (shouldSync) syncTableOverflows();
    });
    tableMutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  document.addEventListener('click', function (event) {
    if (event.target.closest('.biz-action-bar__overflow')) return;
    overflows.forEach(function (overflow) {
      var parts = getParts(overflow);
      if (parts.menu && !parts.menu.hidden) setOpen(overflow, false, false);
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    overflows.forEach(function (overflow) {
      var parts = getParts(overflow);
      if (parts.menu && !parts.menu.hidden) setOpen(overflow, false, true);
    });
  });

  var filterBars = Array.prototype.slice.call(document.querySelectorAll('.biz-filter-bar'));
  function getFilterParts(filterBar) {
    var trigger = filterBar.querySelector('button.filter-toggle[aria-controls]');
    if (!trigger) return null;
    var panel = document.getElementById(trigger.getAttribute('aria-controls'));
    var inline = filterBar.querySelector('.biz-filter-bar__inline');
    var fields = panel && panel.querySelector('.biz-filter-bar__fields');
    if (!panel || !filterBar.contains(panel) || !inline || !fields) return null;
    return { trigger: trigger, panel: panel, inline: inline, fields: fields };
  }

  function getDirectFilterItems(container) {
    return Array.prototype.slice.call(container.children).filter(function (child) {
      return child.classList.contains('filter-item');
    });
  }

  function getFilterInlineCount(filterBar) {
    var configuredCount = parseInt(filterBar.getAttribute('data-inline-count'), 10);
    if (!isNaN(configuredCount)) return Math.max(configuredCount, 0);
    if (window.matchMedia('(min-width: 1920px)').matches) return 4;
    if (window.matchMedia('(min-width: 1200px)').matches) return 3;
    if (window.matchMedia('(min-width: 768px)').matches) return 2;
    return 1;
  }

  function syncFilterInline(filterBar, parts) {
    var items = getDirectFilterItems(parts.inline).concat(getDirectFilterItems(parts.fields));
    var inlineCount = Math.min(getFilterInlineCount(filterBar), items.length);
    items.forEach(function (item, index) {
      (index < inlineCount ? parts.inline : parts.fields).appendChild(item);
    });
    filterBar.setAttribute('data-inline-visible-count', String(inlineCount));
  }

  function setFilterOpen(filterBar, isOpen, restoreFocus) {
    var parts = getFilterParts(filterBar);
    if (!parts) return;
    filterBar.classList.toggle('is-open', isOpen);
    parts.trigger.setAttribute('aria-expanded', String(isOpen));
    parts.panel.setAttribute('aria-hidden', String(!isOpen));
    if (restoreFocus) parts.trigger.focus();
  }

  function closeOtherFilters(except) {
    filterBars.forEach(function (filterBar) {
      if (filterBar !== except) setFilterOpen(filterBar, false, false);
    });
  }

  filterBars.forEach(function (filterBar) {
    var parts = getFilterParts(filterBar);
    if (!parts) return;
    syncFilterInline(filterBar, parts);
    parts.trigger.setAttribute('aria-expanded', 'false');
    parts.panel.setAttribute('aria-hidden', 'true');
    parts.trigger.addEventListener('click', function (event) {
      event.stopPropagation();
      var isOpen = parts.trigger.getAttribute('aria-expanded') === 'true';
      closeOtherFilters(filterBar);
      setFilterOpen(filterBar, !isOpen, false);
    });
    parts.trigger.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFilterOpen(filterBar, false, true);
      }
    });
  });

  function syncAllFilterInline() {
    filterBars.forEach(function (filterBar) {
      var parts = getFilterParts(filterBar);
      if (parts) syncFilterInline(filterBar, parts);
    });
  }

  if (window.matchMedia) {
    var filterWideQuery = window.matchMedia('(min-width: 1920px)');
    if (filterWideQuery.addEventListener) filterWideQuery.addEventListener('change', syncAllFilterInline);
    else if (filterWideQuery.addListener) filterWideQuery.addListener(syncAllFilterInline);
  }
  window.addEventListener('resize', syncAllFilterInline);

  document.addEventListener('click', function (event) {
    if (event.target.closest('.biz-filter-bar')) return;
    filterBars.forEach(function (filterBar) { setFilterOpen(filterBar, false, false); });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    filterBars.forEach(function (filterBar) {
      if (filterBar.classList.contains('is-open')) {
        setFilterOpen(filterBar, false, filterBar.contains(document.activeElement));
      }
    });
  });

  var chartInstances = [];
  function resizeChart(entry) {
    var canvas = entry.root.querySelector('.biz-chart__canvas');
    if (!canvas || !entry.chart) return;
    entry.chart.resize({ width: canvas.clientWidth, height: canvas.clientHeight });
  }
  var chartResizeObserver = window.ResizeObserver ? new ResizeObserver(function (entries) {
    entries.forEach(function (item) {
      var entry = item.target._bizChartEntry;
      if (entry && entry.chart) {
        var previousWidth = entry.chart.getWidth();
        resizeChart(entry);
        if ((entry.type === 'donut' || entry.type === 'pie') && previousWidth !== entry.chart.getWidth()) renderChartEntry(entry);
      }
    });
  }) : null;
  var chartColorTokens = [
    '--color-primary',
    '--color-aux-blue',
    '--color-success',
    '--color-warning',
    '--color-error'
  ];

  function getChartToken(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function getChartNumberToken(name, fallback) {
    var value = parseFloat(getChartToken(name));
    return isNaN(value) ? fallback : value;
  }

  function getChartFontMetric(name, fallbackSize, fallbackLineHeight) {
    var metric = getChartToken(name);
    var match = metric.match(/(\d+)px\/(\d+)px/);
    return {
      size: match ? Number(match[1]) : fallbackSize,
      lineHeight: match ? Number(match[2]) : fallbackLineHeight
    };
  }

  function formatChartNumber(value) {
    return Number(value).toLocaleString('zh-CN');
  }

  function withChartAlpha(color, alpha) {
    var hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      var value = hex[1];
      if (value.length === 3) value = value.split('').map(function (part) { return part + part; }).join('');
      return 'rgba(' + parseInt(value.slice(0, 2), 16) + ', ' + parseInt(value.slice(2, 4), 16) + ', ' + parseInt(value.slice(4, 6), 16) + ', ' + alpha + ')';
    }
    var rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb) return 'rgba(' + rgb[1] + ', ' + rgb[2] + ', ' + rgb[3] + ', ' + alpha + ')';
    return color;
  }

  function createChartAreaGradient(color) {
    return new window.echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: withChartAlpha(color, 0.24) },
      { offset: 1, color: withChartAlpha(color, 0.02) }
    ]);
  }

  function getChartTheme() {
    var caption = getChartFontMetric('--font-caption', 12, 18);
    var bodyStrong = getChartFontMetric('--font-body-strong', 14, 22);
    var metric = getChartFontMetric('--font-metric', 28, 34);
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    return {
      family: getChartToken('--font-family'),
      caption: caption,
      bodyStrong: bodyStrong,
      metric: metric,
      colors: chartColorTokens.map(getChartToken).filter(Boolean),
      border: getChartToken('--color-border'),
      container: getChartToken('--color-bg-container'),
      primaryBackground: getChartToken('--color-primary-bg'),
      textBody: getChartToken('--text-body'),
      textSecondary: getChartToken('--text-secondary'),
      textCaption: getChartToken('--text-caption'),
      textOnPrimary: getChartToken('--text-on-primary'),
      tooltipBackground: getChartToken('--color-tooltip-bg'),
      tooltipText: getChartToken(isDark ? '--text-title' : '--text-on-primary'),
      radius: getChartNumberToken('--radius-sm', 4),
      stroke: getChartNumberToken('--size-chart-line-width', 2),
      spaceXs: getChartNumberToken('--space-xs', 8),
      spaceSm: getChartNumberToken('--space-sm', 16),
      spaceMd: getChartNumberToken('--space-md', 24),
      pointSize: getChartNumberToken('--size-icon-sm', 12)
    };
  }

  function parseChartData(root) {
    var source = root.querySelector('script[data-chart-data]');
    var parsed;
    if (!source) return null;
    try {
      parsed = JSON.parse(source.textContent || '');
    } catch (error) {
      return null;
    }
    if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.series) || !parsed.series.length) return null;
    var categories = parsed.categories.map(function (category) { return String(category); });
    var series = parsed.series.map(function (item) {
      if (!item || !Array.isArray(item.data) || item.data.length !== categories.length) return null;
      var values = item.data.map(function (value) { return Number(value); });
      if (values.some(function (value) { return !isFinite(value); })) return null;
      return { name: String(item.name || '数据'), data: values };
    });
    if (series.some(function (item) { return !item; })) return null;
    return { categories: categories, series: series };
  }

  function ensureChartTable(root, chartData) {
    var dataElement = root.querySelector('script[data-chart-data]');
    var table = root.querySelector('table.biz-chart__data');
    if (!table) {
      table = document.createElement('table');
      table.className = 'biz-chart__data visually-hidden';
      root.insertBefore(table, dataElement || null);
    }
    table.textContent = '';
    var head = document.createElement('thead');
    var headRow = document.createElement('tr');
    var categoryHead = document.createElement('th');
    categoryHead.scope = 'col';
    categoryHead.textContent = '分类';
    headRow.appendChild(categoryHead);
    chartData.series.forEach(function (item) {
      var seriesHead = document.createElement('th');
      seriesHead.scope = 'col';
      seriesHead.textContent = item.name;
      headRow.appendChild(seriesHead);
    });
    head.appendChild(headRow);
    table.appendChild(head);
    var body = document.createElement('tbody');
    chartData.categories.forEach(function (category, categoryIndex) {
      var row = document.createElement('tr');
      var categoryCell = document.createElement('th');
      categoryCell.scope = 'row';
      categoryCell.textContent = category;
      row.appendChild(categoryCell);
      chartData.series.forEach(function (item) {
        var valueCell = document.createElement('td');
        valueCell.textContent = String(item.data[categoryIndex]);
        row.appendChild(valueCell);
      });
      body.appendChild(row);
    });
    table.appendChild(body);
    return table;
  }

  function showChartFallback(entry, message) {
    var canvas = entry.root.querySelector('.biz-chart__canvas');
    var table = entry.root.querySelector('table.biz-chart__data');
    if (!canvas) return;
    canvas.classList.add('is-fallback');
    canvas.textContent = '';
    var fallback = document.createElement('span');
    fallback.className = 'biz-chart__fallback';
    fallback.textContent = message;
    canvas.appendChild(fallback);
    if (table) table.classList.remove('visually-hidden');
    entry.root.setAttribute('data-chart-state', 'fallback');
  }

  function buildChartOption(entry) {
    var theme = getChartTheme();
    var isDonut = entry.type === 'donut' || entry.type === 'pie';
    var isGauge = entry.type === 'gauge';
    var isArea = entry.type === 'area';
    var isHorizontalBar = entry.type === 'horizontal-bar';
    var isRadar = entry.type === 'radar';
    var isFunnel = entry.type === 'funnel';
    var isCompactDonut = isDonut && entry.chart && entry.chart.getWidth() < 420;
    var hasLegend = !isGauge && !isDonut && entry.data.series.length > 1;
    var option = {
      animation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      aria: { enabled: true },
      color: theme.colors,
      textStyle: { fontFamily: theme.family },
      tooltip: {
        trigger: isDonut || isGauge ? 'item' : 'axis',
        confine: true,
        backgroundColor: theme.tooltipBackground,
        borderColor: theme.border,
        textStyle: { color: theme.tooltipText, fontFamily: theme.family, fontSize: theme.bodyStrong.size, lineHeight: theme.bodyStrong.lineHeight }
      },
      legend: {
        show: hasLegend,
        type: 'scroll',
        left: 'center',
        top: 0,
        itemWidth: theme.spaceXs,
        itemHeight: theme.stroke,
        itemStyle: { borderWidth: 0 },
        itemGap: theme.spaceSm,
        textStyle: { color: theme.textSecondary, fontFamily: theme.family, fontSize: theme.caption.size, lineHeight: theme.caption.lineHeight }
      }
    };

    if (entry.type === 'line' || isArea) {
      option.legend.icon = 'circle';
      option.legend.itemHeight = theme.spaceXs;
    }

    if (isDonut) {
      var donutSeries = entry.data.series[0];
      var donutTotal = donutSeries.data.reduce(function (total, value) { return total + value; }, 0);
      option.title = {
        text: '{value|' + formatChartNumber(donutTotal) + '}\n{label|' + donutSeries.name + '}',
        left: '50%',
        top: '56%',
        padding: 0,
        textAlign: 'center',
        textVerticalAlign: 'middle',
        textStyle: {
          color: theme.textBody,
          fontFamily: theme.family,
          fontSize: theme.metric.size,
          lineHeight: theme.metric.lineHeight,
          fontWeight: 700,
          rich: {
            value: { color: theme.textBody, fontFamily: theme.family, fontSize: theme.metric.size, lineHeight: theme.metric.lineHeight, fontWeight: 700 },
            label: { color: theme.textSecondary, fontFamily: theme.family, fontSize: theme.caption.size, lineHeight: theme.caption.lineHeight, fontWeight: 400 }
          }
        }
      };
      option.series = [{
        name: donutSeries.name,
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '56%'],
        avoidLabelOverlap: true,
        data: entry.data.categories.map(function (category, index) {
          return { name: category, value: donutSeries.data[index] };
        }),
        itemStyle: { borderColor: theme.container, borderWidth: theme.stroke },
        label: {
          show: true,
          position: 'outside',
          alignTo: 'edge',
          edgeDistance: theme.spaceXs,
          bleedMargin: theme.spaceXs,
          color: theme.textBody,
          fontFamily: theme.family,
          fontSize: theme.caption.size,
          lineHeight: theme.caption.lineHeight,
          formatter: function (params) { return isCompactDonut ? params.name + '\n' + formatChartNumber(params.value) : params.name + ': ' + formatChartNumber(params.value); }
        },
        labelLine: {
          show: true,
          length: theme.spaceSm,
          length2: theme.spaceSm,
          lineStyle: { color: theme.border, width: theme.stroke }
        },
        emphasis: { label: { show: true } }
      }];
      return option;
    }

    if (isRadar) {
      var radarDataMax = 0;
      entry.data.series.forEach(function (item) {
        item.data.forEach(function (value) {
          radarDataMax = Math.max(radarDataMax, value);
        });
      });
      var radarMax = entry.root.hasAttribute('data-chart-max') ? entry.max : Math.max(1, Math.ceil(radarDataMax / 10) * 10);
      option.legend.show = entry.data.series.length > 1;
      option.tooltip.trigger = 'item';
      option.radar = {
        center: ['50%', '54%'],
        radius: '64%',
        shape: 'polygon',
        splitNumber: 4,
        indicator: entry.data.categories.map(function (category) { return { name: category, max: radarMax }; }),
        axisName: { color: theme.textCaption, fontFamily: theme.family, fontSize: theme.caption.size, lineHeight: theme.caption.lineHeight, fontWeight: 400 },
        axisLine: { lineStyle: { color: theme.border, width: theme.stroke } },
        splitLine: { lineStyle: { color: theme.border, width: theme.stroke } },
        splitArea: { areaStyle: { color: [theme.container, theme.primaryBackground] } }
      };
      option.series = entry.data.series.map(function (item, seriesIndex) {
        var color = theme.colors[seriesIndex % theme.colors.length];
        return {
          name: item.name,
          type: 'radar',
          symbol: 'circle',
          symbolSize: theme.pointSize,
          lineStyle: { color: color, width: theme.stroke },
          itemStyle: { color: color },
          areaStyle: { color: withChartAlpha(color, 0.18) },
          data: [{ name: item.name, value: item.data }]
        };
      });
      return option;
    }

    if (isFunnel) {
      var funnelData = entry.data.categories.map(function (category, index) {
        return { name: category, value: entry.data.series[0].data[index] };
      });
      var funnelMax = funnelData.length ? Math.max.apply(null, funnelData.map(function (item) { return item.value; })) : 1;
      option.legend.show = entry.data.series.length > 1;
      option.tooltip.trigger = 'item';
      option.series = [{
        name: entry.data.series[0].name,
        type: 'funnel',
        left: '8%',
        right: '8%',
        top: theme.spaceSm,
        bottom: theme.spaceSm,
        min: 0,
        max: entry.root.hasAttribute('data-chart-max') ? entry.max : funnelMax,
        minSize: '18%',
        maxSize: '100%',
        sort: 'descending',
        gap: theme.spaceXs,
        label: {
          show: true,
          position: 'inside',
          color: theme.textOnPrimary,
          fontFamily: theme.family,
          fontSize: theme.caption.size,
          lineHeight: theme.caption.lineHeight,
          fontWeight: 400,
          formatter: function (params) { return params.name + ' ' + formatChartNumber(params.value) + entry.unit; }
        },
        labelLine: { show: false },
        itemStyle: {
          borderColor: theme.container,
          borderWidth: theme.stroke,
          color: function (params) { return theme.colors[params.dataIndex % theme.colors.length]; }
        },
        emphasis: { label: { fontWeight: 700 } },
        data: funnelData
      }];
      return option;
    }

    if (isGauge) {
      var gaugeSeries = entry.data.series[0];
      var gaugeValue = gaugeSeries.data[0];
      option.legend.show = false;
      option.series = [{
        name: gaugeSeries.name,
        type: 'gauge',
        min: 0,
        max: entry.max,
        startAngle: 90,
        endAngle: -270,
        radius: '76%',
        center: ['50%', '54%'],
        progress: { show: true, roundCap: true, width: theme.spaceSm, itemStyle: { color: theme.colors[0] } },
        axisLine: { lineStyle: { width: theme.spaceSm, color: [[1, theme.border]] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: true, offsetCenter: [0, '22%'], color: theme.textSecondary, fontFamily: theme.family, fontSize: theme.caption.size, lineHeight: theme.caption.lineHeight, fontWeight: 400 },
        detail: { valueAnimation: false, offsetCenter: [0, '-8%'], color: theme.textBody, fontFamily: theme.family, fontSize: theme.metric.size, lineHeight: theme.metric.lineHeight, fontWeight: 700, formatter: function (value) { return formatChartNumber(value) + entry.unit; } },
        data: [{ value: gaugeValue, name: gaugeSeries.name }]
      }];
      return option;
    }

    option.grid = { left: theme.spaceSm, right: theme.spaceSm, top: hasLegend ? theme.spaceMd : theme.spaceXs, bottom: theme.spaceSm, containLabel: true };
    if (isHorizontalBar) {
      option.xAxis = {
        type: 'value',
        splitLine: { lineStyle: { color: theme.border, type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: theme.textBody, fontFamily: theme.family, fontSize: theme.bodyStrong.size, lineHeight: theme.bodyStrong.lineHeight, fontWeight: 400 }
      };
      option.yAxis = {
        type: 'category',
        data: entry.data.categories,
        inverse: true,
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { show: false },
        axisLabel: { color: theme.textCaption, fontFamily: theme.family, fontSize: theme.caption.size, lineHeight: theme.caption.lineHeight }
      };
    } else {
      option.xAxis = {
        type: 'category',
        data: entry.data.categories,
        boundaryGap: entry.type === 'bar',
        axisLine: { lineStyle: { color: theme.border } },
        axisTick: { show: false },
        axisLabel: { color: theme.textCaption, fontFamily: theme.family, fontSize: theme.caption.size, lineHeight: theme.caption.lineHeight }
      };
      option.yAxis = {
        type: 'value',
        splitLine: { lineStyle: { color: theme.border, type: 'dashed' } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: theme.textBody, fontFamily: theme.family, fontSize: theme.caption.size, lineHeight: theme.caption.lineHeight, fontWeight: 400 }
      };
    }
    option.series = entry.data.series.map(function (item, seriesIndex) {
      var color = theme.colors[seriesIndex % theme.colors.length];
      var seriesOption = {
        name: item.name,
        type: isHorizontalBar || isArea ? (isArea ? 'line' : 'bar') : entry.type,
        data: item.data,
        itemStyle: { color: color, borderColor: theme.container, borderWidth: theme.stroke }
      };
      if (entry.type === 'line' || isArea) {
        seriesOption.smooth = true;
        seriesOption.showSymbol = true;
        seriesOption.symbol = 'circle';
        seriesOption.symbolSize = theme.pointSize;
        seriesOption.lineStyle = { color: color, width: theme.stroke };
        if (isArea || entry.data.series.length === 1) seriesOption.areaStyle = { color: createChartAreaGradient(color) };
      } else {
        seriesOption.barMaxWidth = theme.spaceMd;
        seriesOption.itemStyle.borderRadius = isHorizontalBar ? [0, theme.radius, theme.radius, 0] : [theme.radius, theme.radius, 0, 0];
      }
      return seriesOption;
    });
    return option;
  }

  function renderChartEntry(entry) {
    var canvas = entry.root.querySelector('.biz-chart__canvas');
    if (!canvas || !entry.chart) return;
    canvas.classList.remove('is-fallback');
    var table = entry.root.querySelector('table.biz-chart__data');
    if (table) table.classList.add('visually-hidden');
    entry.chart.setOption(buildChartOption(entry), true);
    resizeChart(entry);
    entry.root.setAttribute('data-chart-state', 'ready');
  }

  function initRankingLists() {
    Array.prototype.slice.call(document.querySelectorAll('[data-biz-ranking-list]')).forEach(function (list) {
      var items = Array.prototype.slice.call(list.children).filter(function (item) {
        return item.classList.contains('biz-ranking-list__item');
      });
      var entries = [];
      items.forEach(function (item, index) {
        item.hidden = index >= 10;
        if (item.hidden) return;
        var rawValue = item.getAttribute('data-value');
        var value = rawValue === null || rawValue.trim() === '' ? NaN : Number(rawValue);
        var name = item.querySelector('.biz-ranking-list__name');
        var progress = item.querySelector('.biz-ranking-list__progress');
        var fill = progress && progress.querySelector('.progress__bar');
        if (!isFinite(value) || value < 0 || !name || !progress || !fill) {
          item.hidden = true;
          return;
        }
        entries.push({ value: value, name: name.textContent.trim(), progress: progress, fill: fill });
      });

      var maxValue = entries.reduce(function (max, entry) { return Math.max(max, entry.value); }, 0);
      var ariaMax = maxValue > 0 ? maxValue : 1;
      entries.forEach(function (entry) {
        var ratio = maxValue > 0 ? entry.value / maxValue * 100 : 0;
        entry.fill.style.width = Math.round(ratio * 10) / 10 + '%';
        entry.progress.setAttribute('aria-label', entry.name + '相对榜首');
        entry.progress.setAttribute('aria-valuemin', '0');
        entry.progress.setAttribute('aria-valuenow', String(entry.value));
        entry.progress.setAttribute('aria-valuemax', String(ariaMax));
      });
    });
  }

  function initCharts() {
    Array.prototype.slice.call(document.querySelectorAll('[data-biz-chart]')).forEach(function (root) {
      var existing = root._bizChartEntry;
      if (existing && existing.chart) return;
      var type = root.getAttribute('data-chart-type') || 'line';
      var chartData = parseChartData(root);
      var entry = existing || { root: root, type: type, data: chartData, chart: null };
      entry.type = type;
      entry.data = chartData;
      var max = parseFloat(root.getAttribute('data-chart-max'));
      entry.max = isFinite(max) && max > 0 ? max : 100;
      entry.unit = root.getAttribute('data-chart-unit') || '';
      root._bizChartEntry = entry;
      ensureChartTable(root, chartData || { categories: [], series: [] });
      if (!chartData || ['line', 'area', 'bar', 'horizontal-bar', 'donut', 'pie', 'gauge', 'radar', 'funnel'].indexOf(type) < 0) {
        showChartFallback(entry, '图表数据暂不可用，请检查数据源。');
        return;
      }
      if (!window.echarts || typeof window.echarts.init !== 'function') {
        showChartFallback(entry, '图表运行时未加载，数据表仍可查看。');
        return;
      }
      var canvas = root.querySelector('.biz-chart__canvas');
      if (!canvas) return;
      canvas.textContent = '';
      entry.chart = window.echarts.init(canvas, null, { devicePixelRatio: Math.max(window.devicePixelRatio || 1, 2) });
      canvas._bizChartEntry = entry;
      if (chartResizeObserver) chartResizeObserver.observe(canvas);
      if (chartInstances.indexOf(entry) < 0) chartInstances.push(entry);
      renderChartEntry(entry);
    });
  }

  window.ChintBusinessComponents.initRankingLists = initRankingLists;
  initRankingLists();
  function refreshCharts() {
    chartInstances.forEach(renderChartEntry);
  }

  window.ChintBusinessComponents.initCharts = initCharts;
  window.ChintBusinessComponents.refreshCharts = refreshCharts;
  initCharts();
  if (window.MutationObserver) {
    var chartThemeObserver = new MutationObserver(function (mutations) {
      if (mutations.some(function (mutation) { return mutation.attributeName === 'data-theme'; })) refreshCharts();
    });
    chartThemeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
  var chartResizeTimer = null;
  window.addEventListener('resize', function () {
    if (chartResizeTimer) window.clearTimeout(chartResizeTimer);
    chartResizeTimer = window.setTimeout(function () {
      chartInstances.forEach(resizeChart);
      chartResizeTimer = null;
    }, 0);
  });
}());
