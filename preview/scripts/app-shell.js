/* Shared application-shell behavior for Backend UI Design System v2.1. */
(function () {
  if (window.ChintAppShell) return;

  var app = document.querySelector('[data-app-shell], .app');
  var sidebar = document.querySelector('.sidebar');
  var toggle = document.querySelector('.sidebar__toggle, .nav-toggle');
  var overlay = document.querySelector('.sidebar-overlay');
  var closeButton = document.querySelector('.sidebar__close, .sidebar__drawer-close');
  var themeToggle = document.getElementById('theme-toggle');

  function initPageTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-page-tabs]'), function (root) {
      var tablist = root.querySelector('[role="tablist"]');
      var tabScroll = root.querySelector('.page-tabs__scroll');
      var previousButton = root.querySelector('.page-tabs__nav--prev');
      var nextButton = root.querySelector('.page-tabs__nav--next');
      var overflow = root.querySelector('.page-tabs__overflow');
      var overflowTrigger = root.querySelector('.page-tabs__overflow-trigger');
      var overflowMenu = root.querySelector('.page-tabs__overflow-menu');
      var clearButton = root.querySelector('.page-tabs__clear');
      var storageKey = root.getAttribute('data-page-tabs-storage');
      var maxTabs = Number(root.getAttribute('data-page-tabs-max')) || 10;
      var restoredActiveId = null;
      if (!tablist) return;

      function updateScrollButtons() {
        if (!tabScroll) return;
        var maxScrollLeft = Math.max(0, tabScroll.scrollWidth - tabScroll.clientWidth);
        var hasOverflow = maxScrollLeft > 1;
        root.classList.toggle('has-overflow', hasOverflow);
        if (!hasOverflow) closeOverflowMenu();
        maxScrollLeft = Math.max(0, tabScroll.scrollWidth - tabScroll.clientWidth);
        if (previousButton) previousButton.disabled = tabScroll.scrollLeft <= 1;
        if (nextButton) nextButton.disabled = tabScroll.scrollLeft >= maxScrollLeft - 1;
      }

      function scrollTabs(direction) {
        if (!tabScroll) return;
        var distance = Math.max(tabScroll.clientWidth * 0.8, 1);
        var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        tabScroll.scrollBy({ left: direction * distance, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      }

      function getItems() {
        return Array.prototype.slice.call(tablist.querySelectorAll('.page-tabs__item[role="tab"]'));
      }

      function getPanel(item) {
        var panelId = item.getAttribute('aria-controls');
        return panelId ? document.getElementById(panelId) : null;
      }

      function showToast(message) {
        var toast = document.getElementById('page-tabs-toast');
        var toastWrap = document.getElementById('page-tabs-toast-wrap');
        if (!toast || !toastWrap) {
          toastWrap = document.createElement('div');
          toast = document.createElement('div');
          toastWrap.id = 'page-tabs-toast-wrap';
          toastWrap.className = 'toast-wrap';
          toastWrap.hidden = true;
          toast.id = 'page-tabs-toast';
          toast.className = 'toast toast--warning';
          toast.setAttribute('role', 'status');
          toast.setAttribute('aria-live', 'polite');
          toastWrap.appendChild(toast);
          document.body.appendChild(toastWrap);
        }
        toast.textContent = message;
        toastWrap.hidden = false;
        window.clearTimeout(showToast.timer);
        showToast.timer = window.setTimeout(function () { toastWrap.hidden = true; }, 3000);
      }

      function persistOpenItems() {
        if (!storageKey) return;
        var activeItem = getItems().find(function (item) { return item.getAttribute('aria-selected') === 'true'; });
        window.sessionStorage.setItem(storageKey, JSON.stringify({
          open: getItems().map(function (item) { return item.id; }),
          active: activeItem ? activeItem.id : null
        }));
      }

      function removeItem(item) {
        var panel = getPanel(item);
        item.remove();
        if (panel && panel.hasAttribute('data-page-tab-panel')) panel.remove();
      }

      function restoreOpenItems() {
        if (!storageKey) return;
        var storedIds;
        try {
          storedIds = JSON.parse(window.sessionStorage.getItem(storageKey));
        } catch (error) {
          storedIds = null;
        }
        if (Array.isArray(storedIds)) storedIds = { open: storedIds, active: null };
        if (!storedIds || !Array.isArray(storedIds.open)) {
          persistOpenItems();
          return;
        }
        restoredActiveId = storedIds.active;
        getItems().forEach(function (item) {
          if (storedIds.open.indexOf(item.id) === -1) removeItem(item);
        });
      }

      function enforceMaxTabs() {
        var items = getItems();
        while (items.length > maxTabs) {
          var removable = items.slice().reverse().find(function (item) { return !item.hasAttribute('data-page-tab-fixed'); });
          if (!removable) break;
          removeItem(removable);
          items = getItems();
        }
        if (items.length >= maxTabs) showToast('最多同时打开 ' + maxTabs + ' 个页签，请先关闭不需要的页签。');
      }

      function closeOverflowMenu() {
        if (!overflowTrigger || !overflowMenu) return;
        overflowTrigger.setAttribute('aria-expanded', 'false');
        overflowMenu.classList.remove('is-open');
        overflowMenu.hidden = true;
      }

      function renderOverflowMenu() {
        if (!overflowMenu) return;
        overflowMenu.textContent = '';
        getItems().forEach(function (item) {
          var menuItem = document.createElement('button');
          menuItem.type = 'button';
          menuItem.className = 'dropdown__item page-tabs__overflow-item' + (item.getAttribute('aria-selected') === 'true' ? ' is-active' : '');
          menuItem.setAttribute('role', 'menuitem');
          menuItem.textContent = item.getAttribute('aria-label');
          menuItem.addEventListener('click', function () {
            closeOverflowMenu();
            activate(item, true);
          });
          overflowMenu.appendChild(menuItem);
        });
        closeOverflowMenu();
      }

      function updateClearButton() {
        if (!clearButton) return;
        var hasClosableItem = getItems().some(function (item) {
          return !item.hasAttribute('data-page-tab-fixed') && item.getAttribute('aria-disabled') !== 'true';
        });
        clearButton.disabled = !hasClosableItem;
      }

      function activate(item, shouldFocus) {
        if (!item || item.getAttribute('aria-disabled') === 'true') return;
        getItems().forEach(function (current) {
          var isActive = current === item;
          current.classList.toggle('is-active', isActive);
          current.setAttribute('aria-selected', String(isActive));
          current.tabIndex = isActive ? 0 : -1;
          var panel = getPanel(current);
          if (panel) panel.hidden = !isActive;
        });
        if (shouldFocus) item.focus();
        if (tabScroll) {
          var tabRect = item.getBoundingClientRect();
          var scrollRect = tabScroll.getBoundingClientRect();
          var itemLeft = tabScroll.scrollLeft + tabRect.left - scrollRect.left;
          var itemRight = itemLeft + tabRect.width;
          var visibleLeft = tabScroll.scrollLeft;
          var visibleRight = visibleLeft + tabScroll.clientWidth;
          var targetLeft = visibleLeft;
          if (itemLeft < visibleLeft) targetLeft = itemLeft;
          else if (itemRight > visibleRight) targetLeft = itemRight - tabScroll.clientWidth;
          var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (targetLeft !== visibleLeft) {
            tabScroll.scrollTo({ left: targetLeft, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
          }
        }
        persistOpenItems();
        renderOverflowMenu();
      }

      function closeItem(item) {
        if (!item || item.hasAttribute('data-page-tab-fixed') || item.getAttribute('aria-disabled') === 'true') return;
        var items = getItems();
        var index = items.indexOf(item);
        var wasActive = item.getAttribute('aria-selected') === 'true';
        removeItem(item);
        var remaining = getItems();
        if (wasActive && remaining.length) activate(remaining[Math.min(index, remaining.length - 1)], true);
        persistOpenItems();
        renderOverflowMenu();
        updateClearButton();
        updateScrollButtons();
      }

      function closeAll() {
        getItems().forEach(function (item) {
          if (item.hasAttribute('data-page-tab-fixed') || item.getAttribute('aria-disabled') === 'true') return;
          removeItem(item);
        });
        var remaining = getItems();
        if (remaining.length) activate(remaining[0], false);
        persistOpenItems();
        renderOverflowMenu();
        updateClearButton();
        updateScrollButtons();
      }

      getItems().forEach(function (item) {
        item.addEventListener('click', function (event) {
          if (event.target.closest('.page-tabs__close')) return;
          activate(item, true);
        });
        item.addEventListener('keydown', function (event) {
          if (event.target !== item) return;
          var items = getItems();
          var index = items.indexOf(item);
          var nextIndex;
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % items.length;
          else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + items.length) % items.length;
          else if (event.key === 'Home') nextIndex = 0;
          else if (event.key === 'End') nextIndex = items.length - 1;
          else return;
          event.preventDefault();
          activate(items[nextIndex], true);
        });
        var itemClose = item.querySelector('.page-tabs__close');
        if (itemClose) itemClose.addEventListener('click', function (event) {
          event.stopPropagation();
          closeItem(item);
        });
      });

      if (previousButton) previousButton.addEventListener('click', function () { scrollTabs(-1); });
      if (nextButton) nextButton.addEventListener('click', function () { scrollTabs(1); });
      if (overflowTrigger && overflowMenu) overflowTrigger.addEventListener('click', function () {
        var isOpen = overflowTrigger.getAttribute('aria-expanded') === 'true';
        overflowTrigger.setAttribute('aria-expanded', String(!isOpen));
        overflowMenu.classList.toggle('is-open', !isOpen);
        overflowMenu.hidden = isOpen;
        if (!isOpen) {
          var activeMenuItem = overflowMenu.querySelector('.is-active');
          if (activeMenuItem) activeMenuItem.focus();
        }
      });
      document.addEventListener('click', function (event) {
        if (overflow && !overflow.contains(event.target)) closeOverflowMenu();
      });
      document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape' || !overflowTrigger || overflowTrigger.getAttribute('aria-expanded') !== 'true') return;
        closeOverflowMenu();
        overflowTrigger.focus();
      });
      if (tabScroll) {
        tabScroll.addEventListener('scroll', updateScrollButtons, { passive: true });
        window.addEventListener('resize', updateScrollButtons);
      }
      if (clearButton) clearButton.addEventListener('click', closeAll);
      restoreOpenItems();
      enforceMaxTabs();
      var activeItem = getItems().find(function (item) { return item.id === restoredActiveId; }) || getItems().find(function (item) { return item.getAttribute('aria-selected') === 'true'; }) || getItems()[0];
      if (activeItem) activate(activeItem, false);
      updateClearButton();
      updateScrollButtons();
    });
  }

  initPageTabs();
  if (!app) return;

  window.ChintAppShell = { version: '2.1' };

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
      var nextThemeLabel = theme === 'dark' ? '浅色' : '深色';
      themeToggle.setAttribute('aria-label', '切换至' + nextThemeLabel + '模式');
      themeToggle.setAttribute('title', '切换至' + nextThemeLabel + '模式');
    }
  }

  function syncThemeFromPreference() {
    var savedTheme = localStorage.getItem('theme');
    var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : systemTheme);
  }

  syncThemeFromPreference();
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', nextTheme);
      setTheme(nextTheme);
    });
  }
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
    if (!localStorage.getItem('theme')) syncThemeFromPreference();
  });

  if (!sidebar || !toggle) return;

  function isMobile() {
    return window.matchMedia('(max-width: 767px)').matches;
  }

  function setOpen(isOpen) {
    app.classList.toggle('sidebar-collapsed', !isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? '收起导航菜单' : '打开导航菜单');
    syncCollapsedTooltips(!isOpen && !isMobile());
  }

  function syncCollapsedTooltips(isCollapsed) {
    Array.prototype.forEach.call(sidebar.querySelectorAll('.sidebar__item'), function (item) {
      var label = item.getAttribute('data-sidebar-label');
      if (!label) {
        label = item.textContent.replace(/\s+/g, ' ').trim();
        item.setAttribute('data-sidebar-label', label);
      }
      if (isCollapsed) item.setAttribute('title', label);
      else item.removeAttribute('title');
    });
  }

  function getFocusable() {
    return Array.prototype.slice.call(sidebar.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
  }

  function restoreFocus() {
    toggle.focus();
  }

  function close() {
    setOpen(false);
    document.removeEventListener('keydown', onKeydown);
    restoreFocus();
  }

  function open() {
    setOpen(true);
    if (isMobile()) {
      var focusable = getFocusable();
      if (focusable.length) focusable[0].focus();
      document.addEventListener('keydown', onKeydown);
    }
  }

  function onKeydown(event) {
    if (!isMobile() || app.classList.contains('sidebar-collapsed')) return;
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    var focusable = getFocusable();
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function toggleNavigation(event) {
    if (event) event.stopImmediatePropagation();
    if (app.classList.contains('sidebar-collapsed')) open();
    else close();
  }

  function closeNavigation(event) {
    if (event) event.stopImmediatePropagation();
    close();
  }

  function toggleSubmenu(item) {
    var submenu = document.getElementById(item.getAttribute('aria-controls'));
    if (!submenu) return;
    var isOpen = item.getAttribute('aria-expanded') === 'true';
    item.setAttribute('aria-expanded', String(!isOpen));
    submenu.classList.toggle('is-open', !isOpen);
  }

  document.addEventListener('click', function (event) {
    if (event.target.closest('.sidebar__toggle, .nav-toggle')) toggleNavigation(event);
    else if (event.target.closest('.sidebar__close, .sidebar__drawer-close, .sidebar-overlay')) closeNavigation(event);
  }, true);

  sidebar.addEventListener('click', function (event) {
    var parentItem = event.target.closest('.sidebar__item--parent');
    if (parentItem) {
      toggleSubmenu(parentItem);
      return;
    }
    if (isMobile() && event.target.closest('a[href]')) close();
  });

  sidebar.addEventListener('keydown', function (event) {
    var parentItem = event.target.closest('.sidebar__item--parent');
    if (!parentItem || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    toggleSubmenu(parentItem);
  });

  function syncForViewport() {
    document.removeEventListener('keydown', onKeydown);
    setOpen(!isMobile());
  }

  syncForViewport();
  window.matchMedia('(max-width: 767px)').addEventListener('change', syncForViewport);
}());

(function () {
  function initCounter(root) {
    var input = root.querySelector('.counter__input');
    var decrease = root.querySelector('[data-counter-action="decrease"]');
    var increase = root.querySelector('[data-counter-action="increase"]');
    if (!input || !decrease || !increase) return;

    function getNumberAttribute(name, fallback) {
      var value = input.getAttribute(name);
      var parsed = value === null ? NaN : Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    function getPrecision(value) {
      var decimalIndex = String(value).indexOf('.');
      return decimalIndex === -1 ? 0 : String(value).length - decimalIndex - 1;
    }

    function getSettings() {
      var min = getNumberAttribute('min', 0);
      var max = getNumberAttribute('max', Infinity);
      var step = getNumberAttribute('step', 1);
      return { min: min, max: max, step: step > 0 ? step : 1 };
    }

    function normalize(value) {
      var settings = getSettings();
      var nextValue = Number.isFinite(value) ? value : settings.min;
      nextValue = settings.min + Math.round((nextValue - settings.min) / settings.step) * settings.step;
      nextValue = Math.max(settings.min, Math.min(settings.max, nextValue));
      var precision = Math.max(getPrecision(settings.min), getPrecision(settings.max), getPrecision(settings.step));
      return Number(nextValue.toFixed(precision));
    }

    function updateControls() {
      var settings = getSettings();
      var value = input.valueAsNumber;
      var disabled = root.classList.contains('is-disabled') || input.disabled;
      decrease.disabled = disabled || (Number.isFinite(value) && value <= settings.min);
      increase.disabled = disabled || (Number.isFinite(value) && Number.isFinite(settings.max) && value >= settings.max);
    }

    function setValue(value, emitEvents) {
      input.value = String(normalize(value));
      updateControls();
      if (!emitEvents) return;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function adjust(direction) {
      var settings = getSettings();
      var value = Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : settings.min;
      setValue(value + direction * settings.step, true);
    }

    decrease.addEventListener('click', function () { adjust(-1); });
    increase.addEventListener('click', function () { adjust(1); });
    input.addEventListener('input', updateControls);
    input.addEventListener('change', function () { setValue(input.valueAsNumber, false); });
    input.addEventListener('blur', function () { setValue(input.valueAsNumber, false); });
    input.addEventListener('keydown', function (event) {
      if (root.classList.contains('is-disabled') || input.disabled) return;
      var settings = getSettings();
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        adjust(event.key === 'ArrowUp' ? 1 : -1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setValue(settings.min, true);
      } else if (event.key === 'End' && Number.isFinite(settings.max)) {
        event.preventDefault();
        setValue(settings.max, true);
      }
    });
    setValue(input.valueAsNumber, false);
  }

  function initCounters(scope) {
    Array.prototype.forEach.call((scope || document).querySelectorAll('[data-counter]'), initCounter);
  }

  initCounters();
  window.ChintAppShell = window.ChintAppShell || {};
  window.ChintAppShell.initCounters = initCounters;
}());

(function () {
  function initTextareaCounter(root) {
    if (root.dataset.textareaCounterInitialized === 'true') return;
    var textarea = root.querySelector('.textarea[maxlength]');
    var output = root.querySelector('.textarea__count');
    if (!textarea || !output || textarea.maxLength < 0) return;

    function updateCount() {
      output.textContent = textarea.value.length + ' / ' + textarea.maxLength;
    }

    textarea.addEventListener('input', updateCount);
    if (textarea.form) {
      textarea.form.addEventListener('reset', function () {
        window.setTimeout(updateCount, 0);
      });
    }
    root.dataset.textareaCounterInitialized = 'true';
    updateCount();
  }

  function initTextareaCounters(scope) {
    var container = scope || document;
    if (container.matches && container.matches('[data-textarea-count]')) initTextareaCounter(container);
    Array.prototype.forEach.call(container.querySelectorAll('[data-textarea-count]'), initTextareaCounter);
  }

  initTextareaCounters();
  window.ChintAppShell = window.ChintAppShell || {};
  window.ChintAppShell.initTextareaCounters = initTextareaCounters;
}());

(function () {
  var cascaders = [];

  function initializeCascader(root) {
    if (root.dataset.cascaderInitialized === 'true') return;
    var trigger = root.querySelector('.cascader__trigger');
    var text = root.querySelector('.cascader__text');
    var values = root.querySelector('.cascader__values');
    var valueInput = root.querySelector('.cascader__value');
    var panel = root.querySelector('.cascader__panel');
    var columns = panel ? Array.prototype.slice.call(panel.querySelectorAll('.cascader__col')) : [];
    var isMultiple = root.hasAttribute('data-cascader-multiple');
    var summary = root.querySelector('.cascader__summary');
    var confirmButton = root.querySelector('[data-cascader-action="confirm"]');
    var cancelButton = root.querySelector('[data-cascader-action="cancel"]');
    var selectionSnapshot = [];
    if (!trigger || !panel || !columns.length || (!text && !values)) return;

    root.dataset.cascaderInitialized = 'true';
    cascaders.push(root);

    function optionsIn(column) {
      return Array.prototype.slice.call(column.querySelectorAll('.cascader__option:not(.is-disabled):not([hidden])'));
    }

    function selectedIn(column) {
      return column.querySelector('.cascader__option.is-active') || optionsIn(column)[0];
    }

    function labelOf(option) {
      var label = option.querySelector('.cascader__label');
      return (label || option).textContent.trim();
    }

    function setOpen(open, restoreFocus) {
      root.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
      if (!open && restoreFocus) trigger.focus();
    }

    function setActive(option, column) {
      optionsIn(column).forEach(function (item) {
        var selected = item === option;
        item.classList.toggle('is-active', selected);
        if (!isMultiple) item.setAttribute('aria-selected', String(selected));
      });
    }

    function updateChildren(columnIndex) {
      for (var index = columnIndex + 1; index < columns.length; index++) {
        var parent = columns[index - 1].querySelector('.cascader__option.is-active:not([hidden])');
        var parentId = parent && parent.dataset.cascaderId;
        var children = Array.prototype.slice.call(columns[index].querySelectorAll('.cascader__option'));
        var hasLinkedOptions = children.some(function (option) { return option.hasAttribute('data-cascader-parent'); });
        if (!hasLinkedOptions) break;
        columns[index].hidden = !parentId;
        children.forEach(function (option) {
          option.hidden = !parentId || option.dataset.cascaderParent !== parentId;
          if (option.hidden) {
            option.classList.remove('is-active');
            if (!isMultiple) option.setAttribute('aria-selected', 'false');
          }
        });
      }
    }

    function selectedOptions() {
      return Array.prototype.slice.call(panel.querySelectorAll('.cascader__option.is-selected'));
    }

    function selectionValues() {
      return selectedOptions().map(function (option) { return option.dataset.cascaderValue || labelOf(option); });
    }

    function selectionPaths() {
      return selectedOptions().map(function (option) { return option.dataset.cascaderPath || labelOf(option); });
    }

    function renderMultipleSelection() {
      if (!values) return;
      var paths = selectionPaths();
      while (values.firstChild) values.removeChild(values.firstChild);
      if (!paths.length) {
        var placeholder = document.createElement('span');
        placeholder.className = 'cascader__text cascader__placeholder';
        placeholder.textContent = root.dataset.placeholder || '请选择';
        values.appendChild(placeholder);
      } else {
        paths.slice(0, 2).forEach(function (path) {
          var tag = document.createElement('span');
          tag.className = 'tag tag--primary cascader__tag';
          tag.textContent = path;
          values.appendChild(tag);
        });
        if (paths.length > 2) {
          var more = document.createElement('span');
          more.className = 'cascader__more';
          more.textContent = '+' + (paths.length - 2);
          values.appendChild(more);
        }
      }
      if (summary) summary.textContent = '已选 ' + paths.length + ' 项';
    }

    function captureSelection() {
      return selectionValues();
    }

    function restoreSelection(selection) {
      Array.prototype.forEach.call(panel.querySelectorAll('.cascader__option'), function (option) {
        var selected = selection.indexOf(option.dataset.cascaderValue || labelOf(option)) >= 0;
        option.classList.toggle('is-selected', selected);
        option.setAttribute('aria-selected', String(selected));
      });
      renderMultipleSelection();
    }

    function toggleMultipleOption(option) {
      var selected = !option.classList.contains('is-selected');
      option.classList.toggle('is-selected', selected);
      option.setAttribute('aria-selected', String(selected));
      renderMultipleSelection();
    }

    function commit(columnIndex) {
      var selectedOption = selectedIn(columns[columnIndex]);
      var labels = columns.slice(0, columnIndex + 1).map(function (column) { return labelOf(selectedIn(column)); });
      var value = labels.join(' / ');
      var rawValue = selectedOption && selectedOption.hasAttribute('data-cascader-value') ? selectedOption.dataset.cascaderValue : labels.join('/');
      text.textContent = value;
      text.classList.remove('cascader__placeholder');
      if (valueInput) {
        valueInput.value = rawValue;
        valueInput.dispatchEvent(new Event('input', { bubbles: true }));
        valueInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      root.dispatchEvent(new CustomEvent('cascader-change', { bubbles: true, detail: { value: value, rawValue: rawValue, labels: labels } }));
    }

    function commitMultiple() {
      var values = selectionValues();
      var paths = selectionPaths();
      if (valueInput) {
        valueInput.value = values.join(',');
        valueInput.dispatchEvent(new Event('input', { bubbles: true }));
        valueInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
      root.dispatchEvent(new CustomEvent('cascader-change', { bubbles: true, detail: { value: values, labels: paths } }));
    }

    function closeMultiple(restoreFocus, discardPending) {
      if (discardPending) restoreSelection(selectionSnapshot);
      setOpen(false, restoreFocus);
    }

    function selectOption(option, columnIndex, focusNext) {
      if (option.classList.contains('is-disabled')) return;
      var column = columns[columnIndex];
      setActive(option, column);
      if (option.dataset.cascaderBranch === 'true') {
        updateChildren(columnIndex);
        var nextColumn = columns[columnIndex + 1];
        if (nextColumn && !nextColumn.hidden && focusNext && optionsIn(nextColumn).length) selectedIn(nextColumn).focus();
        return;
      }
      if (isMultiple) {
        toggleMultipleOption(option);
        return;
      }
      commit(columnIndex);
      setOpen(false, false);
    }

    function moveWithinColumn(columnIndex, current, direction) {
      var options = optionsIn(columns[columnIndex]);
      var next = options[(options.indexOf(current) + direction + options.length) % options.length];
      next.focus();
    }

    trigger.addEventListener('click', function () {
      if (isMultiple) {
        if (root.classList.contains('is-open')) closeMultiple(false, true);
        else {
          selectionSnapshot = captureSelection();
          setOpen(true, false);
        }
        return;
      }
      setOpen(!root.classList.contains('is-open'), false);
    });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (isMultiple && !root.classList.contains('is-open')) selectionSnapshot = captureSelection();
        setOpen(true, false);
        selectedIn(columns[0]).focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (isMultiple && root.classList.contains('is-open')) closeMultiple(false, true);
        else {
          if (isMultiple) selectionSnapshot = captureSelection();
          setOpen(!root.classList.contains('is-open'), false);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        if (isMultiple) closeMultiple(false, true);
        else setOpen(false, false);
      }
    });

    updateChildren(0);
    columns.forEach(function (column, columnIndex) {
      Array.prototype.forEach.call(column.querySelectorAll('.cascader__option'), function (option) {
        option.addEventListener('click', function (event) {
          if (isMultiple && event.target.closest('.cascader__checkbox')) {
            toggleMultipleOption(option);
            return;
          }
          selectOption(option, columnIndex, false);
        });
        option.addEventListener('mouseenter', function () {
          if (option.dataset.cascaderBranch === 'true') selectOption(option, columnIndex, false);
        });
        option.addEventListener('keydown', function (event) {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            moveWithinColumn(columnIndex, option, event.key === 'ArrowDown' ? 1 : -1);
          } else if (event.key === 'ArrowRight' && columns[columnIndex + 1]) {
            event.preventDefault();
            selectOption(option, columnIndex, true);
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            if (columns[columnIndex - 1]) selectedIn(columns[columnIndex - 1]).focus();
            else trigger.focus();
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            var options = optionsIn(column);
            options[event.key === 'Home' ? 0 : options.length - 1].focus();
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (isMultiple && event.key === ' ' && option.dataset.cascaderBranch === 'true') toggleMultipleOption(option);
            else selectOption(option, columnIndex, true);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            if (isMultiple) closeMultiple(true, true);
            else setOpen(false, true);
          }
        });
      });
    });

    if (isMultiple) {
      renderMultipleSelection();
      selectionSnapshot = captureSelection();
      if (confirmButton) confirmButton.addEventListener('click', function () {
        commitMultiple();
        selectionSnapshot = captureSelection();
        closeMultiple(false, false);
      });
      if (cancelButton) cancelButton.addEventListener('click', function () { closeMultiple(true, true); });
    }
    root._closeCascader = function (restoreFocus, discardPending) {
      if (isMultiple) closeMultiple(restoreFocus, discardPending);
      else setOpen(false, restoreFocus);
    };
  }

  function initCascaders(scope) {
    var container = scope || document;
    if (container.matches && container.matches('[data-cascader]')) initializeCascader(container);
    Array.prototype.forEach.call(container.querySelectorAll('[data-cascader]'), initializeCascader);
  }

  initCascaders();
  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-cascader]')) return;
    cascaders.forEach(function (root) {
      if (!root.classList.contains('is-open')) return;
      root._closeCascader(false, true);
    });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    cascaders.forEach(function (root) {
      if (!root.classList.contains('is-open')) return;
      root._closeCascader(true, true);
    });
  });
  window.ChintAppShell = window.ChintAppShell || {};
  window.ChintAppShell.initCascaders = initCascaders;
}());

