(function () {
    const vscode = acquireVsCodeApi();
    const restored = vscode.getState() || {};
    const restoredScrollY = typeof restored.scrollY === 'number' ? restored.scrollY : 0;
    let focusId = typeof restored.focusId === 'string' ? restored.focusId : '';

    function escapeSelectorValue(value) {
        return String(value)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"');
    }

    function restoreFocus() {
        if (!focusId) {
            return;
        }

        const target = document.querySelector('[data-focus-id="' + escapeSelectorValue(focusId) + '"]');
        if (target instanceof HTMLElement) {
            target.focus({ preventScroll: true });
        }
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

    window.addEventListener('load', function () {
        if (restoredScrollY > 0) {
            window.scrollTo({ top: restoredScrollY, behavior: 'auto' });
        }
        restoreFocus();
    }, { once: true });

    let scrollStateTimer;
    function schedulePanelState() {
        clearTimeout(scrollStateTimer);
        scrollStateTimer = setTimeout(function () {
            vscode.setState({ scrollY: window.scrollY, focusId: focusId });
        }, 40);
    }

    window.addEventListener('scroll', function () {
        schedulePanelState();
    }, { passive: true });

    document.addEventListener('focusin', function (event) {
        const source = getEventElement(event.target);
        const target = source ? source.closest('[data-focus-id]') : null;
        if (!target) {
            return;
        }

        focusId = target.getAttribute('data-focus-id') || focusId;
        schedulePanelState();
    });

    document.addEventListener('keydown', function (event) {
        if (!(event.metaKey || event.ctrlKey) || event.altKey) {
            return;
        }

        const key = event.key.toLowerCase();
        if (event.key === ',') {
            event.preventDefault();
            vscode.postMessage({ type: 'open-settings', query: 'python-hover' });
            return;
        }

        if (key === 'b' && !event.shiftKey) {
            event.preventDefault();
            vscode.postMessage({ type: 'run-command', command: 'python-hover.browseModule' });
            return;
        }

        if (key === 'd' && event.shiftKey) {
            event.preventDefault();
            vscode.postMessage({ type: 'run-command', command: 'python-hover.searchDocs' });
        }
    });

    document.addEventListener('click', function (event) {
        const source = getEventElement(event.target);
        const button = source ? source.closest('button') : null;
        if (!button) {
            return;
        }

        const command = button.getAttribute('data-run-command');
        if (command) {
            vscode.postMessage({ type: 'run-command', command: command });
            return;
        }

        const query = button.getAttribute('data-open-settings');
        if (query !== null) {
            vscode.postMessage({ type: 'open-settings', query: query });
            return;
        }

        const preset = button.getAttribute('data-preset');
        if (preset) {
            vscode.postMessage({ type: 'apply-preset', preset: preset });
            return;
        }

        const choiceKey = button.getAttribute('data-choice-key');
        const choiceValue = button.getAttribute('data-choice-value');
        if (choiceKey && choiceValue !== null) {
            vscode.postMessage({ type: 'update-setting', key: choiceKey, value: choiceValue });
            return;
        }

        const numberKey = button.getAttribute('data-number-key');
        if (!numberKey) {
            return;
        }

        const current = Number(button.getAttribute('data-number-value'));
        const min = Number(button.getAttribute('data-number-min'));
        const max = Number(button.getAttribute('data-number-max'));
        const step = Number(button.getAttribute('data-number-step'));
        if (Number.isNaN(current) || Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(step)) {
            return;
        }

        const next = Math.min(max, Math.max(min, current + step));
        vscode.postMessage({ type: 'update-setting', key: numberKey, value: next });
    });

    document.addEventListener('change', function (event) {
        const input = event.target instanceof HTMLInputElement ? event.target : null;
        if (!input) {
            return;
        }

        const key = input.getAttribute('data-toggle-key');
        if (key) {
            vscode.postMessage({ type: 'update-setting', key: key, value: input.checked });
        }
    });
}());
