'use strict';

class MarkdownString {
    constructor() {
        this.value = '';
        this.isTrusted = true;
        this.supportThemeIcons = true;
        this.supportHtml = true;
    }
    appendMarkdown(s) {
        this.value += s;
    }
    appendCodeblock(code, lang) {
        this.value += '```' + (lang || '') + '\n' + code + '\n```\n\n';
    }
}

class Hover {
    constructor(contents) {
        this.contents = contents;
    }
}

module.exports = { MarkdownString, Hover };