(function () {
  var datepickers = [];

  function ensureDatepickerIcon(trigger) {
    if (!trigger || trigger.querySelector('.datepicker__icon')) return;
    var fontIcon = document.createElement('i');
    fontIcon.className = 'icon datepicker__icon ri-calendar-line';
    fontIcon.setAttribute('aria-hidden', 'true');
    trigger.appendChild(fontIcon);
  }

  function initializeDatepicker(root) {
    if (!root) return;
    var trigger = root.querySelector('.datepicker__trigger');
    ensureDatepickerIcon(trigger);
    if (root.dataset.datepickerInitialized === 'true') return;
    var panel = root.querySelector('.datepicker__panel');
    var title = root.querySelector('.datepicker__title');
    var grid = root.querySelector('.datepicker__grid');
    var inputs = Array.prototype.slice.call(root.querySelectorAll('.datepicker__trigger .input'));
    var cells = Array.prototype.slice.call(root.querySelectorAll('.datepicker__cell'));
    var type = root.dataset.datepickerType || 'date';
    var isRange = type === 'daterange' || type === 'datetimerange';
    var hasTime = type === 'datetime' || type === 'datetimerange';
    var month = Number(root.dataset.datepickerMonth || 9) - 1;
    var year = Number(root.dataset.datepickerYear || 2026);
    var start = '';
    var end = '';
    var activeEndpoint = 'start';
    var snapshot;
    if (!trigger || !panel || !title || !grid || !inputs.length || !cells.length) return;

    root.dataset.datepickerInitialized = 'true';
    datepickers.push(root);

    function createNavigationButton(action, label) {
      var button = document.createElement('button');
      var fontIcon = document.createElement('i');
      button.className = 'btn btn--icon btn--text datepicker__nav datepicker__nav--year';
      button.type = 'button';
      button.dataset.datepickerAction = action;
      button.setAttribute('aria-label', label);
      fontIcon.className = 'icon ' + (action === 'prev-year' ? 'ri-arrow-left-double-line' : 'ri-arrow-right-double-line');
      fontIcon.setAttribute('aria-hidden', 'true');
      button.appendChild(fontIcon);
      return button;
    }

    function ensureYearNavigation() {
      var groups = Array.prototype.slice.call(root.querySelectorAll('.datepicker__header .datepicker__nav-group'));
      if (groups.length < 2) return;
      if (!root.querySelector('[data-datepicker-action="prev-year"]')) {
        groups[0].insertBefore(createNavigationButton('prev-year', '上一年'), groups[0].firstChild);
      }
      if (!root.querySelector('[data-datepicker-action="next-year"]')) {
        groups[groups.length - 1].appendChild(createNavigationButton('next-year', '下一年'));
      }
    }

    ensureYearNavigation();

    function dateLabel() {
      return year + ' 年 ' + String(month + 1).padStart(2, '0') + ' 月';
    }

    function dateFromCell(cell) {
      return cell.dataset.date || year + '-' + String(month + 1).padStart(2, '0') + '-' + cell.textContent.trim().padStart(2, '0');
    }

    function dateKey(date) {
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    }

    function normalizeTime(value, endpoint) {
      return value || root.dataset[endpoint === 'end' ? 'datepickerDefaultTimeEnd' : 'datepickerDefaultTimeStart'] || '00:00';
    }

    function timeInput(endpoint) {
      return root.querySelector('[data-datepicker-time="' + endpoint + '"]');
    }

    function formattedValue(date, endpoint) {
      if (!date) return '';
      if (!hasTime) return date;
      return date + ' ' + normalizeTime(timeInput(endpoint) ? timeInput(endpoint).value : '', endpoint) + ':00';
    }

    function dispatch(name, detail) {
      root.dispatchEvent(new CustomEvent(name, { bubbles: true, detail: detail }));
    }

    function syncSelection() {
      cells.forEach(function (cell) {
        var value = dateFromCell(cell);
        var selected = value === start || value === end;
        var inRange = Boolean(start && end && value > start && value < end);
        cell.classList.toggle('is-selected', selected);
        cell.classList.toggle('is-in-range', inRange);
        cell.setAttribute('aria-selected', String(selected));
      });
      var hint = root.querySelector('[data-datepicker-selection-hint]');
      if (!hint) return;
      if (isRange && start && !end) hint.textContent = '请选择结束日期';
      else if (hasTime && (isRange ? start && end : start)) hint.textContent = '请选择时间后确认';
      else hint.textContent = '';
    }

    function renderMonth() {
      var label = dateLabel();
      var firstDay = new Date(year, month, 1);
      var calendarStart = new Date(year, month, 1 - firstDay.getDay());
      var today = dateKey(new Date());
      var fragment = document.createDocumentFragment();
      cells = [];
      for (var index = 0; index < 42; index += 1) {
        var date = new Date(calendarStart);
        date.setDate(calendarStart.getDate() + index);
        var cell = document.createElement('button');
        var value = dateKey(date);
        cell.className = 'btn btn--text datepicker__cell';
        if (date.getMonth() !== month) cell.classList.add('is-other-month');
        if (value === today) cell.classList.add('is-today');
        cell.type = 'button';
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-selected', 'false');
        cell.dataset.date = value;
        cell.textContent = String(date.getDate());
        bindCell(cell);
        cells.push(cell);
        fragment.appendChild(cell);
      }
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      grid.appendChild(fragment);
      title.textContent = label;
      grid.setAttribute('aria-label', label);
      syncSelection();
    }

    function capture() {
      snapshot = {
        start: start,
        end: end,
        inputs: inputs.map(function (input) { return input.value; }),
        times: Array.prototype.slice.call(root.querySelectorAll('.datepicker__time-input')).map(function (input) { return input.value; })
      };
    }

    function restore() {
      if (!snapshot) return;
      start = snapshot.start;
      end = snapshot.end;
      inputs.forEach(function (input, index) { input.value = snapshot.inputs[index] || ''; });
      Array.prototype.slice.call(root.querySelectorAll('.datepicker__time-input')).forEach(function (input, index) { input.value = snapshot.times[index] || ''; });
      syncSelection();
    }

    function positionPanel() {
      var rootStyles = getComputedStyle(document.documentElement);
      var margin = parseFloat(rootStyles.getPropertyValue('--space-md')) || 16;
      var gap = parseFloat(rootStyles.getPropertyValue('--space-xxs')) || 4;
      var viewportWidth = document.documentElement.clientWidth;
      var viewportHeight = document.documentElement.clientHeight;
      var triggerRect = trigger.getBoundingClientRect();
      panel.classList.add('is-viewport-positioned');
      panel.style.setProperty('--datepicker-panel-left', '0px');
      panel.style.setProperty('--datepicker-panel-top', '0px');
      var panelRect = panel.getBoundingClientRect();
      var left = Math.max(margin, Math.min(triggerRect.left, viewportWidth - margin - panelRect.width));
      var top = triggerRect.bottom + gap;
      if (top + panelRect.height > viewportHeight - margin) top = triggerRect.top - gap - panelRect.height;
      top = Math.max(margin, Math.min(top, viewportHeight - margin - panelRect.height));
      panel.style.setProperty('--datepicker-panel-left', Math.round(left) + 'px');
      panel.style.setProperty('--datepicker-panel-top', Math.round(top) + 'px');
    }

    function setOpen(open, restoreFocus) {
      if (open) {
        datepickers.forEach(function (other) {
          if (other !== root && other.classList.contains('is-open')) other._closeDatepicker(false, true);
        });
      }
      root.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
      if (open) positionPanel();
      else {
        panel.classList.remove('is-viewport-positioned');
        panel.style.removeProperty('--datepicker-panel-left');
        panel.style.removeProperty('--datepicker-panel-top');
      }
      dispatch('datepicker-visible-change', { visible: open, type: type });
      if (!open && restoreFocus) trigger.focus();
    }

    window.addEventListener('resize', function () {
      if (root.classList.contains('is-open')) positionPanel();
    });
    window.addEventListener('scroll', function () {
      if (root.classList.contains('is-open')) positionPanel();
    }, true);

    function emitInputEvents() {
      inputs.forEach(function (input) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    }

    function commit() {
      if (!start || (isRange && !end)) {
        syncSelection();
        return false;
      }
      var startValue = formattedValue(start, 'start');
      var endValue = isRange ? formattedValue(end, 'end') : '';
      inputs[0].value = startValue;
      if (isRange && inputs[1]) inputs[1].value = endValue;
      emitInputEvents();
      dispatch('datepicker-change', { type: type, value: isRange ? [startValue, endValue] : startValue });
      setOpen(false, false);
      return true;
    }

    function selectDate(value) {
      if (isRange) {
        if (!start || end || activeEndpoint === 'start') {
          start = value;
          end = '';
          activeEndpoint = 'end';
        } else {
          end = value;
          if (end < start) {
            var previousStart = start;
            start = end;
            end = previousStart;
          }
        }
        dispatch('datepicker-calendar-change', { type: type, value: end ? [start, end] : [start] });
      } else {
        start = value;
      }
      syncSelection();
      if (!hasTime && (!isRange || end)) commit();
    }

    function adjustPanel(action) {
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
      dispatch('datepicker-panel-change', { type: type, year: year, month: month + 1 });
    }

    trigger.addEventListener('click', function (event) {
      var targetInput = event.target.closest('.datepicker__range-input');
      if (targetInput) {
        activeEndpoint = targetInput.dataset.datepickerEndpoint || 'start';
        if (!root.classList.contains('is-open')) {
          capture();
          setOpen(true, false);
        }
        return;
      }
      if (root.classList.contains('is-open')) setOpen(false, false);
      else {
        capture();
        setOpen(true, false);
      }
    });
    trigger.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'ArrowDown' && event.key !== 'Escape') return;
      event.preventDefault();
      if (event.key === 'Escape') {
        restore();
        setOpen(false, true);
      } else if (!root.classList.contains('is-open')) {
        capture();
        setOpen(true, false);
      }
    });
    root.querySelectorAll('[data-datepicker-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        var action = button.dataset.datepickerAction;
        if (action === 'confirm') commit();
        else if (action === 'cancel') {
          restore();
          setOpen(false, true);
        } else if (action === 'now') {
          var now = new Date();
          start = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
          var startTime = timeInput('start');
          if (startTime) startTime.value = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
          if (!isRange) syncSelection();
        } else adjustPanel(action);
      });
    });
    function bindCell(cell) {
      cell.tabIndex = 0;
      cell.addEventListener('click', function () { selectDate(dateFromCell(cell)); });
      cell.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectDate(dateFromCell(cell));
        }
      });
    }
    root.querySelectorAll('.datepicker__time-input').forEach(function (input) {
      input.addEventListener('change', syncSelection);
    });
    root.querySelectorAll('.datepicker__shortcut').forEach(function (button) {
      button.addEventListener('click', function () {
        if (button.dataset.dateValue) {
          inputs[0].value = button.dataset.dateValue;
          emitInputEvents();
          dispatch('datepicker-change', { type: type, value: button.dataset.dateValue });
          setOpen(false, false);
        }
      });
    });
    root._closeDatepicker = function (restoreFocus, shouldCommit) {
      if (shouldCommit && start && (!isRange || end)) commit();
      else setOpen(false, restoreFocus);
    };
    renderMonth();
  }

  function initDatepickers(scope) {
    Array.prototype.forEach.call((scope || document).querySelectorAll('[data-datepicker]'), initializeDatepicker);
  }

  initDatepickers();
  document.addEventListener('click', function (event) {
    if (event.target.closest('[data-datepicker]')) return;
    datepickers.forEach(function (root) {
      if (root.classList.contains('is-open')) root._closeDatepicker(false, true);
    });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    datepickers.forEach(function (root) {
      if (!root.classList.contains('is-open')) return;
      root._closeDatepicker(true, false);
    });
  });
  window.ChintAppShell = window.ChintAppShell || {};
  window.ChintAppShell.initDatepickers = initDatepickers;
}());

