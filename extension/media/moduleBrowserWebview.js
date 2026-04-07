(function () {
    const vscode = acquireVsCodeApi();

    function parsePayload(raw) {
        if (!raw) {
            return {};
        }

        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }

    function normalizeDefaults(value) {
        const raw = value && typeof value === 'object' ? value : {};
        return {
            defaultView: raw.defaultView === 'flat' ? 'flat' : 'hierarchy',
            defaultSort: raw.defaultSort === 'kind' || raw.defaultSort === 'package' ? raw.defaultSort : 'name',
            defaultDensity: raw.defaultDensity === 'compact' ? 'compact' : 'comfortable',
            showPrivateSymbols: Boolean(raw.showPrivateSymbols),
            showHierarchyHints: raw.showHierarchyHints !== false,
            autoLoadPreviews: Boolean(raw.autoLoadPreviews),
            previewBatchSize: typeof raw.previewBatchSize === 'number' && raw.previewBatchSize > 0 ? raw.previewBatchSize : 24,
        };
    }

    function getEventElement(target) {
        if (target instanceof Element) {
            return target;
        }

        if (target && typeof target === 'object' && 'parentElement' in target && target.parentElement instanceof Element) {
            return target.parentElement;
        }

        return null;
    }

    const payload = parsePayload((document.getElementById('pyhover-module-browser-payload') || {}).textContent || '');
    const moduleName = typeof payload.moduleName === 'string' ? payload.moduleName : '';
    const symbols = Array.isArray(payload.symbols) ? payload.symbols : [];
    const defaults = normalizeDefaults(payload.settings);
    const previewCache = new Map();
    const requestedPreviews = new Set();
    const stateVersion = 3;
    const restored = vscode.getState() || {};
    const sameModule = restored.stateVersion === stateVersion && restored.moduleName === moduleName;

    let query = sameModule && typeof restored.query === 'string' ? restored.query : '';
    let activeKind = sameModule && typeof restored.activeKind === 'string' ? restored.activeKind : 'all';
    let currentPath = sameModule && Array.isArray(restored.currentPath) ? restored.currentPath : [];
    let selectedPackage = sameModule && typeof restored.selectedPackage === 'string' ? restored.selectedPackage : 'all';
    let selectedSymbolName = sameModule && typeof restored.selectedSymbolName === 'string' ? restored.selectedSymbolName : '';
    let viewMode = sameModule && typeof restored.viewMode === 'string' ? restored.viewMode : defaults.defaultView;
    let sortMode = sameModule && typeof restored.sortMode === 'string' ? restored.sortMode : defaults.defaultSort;
    let density = sameModule && typeof restored.density === 'string' ? restored.density : defaults.defaultDensity;
    let showPrivate = sameModule && typeof restored.showPrivate === 'boolean' ? restored.showPrivate : defaults.showPrivateSymbols;
    let showDocumentedOnly = sameModule && typeof restored.showDocumentedOnly === 'boolean' ? restored.showDocumentedOnly : false;
    let autoLoadPreviews = sameModule && typeof restored.autoLoadPreviews === 'boolean' ? restored.autoLoadPreviews : defaults.autoLoadPreviews;
    let showHierarchyHints = sameModule && typeof restored.showHierarchyHints === 'boolean' ? restored.showHierarchyHints : defaults.showHierarchyHints;
    let sidebarScrollTop = sameModule && typeof restored.sidebarScrollTop === 'number' ? restored.sidebarScrollTop : 0;
    let resultsScrollTop = sameModule && typeof restored.resultsScrollTop === 'number' ? restored.resultsScrollTop : 0;
    let focusedControlId = sameModule && typeof restored.focusedControlId === 'string' ? restored.focusedControlId : 'query';
    let previewRequestId = 0;

    const queryInput = document.getElementById('query');
    const packageFilter = document.getElementById('package-filter');
    const sortFilter = document.getElementById('sort-filter');
    const viewFilter = document.getElementById('view-filter');
    const togglePrivate = document.getElementById('toggle-private');
    const toggleDocumented = document.getElementById('toggle-documented');
    const toggleAuto = document.getElementById('toggle-auto');
    const toggleHints = document.getElementById('toggle-hints');
    const sidebarEl = document.getElementById('sidebar');
    const moduleActionsBlockEl = document.getElementById('module-actions-block');
    const selectedSymbolBlockEl = document.getElementById('selected-symbol-block');
    const namespacesBlockEl = document.getElementById('namespaces-block');
    const sidebarMetaEl = document.getElementById('sidebar-meta');
    const breadcrumbsEl = document.getElementById('breadcrumbs');
    const moduleActionsEl = document.getElementById('module-actions');
    const currentScopeEl = document.getElementById('current-scope');
    const detailMetaEl = document.getElementById('detail-meta');
    const detailPanelEl = document.getElementById('detail-panel');
    const branchMetaEl = document.getElementById('branch-meta');
    const branchListEl = document.getElementById('branch-list');
    const listTitleEl = document.getElementById('list-title');
    const listMetaEl = document.getElementById('list-meta');
    const kindRowEl = document.getElementById('kind-row');
    const densityRowEl = document.getElementById('density-row');
    const resultsEl = document.getElementById('results');

    function renderTextMessage(target, className, text) {
        if (!target) {
            return;
        }

        const message = document.createElement('div');
        message.className = className;
        message.textContent = text;
        target.replaceChildren(message);
    }

    function renderFatalError(message) {
        const text = String(message || 'Module browser failed to render.');
        if (listTitleEl) {
            listTitleEl.textContent = 'Module browser error';
        }
        if (listMetaEl) {
            listMetaEl.textContent = '';
        }
        if (sidebarMetaEl) {
            sidebarMetaEl.replaceChildren(createPill('error'));
        }
        if (currentScopeEl) {
            currentScopeEl.textContent = 'Unavailable';
        }
        if (detailMetaEl) {
            detailMetaEl.textContent = 'Unavailable';
        }
        renderTextMessage(resultsEl, 'empty', text);
        renderTextMessage(detailPanelEl, 'sidebar-note', text);
        renderTextMessage(branchListEl, 'sidebar-note', text);
    }

    if (!queryInput || !packageFilter || !sortFilter || !viewFilter || !togglePrivate || !toggleDocumented || !toggleAuto || !toggleHints || !resultsEl || !kindRowEl || !densityRowEl || !listTitleEl || !listMetaEl || !sidebarMetaEl || !breadcrumbsEl || !moduleActionsEl || !currentScopeEl || !detailMetaEl || !detailPanelEl || !branchMetaEl || !branchListEl || !moduleActionsBlockEl || !selectedSymbolBlockEl || !namespacesBlockEl) {
        renderFatalError('Module browser failed to initialize its UI bindings.');
        return;
    }

    function escapeSelectorValue(value) {
        return String(value)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
    }

    function restoreFocus() {
        if (!focusedControlId) {
            return;
        }

        const target = document.querySelector('[data-focus-id="' + escapeSelectorValue(focusedControlId) + '"]');
        if (target instanceof HTMLElement) {
            target.focus({ preventScroll: true });
        }
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        if (text !== undefined) {
            element.textContent = text;
        }
        return element;
    }

    function setAttributes(element, attributes) {
        for (const [name, value] of Object.entries(attributes || {})) {
            if (value === undefined || value === null) {
                continue;
            }
            element.setAttribute(name, String(value));
        }
        return element;
    }

    function createButton(className, text, attributes) {
        return setAttributes(createElement('button', className, text), attributes);
    }

    function createPill(text) {
        return createElement('span', 'pill', text);
    }

    function persistState() {
        vscode.setState({
            stateVersion,
            moduleName,
            query,
            activeKind,
            currentPath,
            selectedPackage,
            selectedSymbolName,
            viewMode,
            sortMode,
            density,
            showPrivate,
            showDocumentedOnly,
            autoLoadPreviews,
            showHierarchyHints,
            sidebarScrollTop,
            resultsScrollTop,
            focusedControlId,
        });
    }

    let persistStateTimer;
    function schedulePersistState() {
        clearTimeout(persistStateTimer);
        persistStateTimer = setTimeout(() => {
            persistState();
        }, 40);
    }

    function normalizeKind(kind) {
        return kind || 'symbol';
    }

    function tailName(item) {
        return item.name.split('.').pop() || item.name;
    }

    function isPrivateSymbol(item) {
        return /^_/.test(tailName(item));
    }

    function relativeParts(item) {
        if (item.name === moduleName) {return [];}
        if (item.name.startsWith(moduleName + '.')) {
            return item.name.slice(moduleName.length + 1).split('.').filter(Boolean);
        }
        return item.name.split('.').filter(Boolean);
    }

    function pathMatches(parts) {
        if (parts.length < currentPath.length) {return false;}
        return currentPath.every((segment, index) => parts[index] === segment);
    }

    function currentPrefix() {
        return currentPath.length > 0 ? moduleName + '.' + currentPath.join('.') : moduleName;
    }

    function initialPreview(item) {
        return {
            name: item.name,
            title: item.title,
            kind: item.kind,
            module: item.module,
            summary: item.summary,
            signature: item.signature,
            url: item.url,
            sourceUrl: item.sourceUrl,
        };
    }

    function hasInitialPreviewData(preview) {
        return Boolean(preview.summary || preview.signature || preview.sourceUrl || preview.installedVersion);
    }

    function previewFor(item) {
        return previewCache.get(item.name) || initialPreview(item);
    }

    function hasDocs(item) {
        const preview = previewFor(item);
        return Boolean(item.url || preview.url || preview.summary || preview.signature || preview.sourceUrl);
    }

    function truncate(text, maxLength) {
        if (!text) {return '';}
        const clean = String(text).replace(/\s+/g, ' ').trim();
        if (clean.length <= maxLength) {return clean;}
        return clean.slice(0, maxLength - 1).trimEnd() + '…';
    }

    function getPackages(items) {
        return [...new Set(items.map(item => item.package).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    }

    function getKinds(items) {
        const counts = new Map();
        for (const item of items) {
            const kind = normalizeKind(item.kind);
            counts.set(kind, (counts.get(kind) || 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    }

    function getExactRoot() {
        return symbols.find(item => item.name === moduleName);
    }

    function buildImportStatement(item) {
        const rawTitle = item.name;
        if (!rawTitle || /^__\w+__$/.test(rawTitle)) {return undefined;}
        if (normalizeKind(item.kind) === 'module') {
            return 'import ' + rawTitle;
        }

        const moduleRef = item.module || moduleName.split('.')[0] || moduleName;
        if (!moduleRef || moduleRef === 'builtins') {return undefined;}

        const segments = rawTitle.split('.').filter(Boolean);
        let shortName = segments[segments.length - 1] || rawTitle;
        if (segments.length > 1 && /^(?:method|property|field)$/i.test(normalizeKind(item.kind))) {
            shortName = segments[0];
        }
        return 'from ' + moduleRef + ' import ' + shortName;
    }

    function sortItems(items) {
        return items.slice().sort((left, right) => {
            const normalizedQuery = query.trim().toLowerCase();
            if (normalizedQuery) {
                const relevance = scoreMatch(right, normalizedQuery) - scoreMatch(left, normalizedQuery);
                if (relevance !== 0) {return relevance;}
            }
            if (sortMode === 'package') {
                const packageCmp = (left.package || '').localeCompare(right.package || '');
                if (packageCmp !== 0) {return packageCmp;}
            }
            if (sortMode === 'kind') {
                const kindCmp = normalizeKind(left.kind).localeCompare(normalizeKind(right.kind));
                if (kindCmp !== 0) {return kindCmp;}
            }
            return left.name.localeCompare(right.name);
        });
    }

    function scoreMatch(item, normalizedQuery) {
        const fullName = item.name.toLowerCase();
        const tail = tailName(item).toLowerCase();
        const moduleRef = (item.module || '').toLowerCase();
        if (fullName === normalizedQuery) {return 120;}
        if (tail === normalizedQuery) {return 110;}
        if (fullName.endsWith('.' + normalizedQuery)) {return 100;}
        if (fullName.startsWith(normalizedQuery)) {return 90;}
        if (tail.startsWith(normalizedQuery)) {return 80;}
        if (moduleRef && moduleRef + '.' + tail === normalizedQuery) {return 75;}
        if (fullName.includes('.' + normalizedQuery)) {return 70;}
        if (tail.includes(normalizedQuery)) {return 60;}
        if (fullName.includes(normalizedQuery)) {return 40;}
        return 0;
    }

    function collectSymbols(includeKind) {
        const normalizedQuery = query.trim().toLowerCase();
        let items = symbols.slice();

        if (selectedPackage !== 'all') {
            items = items.filter(item => item.package === selectedPackage);
        }
        if (!showPrivate) {
            items = items.filter(item => !isPrivateSymbol(item));
        }
        if (showDocumentedOnly) {
            items = items.filter(item => hasDocs(item));
        }
        if (includeKind && activeKind !== 'all') {
            items = items.filter(item => normalizeKind(item.kind) === activeKind);
        }
        if (normalizedQuery) {
            items = items.filter(item => {
                const preview = previewFor(item);
                return [
                    item.name,
                    item.package,
                    item.module,
                    item.kind,
                    preview.summary,
                    preview.signature,
                ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery);
            });
        } else {
            items = items.filter(item => pathMatches(relativeParts(item)));
        }

        return sortItems(items);
    }

    function hierarchyView(items) {
        const namespaces = new Map();
        const leaves = [];

        for (const item of items) {
            const parts = relativeParts(item);
            if (!pathMatches(parts)) {continue;}

            if (parts.length <= currentPath.length + 1 || query.trim()) {
                leaves.push(item);
                continue;
            }

            const child = parts[currentPath.length];
            const fullPath = currentPath.concat(child);
            const key = fullPath.join('.');
            const existing = namespaces.get(key) || {
                path: fullPath,
                name: child,
                symbolCount: 0,
                kinds: new Set(),
            };
            existing.symbolCount += 1;
            existing.kinds.add(normalizeKind(item.kind));
            namespaces.set(key, existing);
        }

        return {
            branches: [...namespaces.values()].sort((a, b) => a.path.join('.').localeCompare(b.path.join('.'))),
            leaves,
        };
    }

    function encodeItem(item) {
        return encodeURIComponent(JSON.stringify(item));
    }

    function decodeItem(raw) {
        return JSON.parse(decodeURIComponent(raw));
    }

    function queuePreviewLoad(items, force) {
        const pending = items
            .filter(item => !previewCache.has(item.name) && (force || !requestedPreviews.has(item.name)))
            .slice(0, defaults.previewBatchSize);
        if (pending.length === 0) {return;}

        const requestId = ++previewRequestId;
        for (const item of pending) {
            requestedPreviews.add(item.name);
        }
        vscode.postMessage({ type: 'load-previews', requestId, symbols: pending });
    }

    function displayName(item) {
        const prefix = currentPrefix();
        if (item.name.startsWith(prefix + '.')) {
            return item.name.slice(prefix.length + 1);
        }
        if (item.name.startsWith(moduleName + '.')) {
            return item.name.slice(moduleName.length + 1);
        }
        if (/[/#]/.test(item.name)) {
            const anchor = item.name.split('#').pop() || item.name;
            const parts = anchor.split('/').filter(Boolean);
            return parts[parts.length - 1] || item.name;
        }
        return item.name;
    }

    function formatRowMeta(item, preview) {
        const parts = [normalizeKind(preview.kind || item.kind), item.package || moduleName];
        if (preview.installedVersion) {
            parts.push('v' + preview.installedVersion);
        }
        parts.push(hasDocs(item) ? 'docs' : 'index only');
        return parts.join(' · ');
    }

    function renderPackageFilter(items) {
        const packages = getPackages(items);
        if (selectedPackage !== 'all' && !packages.includes(selectedPackage)) {
            selectedPackage = 'all';
        }
        const packageCounts = new Map();
        for (const item of items) {
            if (!item.package) {
                continue;
            }
            packageCounts.set(item.package, (packageCounts.get(item.package) || 0) + 1);
        }
        const options = [];
        const allOption = document.createElement('option');
        allOption.value = 'all';
        allOption.textContent = 'All packages (' + packages.length + ')';
        allOption.selected = selectedPackage === 'all';
        options.push(allOption);
        for (const pkg of packages) {
            const count = packageCounts.get(pkg) || 0;
            const option = document.createElement('option');
            option.value = pkg;
            option.textContent = pkg + ' (' + count + ')';
            option.selected = selectedPackage === pkg;
            options.push(option);
        }
        packageFilter.replaceChildren(...options);
        packageFilter.value = selectedPackage;
    }

    function reconcileScopedItems() {
        const scopedItems = collectSymbols(false);
        if (scopedItems.length > 0) {
            return scopedItems;
        }

        let didReset = false;
        if (selectedPackage !== 'all') {
            selectedPackage = 'all';
            didReset = true;
        }
        if (activeKind !== 'all') {
            activeKind = 'all';
            didReset = true;
        }
        if (currentPath.length > 0) {
            currentPath = [];
            didReset = true;
        }

        return didReset ? collectSymbols(false) : scopedItems;
    }

    function getVisibleRows(filteredItems, hierarchy) {
        if (viewMode !== 'hierarchy' || query.trim()) {
            return filteredItems;
        }
        if (hierarchy.leaves.length > 0) {
            return hierarchy.leaves;
        }
        return filteredItems.slice(0, Math.min(filteredItems.length, 160));
    }

    function renderDensityControls() {
        densityRowEl.replaceChildren(
            createButton('segment' + (density === 'comfortable' ? ' active' : ''), 'Comfortable', { 'data-density': 'comfortable', 'data-focus-id': 'density:comfortable' }),
            createButton('segment' + (density === 'compact' ? ' active' : ''), 'Compact', { 'data-density': 'compact', 'data-focus-id': 'density:compact' })
        );
    }

    function renderKindFilters(items) {
        const chips = [createButton('kind-chip' + (activeKind === 'all' ? ' active' : ''), 'All ' + items.length, { 'data-kind': 'all' })];
        for (const entry of getKinds(items)) {
            chips.push(createButton('kind-chip' + (activeKind === entry[0] ? ' active' : ''), entry[0] + ' ' + entry[1], { 'data-kind': entry[0] }));
        }
        kindRowEl.replaceChildren(...chips);
    }

    function renderSidebar(filteredItems, rows, hierarchy) {
        const exactRoot = getExactRoot();
        const documented = filteredItems.filter(item => hasDocs(item)).length;
        sidebarMetaEl.replaceChildren(
            createPill(symbols.length + ' indexed'),
            createPill(rows.length + ' shown'),
            createPill(documented + ' with docs')
        );
        currentScopeEl.textContent = currentPath.length > 0 ? currentPath.join('.') : moduleName;

        const crumbs = [createButton('crumb' + (currentPath.length === 0 ? ' current' : ''), moduleName, { 'data-breadcrumb': '' })];
        for (let index = 0; index < currentPath.length; index++) {
            const path = currentPath.slice(0, index + 1).join('.');
            crumbs.push(createButton('crumb' + (index === currentPath.length - 1 ? ' current' : ''), currentPath[index], { 'data-breadcrumb': path }));
        }
        breadcrumbsEl.replaceChildren(...crumbs);

        const actions = [];
        if (exactRoot && exactRoot.url) {
            actions.push(createButton('primary', 'Open docs', { 'data-open-doc': exactRoot.url }));
        }
        if (exactRoot) {
            actions.push(createButton('ghost', 'Pin module', { 'data-pin-symbol': encodeItem(exactRoot) }));
            actions.push(createButton('ghost', 'Source', { 'data-source-symbol': encodeItem(exactRoot) }));
            const importStatement = buildImportStatement(exactRoot);
            if (importStatement) {
                actions.push(createButton('ghost', 'Copy import', { 'data-copy-symbol': encodeItem(exactRoot) }));
            }
        }
        moduleActionsBlockEl.classList.toggle('hidden', actions.length === 0);
        moduleActionsEl.replaceChildren(...actions);

        renderSelectedDetail(rows);

        if (viewMode !== 'hierarchy') {
            namespacesBlockEl.classList.add('hidden');
            branchMetaEl.textContent = '';
            branchListEl.replaceChildren();
            return;
        }

        namespacesBlockEl.classList.remove('hidden');

        if (query.trim()) {
            branchMetaEl.textContent = 'Search active';
            renderTextMessage(branchListEl, 'sidebar-note', 'Namespace navigation is hidden while filtering. Clear the search to drill into paths again.');
            return;
        }

        branchMetaEl.textContent = hierarchy.branches.length + ' branch' + (hierarchy.branches.length === 1 ? '' : 'es');
        if (hierarchy.branches.length === 0) {
            renderTextMessage(branchListEl, 'sidebar-note', 'No deeper namespaces are indexed at this level.');
            return;
        }

        const branchButtons = hierarchy.branches.map(branch => {
            const kinds = [...branch.kinds].sort().join(', ');
            const button = createButton('nav-item', undefined, { 'data-path': branch.path.join('.') });
            const textWrap = createElement('span', 'nav-text');
            textWrap.appendChild(createElement('span', 'nav-title', branch.name));
            if (showHierarchyHints) {
                textWrap.appendChild(createElement('span', 'sidebar-note', kinds || 'symbol'));
            }
            button.appendChild(textWrap);
            button.appendChild(createPill(String(branch.symbolCount)));
            return button;
        });
        branchListEl.replaceChildren(...branchButtons);
    }

    function renderSelectedDetail(rows) {
        if (!selectedSymbolName || !rows.some(item => item.name === selectedSymbolName)) {
            selectedSymbolName = rows[0] ? rows[0].name : '';
        }

        const selected = rows.find(item => item.name === selectedSymbolName);
        if (!selected) {
            selectedSymbolBlockEl.classList.add('hidden');
            detailMetaEl.textContent = 'No symbol selected';
            renderTextMessage(detailPanelEl, 'sidebar-note', 'Select a symbol from the list to see its signature, summary, and actions here.');
            return;
        }

        selectedSymbolBlockEl.classList.remove('hidden');

        const preview = previewFor(selected);
        const importStatement = buildImportStatement(selected);
        const docsUrl = preview.url || selected.url;
        detailMetaEl.textContent = normalizeKind(preview.kind || selected.kind);
        const detailChildren = [
            createElement('div', 'detail-title', displayName(selected)),
            createElement('div', 'detail-copy', selected.name)
        ];
        if (preview.signature) {
            detailChildren.push(createElement('div', 'signature', truncate(preview.signature, 220)));
        }
        detailChildren.push(createElement('div', 'detail-copy', truncate(preview.summary || 'Preview content loads when docs are hydrated.', 260)));
        detailChildren.push(createElement('div', 'detail-copy', formatRowMeta(selected, preview)));
        const stack = createElement('div', 'stack');
        if (docsUrl) {
            stack.appendChild(createButton('ghost', 'Docs', { 'data-open-doc': docsUrl }));
        }
        stack.appendChild(createButton('ghost', 'Pin', { 'data-pin-symbol': encodeItem(selected) }));
        stack.appendChild(createButton('ghost', 'Source', { 'data-source-symbol': encodeItem(selected) }));
        if (importStatement) {
            stack.appendChild(createButton('ghost', 'Copy import', { 'data-copy-symbol': encodeItem(selected) }));
        }
        detailChildren.push(stack);
        detailPanelEl.replaceChildren(...detailChildren);
    }

    function renderList(rows, hierarchy) {
        listTitleEl.textContent = query.trim()
            ? 'Search results'
            : viewMode === 'hierarchy'
                ? 'Symbols at ' + (currentPath.length > 0 ? currentPath.join('.') : moduleName)
                : 'All matching symbols';

        const metaParts = [rows.length + ' item' + (rows.length === 1 ? '' : 's')];
        if (viewMode === 'hierarchy' && !query.trim()) {
            metaParts.push(hierarchy.branches.length + ' branch' + (hierarchy.branches.length === 1 ? '' : 'es'));
        }
        if (selectedPackage !== 'all') {
            metaParts.push(selectedPackage);
        }
        listMetaEl.textContent = metaParts.join(' · ');

        resultsEl.className = 'results density-' + density;
        if (rows.length === 0) {
            renderTextMessage(
                resultsEl,
                'empty',
                viewMode === 'hierarchy' && hierarchy.branches.length > 0 && !query.trim()
                    ? 'Choose a namespace from the sidebar to inspect the symbols inside it.'
                    : 'No symbols match the current filters.'
            );
            return;
        }

        const rowElements = rows.map(item => {
            const preview = previewFor(item);
            const summary = truncate(preview.summary, density === 'compact' ? 110 : 220);
            const signature = truncate(preview.signature, density === 'compact' ? 100 : 180);
            const docsUrl = preview.url || item.url;
            const importStatement = buildImportStatement(item);
            const row = createElement('article', 'row' + (density === 'compact' ? ' compact' : '') + (selectedSymbolName === item.name ? ' active' : ''));
            row.setAttribute('data-select-symbol', item.name);
            row.setAttribute('data-focus-id', 'row:' + item.name);
            row.tabIndex = 0;

            const rowHead = createElement('div', 'row-head');
            const titleGroup = createElement('div', 'row-title-group');
            titleGroup.appendChild(createElement('div', 'row-title', displayName(item)));
            titleGroup.appendChild(createElement('div', 'row-path', item.name));
            rowHead.appendChild(titleGroup);

            const actions = createElement('div', 'actions');
            if (docsUrl) {
                actions.appendChild(createButton('action', 'Docs', { 'data-open-doc': docsUrl }));
            }
            actions.appendChild(createButton('action', 'Pin', { 'data-pin-symbol': encodeItem(item) }));
            actions.appendChild(createButton('action', 'Source', { 'data-source-symbol': encodeItem(item) }));
            if (importStatement) {
                actions.appendChild(createButton('action', 'Import', { 'data-copy-symbol': encodeItem(item) }));
            }
            rowHead.appendChild(actions);
            row.appendChild(rowHead);

            row.appendChild(createElement('div', 'row-meta', formatRowMeta(item, preview)));
            if (signature) {
                row.appendChild(createElement('div', 'signature', signature));
            }
            row.appendChild(createElement('div', 'row-summary', summary || 'Preview content loads when docs are hydrated.'));
            return row;
        });
        resultsEl.replaceChildren(...rowElements);
    }

    function getRenderableRows() {
        const scopedItems = collectSymbols(false);
        const filteredItems = activeKind === 'all' ? scopedItems : scopedItems.filter(item => normalizeKind(item.kind) === activeKind);
        const hierarchy = hierarchyView(filteredItems);
        return getVisibleRows(filteredItems, hierarchy);
    }

    function render() {
        const preservedSidebarScrollTop = sidebarEl ? sidebarEl.scrollTop : sidebarScrollTop;
        const preservedResultsScrollTop = resultsEl.scrollTop;
        persistState();
        sortFilter.value = sortMode;
        viewFilter.value = viewMode;
        togglePrivate.checked = showPrivate;
        toggleDocumented.checked = showDocumentedOnly;
        toggleAuto.checked = autoLoadPreviews;
        toggleHints.checked = showHierarchyHints;

        renderPackageFilter(symbols);
        renderDensityControls();

        const scopedItems = reconcileScopedItems();
        renderKindFilters(scopedItems);

        const filteredItems = activeKind === 'all' ? scopedItems : scopedItems.filter(item => normalizeKind(item.kind) === activeKind);
        const hierarchy = hierarchyView(filteredItems);
        const rows = getVisibleRows(filteredItems, hierarchy);

        renderSidebar(filteredItems, rows, hierarchy);
        renderList(rows, hierarchy);

        sidebarScrollTop = preservedSidebarScrollTop;
        resultsScrollTop = preservedResultsScrollTop;
        requestAnimationFrame(() => {
            if (sidebarEl) {
                sidebarEl.scrollTop = sidebarScrollTop;
            }
            resultsEl.scrollTop = resultsScrollTop;
            restoreFocus();
        });

        if (autoLoadPreviews) {
            queuePreviewLoad(rows, false);
        }
    }

    try {
        queryInput.value = query;
        sortFilter.value = sortMode;
        viewFilter.value = viewMode;
        togglePrivate.checked = showPrivate;
        toggleDocumented.checked = showDocumentedOnly;
        toggleAuto.checked = autoLoadPreviews;
        toggleHints.checked = showHierarchyHints;

        for (const symbol of symbols) {
            const preview = initialPreview(symbol);
            if (hasInitialPreviewData(preview)) {
                previewCache.set(symbol.name, preview);
                requestedPreviews.add(symbol.name);
            }
        }

        queryInput.addEventListener('input', event => {
            query = event.target.value || '';
            if (query.trim()) {
                currentPath = [];
            }
            render();
        });

        packageFilter.addEventListener('change', event => {
            selectedPackage = event.target.value || 'all';
            render();
        });

        sortFilter.addEventListener('change', event => {
            sortMode = event.target.value || defaults.defaultSort;
            defaults.defaultSort = sortMode;
            vscode.postMessage({ type: 'update-setting', key: 'python-hover.ui.moduleBrowser.defaultSort', value: sortMode });
            render();
        });

        viewFilter.addEventListener('change', event => {
            viewMode = event.target.value || defaults.defaultView;
            defaults.defaultView = viewMode;
            vscode.postMessage({ type: 'update-setting', key: 'python-hover.ui.moduleBrowser.defaultView', value: viewMode });
            render();
        });

        togglePrivate.addEventListener('change', event => {
            showPrivate = event.target.checked;
            vscode.postMessage({ type: 'update-setting', key: 'python-hover.ui.moduleBrowser.showPrivateSymbols', value: showPrivate });
            render();
        });

        toggleDocumented.addEventListener('change', event => {
            showDocumentedOnly = event.target.checked;
            render();
        });

        toggleAuto.addEventListener('change', event => {
            autoLoadPreviews = event.target.checked;
            vscode.postMessage({ type: 'update-setting', key: 'python-hover.ui.moduleBrowser.autoLoadPreviews', value: autoLoadPreviews });
            render();
        });

        toggleHints.addEventListener('change', event => {
            showHierarchyHints = event.target.checked;
            defaults.showHierarchyHints = showHierarchyHints;
            vscode.postMessage({ type: 'update-setting', key: 'python-hover.ui.moduleBrowser.showHierarchyHints', value: showHierarchyHints });
            render();
        });

        document.addEventListener('click', event => {
            const source = getEventElement(event.target);
            const target = source ? source.closest('button') : null;
            if (!target) {
                const row = source ? source.closest('[data-select-symbol]') : null;
                if (row) {
                    selectedSymbolName = row.getAttribute('data-select-symbol') || '';
                    render();
                }
                return;
            }

            const breadcrumb = target.getAttribute('data-breadcrumb');
            if (breadcrumb !== null) {
                currentPath = breadcrumb ? breadcrumb.split('.').filter(Boolean) : [];
                render();
                return;
            }

            const path = target.getAttribute('data-path');
            if (path) {
                currentPath = path.split('.').filter(Boolean);
                viewMode = 'hierarchy';
                viewFilter.value = 'hierarchy';
                render();
                return;
            }

            const kind = target.getAttribute('data-kind');
            if (kind) {
                activeKind = kind;
                render();
                return;
            }

            const densityValue = target.getAttribute('data-density');
            if (densityValue) {
                density = densityValue;
                defaults.defaultDensity = density;
                vscode.postMessage({ type: 'update-setting', key: 'python-hover.ui.moduleBrowser.defaultDensity', value: density });
                render();
                return;
            }

            if (target.hasAttribute('data-manual-preview')) {
                queuePreviewLoad(getRenderableRows(), true);
                return;
            }

            const openDoc = target.getAttribute('data-open-doc');
            if (openDoc) {
                vscode.postMessage({ type: 'open-doc', url: openDoc });
                return;
            }

            const pinSymbol = target.getAttribute('data-pin-symbol');
            if (pinSymbol) {
                vscode.postMessage({ type: 'pin-symbol', symbol: decodeItem(pinSymbol) });
                return;
            }

            const sourceSymbol = target.getAttribute('data-source-symbol');
            if (sourceSymbol) {
                vscode.postMessage({ type: 'open-source', symbol: decodeItem(sourceSymbol) });
                return;
            }

            const copySymbol = target.getAttribute('data-copy-symbol');
            if (copySymbol) {
                vscode.postMessage({ type: 'copy-import', symbol: decodeItem(copySymbol) });
                return;
            }

            const command = target.getAttribute('data-run-command');
            if (command) {
                vscode.postMessage({ type: 'run-command', command });
                return;
            }

            if (target.hasAttribute('data-open-settings')) {
                vscode.postMessage({ type: 'open-settings', query: target.getAttribute('data-open-settings') || undefined });
            }
        });

        if (sidebarEl) {
            sidebarEl.addEventListener('scroll', () => {
                sidebarScrollTop = sidebarEl.scrollTop;
                schedulePersistState();
            }, { passive: true });
        }

        resultsEl.addEventListener('scroll', () => {
            resultsScrollTop = resultsEl.scrollTop;
            schedulePersistState();
        }, { passive: true });

        document.addEventListener('focusin', event => {
            const source = getEventElement(event.target);
            const focusTarget = source ? source.closest('[data-focus-id]') : null;
            if (!focusTarget) {
                return;
            }
            focusedControlId = focusTarget.getAttribute('data-focus-id') || focusedControlId;
            schedulePersistState();
        });

        document.addEventListener('keydown', event => {
            const active = document.activeElement;
            const isTextEntry = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement;
            const activeRow = active instanceof HTMLElement ? active.closest('[data-select-symbol]') : null;
            const key = event.key;

            if ((key === '/' && !isTextEntry) || ((event.metaKey || event.ctrlKey) && key.toLowerCase() === 'k')) {
                event.preventDefault();
                focusedControlId = 'query';
                queryInput.focus();
                queryInput.select();
                return;
            }

            if (active === queryInput && key === 'Escape') {
                event.preventDefault();
                if (query) {
                    query = '';
                    render();
                    requestAnimationFrame(() => {
                        queryInput.focus({ preventScroll: true });
                    });
                } else {
                    queryInput.blur();
                }
                return;
            }

            if ((key === 'ArrowDown' || key === 'ArrowUp') && (active === queryInput || activeRow)) {
                event.preventDefault();
                const rows = getRenderableRows();
                if (rows.length === 0) {
                    return;
                }
                const currentIndex = rows.findIndex(item => item.name === selectedSymbolName);
                const baseIndex = currentIndex >= 0 ? currentIndex : 0;
                const nextIndex = Math.min(rows.length - 1, Math.max(0, baseIndex + (key === 'ArrowDown' ? 1 : -1)));
                const next = rows[nextIndex];
                if (!next) {
                    return;
                }
                selectedSymbolName = next.name;
                focusedControlId = 'row:' + next.name;
                render();
                return;
            }

            if (key === 'Enter' && activeRow instanceof HTMLElement) {
                const symbolName = activeRow.getAttribute('data-select-symbol') || '';
                if (!symbolName) {
                    return;
                }
                event.preventDefault();
                selectedSymbolName = symbolName;
                focusedControlId = 'row:' + symbolName;
                const rows = getRenderableRows();
                const selected = rows.find(item => item.name === selectedSymbolName) || rows[0];
                if (!selected) {
                    return;
                }
                const preview = previewFor(selected);
                const docsUrl = preview.url || selected.url;
                if (docsUrl) {
                    vscode.postMessage({ type: 'open-doc', url: docsUrl });
                }
            }
        });

        window.addEventListener('message', event => {
            const message = event.data;
            if (!message || message.type !== 'preview-data' || !Array.isArray(message.previews)) {
                return;
            }

            let didChange = false;
            for (const preview of message.previews) {
                if (!preview || !preview.name) {continue;}
                const previous = previewCache.get(preview.name);
                const next = JSON.stringify(preview);
                const current = previous ? JSON.stringify(previous) : '';
                if (next !== current) {
                    previewCache.set(preview.name, preview);
                    didChange = true;
                }
            }

            if (didChange) {
                render();
            }
        });

        render();
    } catch (error) {
        renderFatalError('Module browser failed to render: ' + (error && error.message ? error.message : String(error)));
    }
}());