(function () {
  var nextOptionId = 0;

  function initializeSelect(root) {
    if (root.dataset.selectInitialized === 'true') return;
    var trigger = root.querySelector('.select__trigger');
    var panel = root.querySelector('.select__panel');
    var options = panel && Array.prototype.slice.call(panel.querySelectorAll('.select__option'));
    if (!trigger || !panel || !options.length) return;
    root.dataset.selectInitialized = 'true';
    var multiple = root.hasAttribute('data-multiple');
    var clear = root.querySelector('.select__clear');
    var values = root.querySelector('.select__values') || root.querySelector('.select__text');
    var input = root.querySelector('.select__value');
    var placeholder = values && values.textContent.trim();
    var active = -1;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    panel.setAttribute('aria-multiselectable', String(multiple));
    options.forEach(function (option) {
      if (!option.id) option.id = 'select-option-' + (++nextOptionId);
      option.setAttribute('aria-selected', String(option.classList.contains('is-selected')));
    });

    function selectedOptions() {
      return options.filter(function (option) { return option.getAttribute('aria-selected') === 'true'; });
    }

    function syncValue(emit) {
      var selected = selectedOptions();
      var value = selected.map(function (option) { return option.dataset.value || option.textContent.trim(); }).join(',');
      root.dataset.selectValue = value;
      root.classList.toggle('has-value', selected.length > 0);
      if (values) {
        if (multiple) {
          while (values.firstChild) values.removeChild(values.firstChild);
          if (!selected.length) {
            var empty = document.createElement('span');
            empty.className = 'select__text select__placeholder';
            empty.textContent = placeholder;
            values.appendChild(empty);
          }
          selected.forEach(function (option) {
            var tag = document.createElement('span');
            tag.className = 'tag tag--info select__tag';
            tag.textContent = option.querySelector('span') ? option.querySelector('span').textContent.trim() : option.textContent.trim();
            values.appendChild(tag);
          });
        } else {
          values.textContent = selected.length ? selected[0].textContent.trim() : placeholder;
          values.classList.toggle('select__placeholder', !selected.length);
        }
      }
      if (input) {
        input.value = value;
        if (emit) {
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      if (emit) root.dispatchEvent(new CustomEvent('select-change', { bubbles: true, detail: { value: multiple ? value.split(',').filter(Boolean) : value } }));
    }

    function setActive(index) {
      if (index < 0 || index >= options.length) return;
      active = index;
      trigger.setAttribute('aria-activedescendant', options[active].id);
      options[active].scrollIntoView({ block: 'nearest' });
    }

    function setOpen(open, restoreFocus) {
      root.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
      if (open) setActive(Math.max(0, options.indexOf(selectedOptions()[0])));
      else {
        trigger.removeAttribute('aria-activedescendant');
        if (restoreFocus) trigger.focus();
      }
    }

    function choose(option) {
      var selected = !multiple || option.getAttribute('aria-selected') !== 'true';
      options.forEach(function (candidate) {
        var on = candidate === option ? selected : multiple && candidate.getAttribute('aria-selected') === 'true';
        candidate.classList.toggle('is-selected', on);
        candidate.setAttribute('aria-selected', String(on));
      });
      syncValue(true);
      if (!multiple) setOpen(false, true);
      else setActive(options.indexOf(option));
    }

    trigger.addEventListener('click', function (event) {
      if (clear && clear.contains(event.target)) {
        options.forEach(function (option) { option.classList.remove('is-selected'); option.setAttribute('aria-selected', 'false'); });
        syncValue(true);
        setOpen(false, true);
      } else setOpen(!root.classList.contains('is-open'));
    });
    trigger.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && root.classList.contains('is-open')) { event.preventDefault(); setOpen(false, true); return; }
      if ((event.key === 'Backspace' || event.key === 'Delete') && !root.classList.contains('is-open')) {
        if (clear && root.classList.contains('has-value')) { event.preventDefault(); clear.click(); }
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
      if ((event.key === 'Enter' || event.key === ' ') && root.classList.contains('is-open')) {
        event.preventDefault(); choose(options[active]); return;
      }
      if (event.key === 'Enter' || event.key === ' ') return;
      event.preventDefault();
      if (!root.classList.contains('is-open')) setOpen(true);
      else setActive(event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length);
    });
    options.forEach(function (option) {
      option.addEventListener('click', function () { choose(option); });
      option.addEventListener('mousemove', function () { active = options.indexOf(option); });
    });
    document.addEventListener('click', function (event) { if (!root.contains(event.target)) setOpen(false); });
    syncValue(false);
  }

  function initSelects(scope) {
    var container = scope || document;
    if (container.matches && container.matches('[data-select]')) initializeSelect(container);
    Array.prototype.forEach.call(container.querySelectorAll('[data-select]'), initializeSelect);
  }

  initSelects();
  window.ChintAppShell = window.ChintAppShell || {};
  window.ChintAppShell.initSelects = initSelects;
}());

(function () {
  function initializeUpload(root) {
    if (root.dataset.uploadInitialized === 'true') return;
    var drop = root.querySelector('.upload__drop');
    var list = root.querySelector('.upload__list');
    if (!drop || !list) return;
    root.dataset.uploadInitialized = 'true';
    var input = root.querySelector('input[type="file"]');
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.hidden = true;
      input.multiple = true;
      drop.appendChild(input);
    }
    var preview = document.createElement('dialog');
    preview.className = 'upload__preview';
    var image = document.createElement('img');
    image.alt = '';
    var closePreview = document.createElement('button');
    closePreview.type = 'button';
    closePreview.className = 'btn btn--neutral';
    closePreview.textContent = '关闭预览';
    preview.appendChild(image);
    preview.appendChild(closePreview);
    root.appendChild(preview);
    closePreview.addEventListener('click', function () { preview.close(); });
    preview.addEventListener('close', function () { image.removeAttribute('src'); });

    function addFile(file) {
      var item = document.createElement('div');
      item.className = 'upload__item';
      var name = document.createElement('span');
      name.className = 'upload__name';
      name.textContent = file.name;
      var status = document.createElement('span');
      status.className = 'upload__size';
      var bar = document.createElement('span');
      bar.className = 'upload__bar';
      var retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn btn--link upload__retry';
      retry.textContent = '重试';
      retry.hidden = true;
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn--link upload__remove';
      remove.textContent = '移除';
      remove.setAttribute('aria-label', '移除 ' + file.name);
      item.appendChild(name);
      item.appendChild(status);
      item.appendChild(retry);
      item.appendChild(remove);
      item.appendChild(bar);
      var imageUrl = file.type.indexOf('image/') === 0 ? URL.createObjectURL(file) : null;
      if (imageUrl) {
        var view = document.createElement('button');
        view.type = 'button';
        view.className = 'btn btn--link upload__view';
        view.textContent = '预览';
        view.setAttribute('aria-label', '预览 ' + file.name);
        item.insertBefore(view, retry);
        view.addEventListener('click', function () {
          image.src = imageUrl;
          image.alt = file.name;
          preview.showModal();
        });
      }
      list.appendChild(item);
      var request = null;

      function upload() {
        retry.hidden = true;
        item.classList.remove('is-success', 'is-error');
        bar.style.width = '0%';
        var url = root.getAttribute('data-upload-url');
        if (!url) {
          status.textContent = '未配置上传地址';
          item.classList.add('is-error');
          retry.hidden = false;
          return;
        }
        request = new XMLHttpRequest();
        var current = request;
        status.textContent = '上传中 0%';
        current.open('POST', url);
        current.upload.addEventListener('progress', function (event) {
          if (!event.lengthComputable || current !== request) return;
          var percent = Math.min(100, Math.round(event.loaded / event.total * 100));
          bar.style.width = percent + '%';
          status.textContent = '上传中 ' + percent + '%';
        });
        current.addEventListener('loadend', function () {
          if (current !== request) return;
          request = null;
          if (current.status >= 200 && current.status < 300) {
            item.classList.add('is-success');
            status.textContent = '上传完成';
            bar.style.width = '100%';
            root.dispatchEvent(new CustomEvent('upload-success', { bubbles: true, detail: { file: file, response: current.responseText } }));
          } else {
            item.classList.add('is-error');
            status.textContent = '上传失败';
            retry.hidden = false;
            root.dispatchEvent(new CustomEvent('upload-error', { bubbles: true, detail: { file: file, status: current.status } }));
          }
        });
        var body = new FormData();
        body.append(root.getAttribute('data-upload-field') || 'file', file);
        current.send(body);
      }

      retry.addEventListener('click', upload);
      remove.addEventListener('click', function () {
        if (request) { var pending = request; request = null; pending.abort(); }
        if (imageUrl && preview.open && image.src === imageUrl) preview.close();
        if (imageUrl) URL.revokeObjectURL(imageUrl);
        item.remove();
        root.dispatchEvent(new CustomEvent('upload-remove', { bubbles: true, detail: { file: file } }));
      });
      upload();
    }

    function addFiles(files) { Array.prototype.forEach.call(files, addFile); }
    drop.addEventListener('click', function () { input.click(); });
    drop.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); }
    });
    input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
    drop.addEventListener('dragover', function (event) { event.preventDefault(); drop.classList.add('is-dragover'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('is-dragover'); });
    drop.addEventListener('drop', function (event) {
      event.preventDefault();
      drop.classList.remove('is-dragover');
      addFiles(event.dataTransfer.files);
    });
  }

  function initUploads(scope) {
    var container = scope || document;
    if (container.matches && container.matches('[data-upload]')) initializeUpload(container);
    Array.prototype.forEach.call(container.querySelectorAll('[data-upload]'), initializeUpload);
  }

  initUploads();
  window.ChintAppShell.initUploads = initUploads;
}());

(function () {
  function initializeTree(root) {
    if (root.dataset.treeInitialized === 'true') return;
    var nodes = Array.prototype.slice.call(root.querySelectorAll('.tree__node'));
    if (!nodes.length) return;
    root.dataset.treeInitialized = 'true';
    root.setAttribute('role', 'tree');
    var checkable = root.hasAttribute('data-tree-checkable');
    var sortable = root.hasAttribute('data-tree-sortable');
    var current = nodes.filter(function (node) { return node.classList.contains('is-selected'); })[0] || nodes[0];
    var dragging = null;

    function childrenOf(node) {
      var sibling = node.nextElementSibling;
      return sibling && sibling.classList.contains('tree__children') ? sibling : null;
    }

    function parentOf(node) {
      var group = node.parentElement;
      return group.classList.contains('tree__children') ? group.previousElementSibling : null;
    }

    function visibleNodes() {
      return nodes.filter(function (node) {
        for (var group = node.parentElement; group !== root; group = group.parentElement) {
          if (group.classList.contains('is-collapsed') || group.hidden) return false;
        }
        return !node.classList.contains('is-disabled');
      });
    }

    function focusNode(node) {
      if (!node) return;
      current.tabIndex = -1;
      current = node;
      current.tabIndex = 0;
      current.focus();
    }

    function selectNode(node) {
      nodes.forEach(function (candidate) {
        var selected = candidate === node;
        candidate.classList.toggle('is-selected', selected);
        candidate.setAttribute('aria-selected', String(selected));
      });
      root.dispatchEvent(new CustomEvent('tree-select', { bubbles: true, detail: { node: node } }));
    }

    function toggleNode(node, open) {
      var children = childrenOf(node);
      if (!children) return;
      var expanded = open === undefined ? children.classList.contains('is-collapsed') : open;
      children.classList.toggle('is-collapsed', !expanded);
      node.setAttribute('aria-expanded', String(expanded));
      var arrow = node.querySelector('.tree__arrow');
      if (arrow) arrow.classList.toggle('is-open', expanded);
      if (!expanded && children.contains(current)) focusNode(node);
    }

    function checkboxOf(node) { return node.querySelector('.checkbox input[type="checkbox"]'); }

    function updateAncestors(node) {
      for (var parent = parentOf(node); parent; parent = parentOf(parent)) {
        var descendants = Array.prototype.slice.call(childrenOf(parent).querySelectorAll('.tree__node'));
        var inputs = descendants.map(checkboxOf).filter(Boolean);
        var checkbox = checkboxOf(parent);
        checkbox.checked = inputs.every(function (input) { return input.checked; });
        checkbox.indeterminate = !checkbox.checked && inputs.some(function (input) { return input.checked || input.indeterminate; });
        parent.setAttribute('aria-checked', checkbox.indeterminate ? 'mixed' : String(checkbox.checked));
      }
    }

    function setChecked(node, checked) {
      var descendants = childrenOf(node);
      [node].concat(descendants ? Array.prototype.slice.call(descendants.querySelectorAll('.tree__node')) : []).forEach(function (item) {
        var input = checkboxOf(item);
        if (!input || input.disabled) return;
        input.checked = checked;
        input.indeterminate = false;
        item.setAttribute('aria-checked', String(checked));
      });
      updateAncestors(node);
      root.dispatchEvent(new CustomEvent('tree-check', { bubbles: true, detail: { node: node, checked: checked } }));
    }

    function reorder(node, before) {
      var group = childrenOf(node);
      node.parentNode.insertBefore(node, before);
      if (group) node.parentNode.insertBefore(group, node.nextSibling);
      root.dispatchEvent(new CustomEvent('tree-reorder', { bubbles: true, detail: { node: node, before: before } }));
      focusNode(node);
    }

    nodes.forEach(function (node) {
      var group = childrenOf(node);
      var disabled = node.classList.contains('is-disabled');
      node.setAttribute('role', 'treeitem');
      node.setAttribute('aria-level', String((function () {
        var level = 1;
        for (var ancestor = node.parentElement; ancestor !== root; ancestor = ancestor.parentElement) if (ancestor.classList.contains('tree__children')) level++;
        return level;
      }())));
      node.setAttribute('aria-selected', String(node.classList.contains('is-selected')));
      if (disabled) node.setAttribute('aria-disabled', 'true');
      node.tabIndex = disabled ? -1 : node === current ? 0 : -1;
      if (group) {
        group.setAttribute('role', 'group');
        node.setAttribute('aria-expanded', String(!group.classList.contains('is-collapsed')));
      }
      if (checkable) {
        var checkbox = document.createElement('label');
        checkbox.className = 'checkbox tree__checkbox';
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.tabIndex = -1;
        input.disabled = disabled;
        input.setAttribute('aria-label', node.querySelector('.tree__label').textContent.trim());
        var box = document.createElement('span');
        box.className = 'checkbox__box';
        ['check', 'minus'].forEach(function (icon) {
          var fontIcon = document.createElement('i');
          fontIcon.className = icon === 'check' ? 'icon icon--check ri-check-line' : 'icon icon--minus ri-subtract-line';
          fontIcon.setAttribute('aria-hidden', 'true');
          box.appendChild(fontIcon);
        });
        checkbox.appendChild(input);
        checkbox.appendChild(box);
        node.insertBefore(checkbox, node.querySelector('.tree__label'));
        node.setAttribute('aria-checked', 'false');
        checkbox.addEventListener('click', function (event) { event.stopPropagation(); });
        input.addEventListener('change', function () { setChecked(node, input.checked); });
      }
      node.addEventListener('click', function (event) {
        if (disabled || event.target.closest('.tree__ops, .tree__checkbox')) return;
        focusNode(node);
        if (event.target.closest('.tree__arrow')) toggleNode(node);
        else selectNode(node);
      });
      node.addEventListener('dblclick', function () { if (!disabled) toggleNode(node); });
      if (sortable && !disabled) {
        node.draggable = true;
        node.addEventListener('dragstart', function (event) { dragging = node; node.classList.add('is-dragging'); event.dataTransfer.setData('text/plain', node.textContent.trim()); });
        node.addEventListener('dragend', function () { node.classList.remove('is-dragging'); dragging = null; });
        node.addEventListener('dragover', function (event) { if (dragging && dragging !== node && dragging.parentNode === node.parentNode) { event.preventDefault(); node.classList.add('is-drop-target'); } });
        node.addEventListener('dragleave', function () { node.classList.remove('is-drop-target'); });
        node.addEventListener('drop', function (event) {
          event.preventDefault();
          node.classList.remove('is-drop-target');
          if (!dragging || dragging === node || dragging.parentNode !== node.parentNode) return;
          reorder(dragging, node);
        });
      }
    });
    root.addEventListener('keydown', function (event) {
      var node = event.target.closest('.tree__node');
      if (!node || event.target.closest('.tree__ops')) return;
      var visible = visibleNodes();
      var index = visible.indexOf(node);
      var next = null;
      if (sortable && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        var siblings = nodes.filter(function (item) { return item.parentNode === node.parentNode; });
        var siblingIndex = siblings.indexOf(node) + (event.key === 'ArrowUp' ? -1 : 1);
        var sibling = siblings[siblingIndex];
        if (sibling) {
          var afterSibling = childrenOf(sibling) || sibling;
          reorder(node, event.key === 'ArrowUp' ? sibling : afterSibling.nextSibling);
        }
        event.preventDefault();
        return;
      }
      if (event.key === 'ArrowDown') next = visible[index + 1];
      else if (event.key === 'ArrowUp') next = visible[index - 1];
      else if (event.key === 'Home') next = visible[0];
      else if (event.key === 'End') next = visible[visible.length - 1];
      else if (event.key === 'ArrowRight') {
        var children = childrenOf(node);
        if (children && children.classList.contains('is-collapsed')) toggleNode(node, true);
        else if (children) next = visible[index + 1];
      } else if (event.key === 'ArrowLeft') {
        if (childrenOf(node) && node.getAttribute('aria-expanded') === 'true') toggleNode(node, false);
        else next = parentOf(node);
      } else if (event.key === 'Enter') selectNode(node);
      else if (event.key === ' ' && checkable) setChecked(node, !checkboxOf(node).checked);
      else if (event.key === 'Escape' && dragging) { dragging.classList.remove('is-dragging'); dragging = null; }
      else return;
      event.preventDefault();
      if (next) focusNode(next);
    });
  }

  function initTrees(scope) {
    var container = scope || document;
    if (container.matches && container.matches('.tree')) initializeTree(container);
    Array.prototype.forEach.call(container.querySelectorAll('.tree'), initializeTree);
  }
  initTrees();
  window.ChintAppShell.initTrees = initTrees;
}());

(function () {
  var nextCollapseId = 0;

  function initializeCollapse(root) {
    if (root.dataset.collapseInitialized === 'true') return;
    root.dataset.collapseInitialized = 'true';
    var accordion = root.classList.contains('collapse--accordion');
    var items = Array.prototype.slice.call(root.querySelectorAll('.collapse__item'));

    function setOpen(item, open, emit) {
      var header = item.querySelector('.collapse__header');
      var body = item.querySelector('.collapse__body');
      if (!header || !body) return;
      item.classList.toggle('is-open', open);
      header.setAttribute('aria-expanded', String(open));
      body.setAttribute('aria-hidden', String(!open));
      if ('inert' in body) body.inert = !open;
      var arrow = header.querySelector('.collapse__arrow');
      if (arrow) arrow.classList.toggle('is-open', open);
      if (emit) root.dispatchEvent(new CustomEvent('collapse-change', { bubbles: true, detail: { item: item, open: open } }));
    }

    items.forEach(function (item) {
      var header = item.querySelector('.collapse__header');
      var body = item.querySelector('.collapse__body');
      if (!header || !body) return;
      var disabled = item.classList.contains('is-disabled');
      if (!header.id) header.id = 'collapse-header-' + (++nextCollapseId);
      if (!body.id) body.id = 'collapse-body-' + (++nextCollapseId);
      header.setAttribute('role', 'button');
      header.tabIndex = disabled ? -1 : 0;
      header.setAttribute('aria-controls', body.id);
      if (disabled) header.setAttribute('aria-disabled', 'true');
      body.setAttribute('role', 'region');
      body.setAttribute('aria-labelledby', header.id);
      setOpen(item, item.classList.contains('is-open'), false);
      function toggle() {
        if (disabled) return;
        var open = !item.classList.contains('is-open');
        if (accordion && open) items.forEach(function (other) { if (other !== item) setOpen(other, false, false); });
        setOpen(item, open, true);
      }
      header.addEventListener('click', toggle);
      header.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(); }
      });
    });
  }

  function initCollapses(scope) {
    var container = scope || document;
    if (container.matches && container.matches('.collapse')) initializeCollapse(container);
    Array.prototype.forEach.call(container.querySelectorAll('.collapse'), initializeCollapse);
  }
  initCollapses();
  window.ChintAppShell.initCollapses = initCollapses;
}());