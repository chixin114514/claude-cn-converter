// ==UserScript==
// @name         Claude 简繁自动转换
// @namespace    https://github.com/chixin114514/claude-cn-converter
// @version      1.0.0
// @description  claude.ai：发送时大陆简体转台湾繁体，回复显示时台湾繁体转大陆简体
// @author       chixin114514
// @match        https://claude.ai/*
// @require      https://cdn.jsdelivr.net/npm/opencc-js@1.4.2/dist/umd/full.js
// @updateURL    https://raw.githubusercontent.com/chixin114514/claude-cn-converter/main/claude-cn-converter.user.js
// @downloadURL  https://raw.githubusercontent.com/chixin114514/claude-cn-converter/main/claude-cn-converter.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // 大陆简体 -> 台湾繁体（含常用词汇转换）
    const toTraditional = OpenCC.Converter({
        from: 'cn',
        to: 'twp'
    });

    // 台湾繁体（含台湾词汇） -> 大陆简体
    const toSimplified = OpenCC.Converter({
        from: 'twp',
        to: 'cn'
    });

    let sending = false;

    function getEditor(target) {
        if (!(target instanceof Element)) {
            return null;
        }

        return target.closest(
            '.ProseMirror[contenteditable="true"],' +
            '[contenteditable="true"][role="textbox"],' +
            '[data-testid="chat-input"][contenteditable="true"],' +
            'textarea'
        );
    }

    function convertContentEditable(editor) {
        const walker = document.createTreeWalker(
            editor,
            NodeFilter.SHOW_TEXT
        );

        const textNodes = [];
        let node;

        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }

        for (const textNode of textNodes) {
            const original = textNode.nodeValue || '';
            const converted = toTraditional(original);

            if (converted !== original) {
                textNode.nodeValue = converted;
            }
        }

        // 让 Claude/ProseMirror 感知 DOM 内容变化。
        editor.dispatchEvent(
            new InputEvent('input', {
                bubbles: true,
                inputType: 'insertText',
                data: null
            })
        );
    }

    function convertTextarea(textarea) {
        const original = textarea.value;
        const converted = toTraditional(original);

        if (converted === original) {
            return;
        }

        const descriptor = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype,
            'value'
        );

        if (descriptor && descriptor.set) {
            descriptor.set.call(textarea, converted);
        } else {
            textarea.value = converted;
        }

        textarea.dispatchEvent(
            new InputEvent('input', {
                bubbles: true,
                inputType: 'insertText',
                data: converted
            })
        );
    }

    function convertEditor(editor) {
        if (editor instanceof HTMLTextAreaElement) {
            convertTextarea(editor);
        } else {
            convertContentEditable(editor);
        }
    }

    function findSendButton(editor) {
        const form = editor.closest('form');

        if (form) {
            const submit = form.querySelector(
                'button[type="submit"]:not([disabled])'
            );

            if (submit) {
                return submit;
            }
        }

        const selectors = [
            'button[data-testid="send-button"]:not([disabled])',
            'button[data-testid*="send"]:not([disabled])',
            'button[aria-label="Send Message"]:not([disabled])',
            'button[aria-label="Send message"]:not([disabled])',
            'button[aria-label="Send"]:not([disabled])',
            'button[aria-label*="Send"]:not([disabled])'
        ];

        for (const selector of selectors) {
            const button = document.querySelector(selector);

            if (button) {
                return button;
            }
        }

        return null;
    }

    function sendConvertedMessage(editor) {
        // 给 Claude 的编辑器状态一个很短的同步窗口。
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const button = findSendButton(editor);

                if (button) {
                    button.click();
                    sending = false;
                    return;
                }

                const form = editor.closest('form');

                if (form && typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                    sending = false;
                    return;
                }

                // 最后的兼容 fallback。部分前端会忽略非 trusted 键盘事件，
                // 因此主要发送路径仍然是按钮 click / form.requestSubmit。
                editor.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true
                    })
                );

                sending = false;
            });
        });
    }

    // 在 Claude 自己处理 Enter 之前拦截。
    document.addEventListener(
        'keydown',
        function (event) {
            if (sending || event.key !== 'Enter') {
                return;
            }

            // IME 选字时的 Enter 不应发送。
            if (event.isComposing || event.keyCode === 229) {
                return;
            }

            // Shift + Enter 保持换行。
            if (event.shiftKey) {
                return;
            }

            // 不覆盖其他组合快捷键。
            if (event.ctrlKey || event.altKey || event.metaKey) {
                return;
            }

            const editor = getEditor(event.target);

            if (!editor) {
                return;
            }

            const text =
                editor instanceof HTMLTextAreaElement
                    ? editor.value
                    : editor.innerText;

            if (!text || !text.trim()) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            sending = true;

            try {
                convertEditor(editor);
                sendConvertedMessage(editor);
            } catch (error) {
                sending = false;
                console.error('[Claude CN Converter] 发送转换失败：', error);
            }
        },
        true
    );

    // -----------------------------------------------------------------
    // Claude 回复显示：台湾繁体 -> 大陆简体
    // -----------------------------------------------------------------

    function shouldIgnoreTextNode(textNode) {
        const parent = textNode.parentElement;

        if (!parent) {
            return true;
        }

        return Boolean(
            parent.closest(
                'code, pre, textarea, input, [contenteditable="true"], ' +
                'script, style, svg, math'
            )
        );
    }

    function isAssistantContent(element) {
        if (!(element instanceof Element)) {
            return false;
        }

        return Boolean(
            element.closest(
                '[data-testid="assistant-message"],' +
                '[data-testid*="assistant"],' +
                '.font-claude-response-body'
            )
        );
    }

    function convertResponseTextNode(textNode) {
        if (
            !textNode ||
            textNode.nodeType !== Node.TEXT_NODE ||
            shouldIgnoreTextNode(textNode) ||
            !isAssistantContent(textNode.parentElement)
        ) {
            return;
        }

        const original = textNode.nodeValue || '';

        if (!original.trim()) {
            return;
        }

        const converted = toSimplified(original);

        if (converted !== original) {
            textNode.nodeValue = converted;
        }
    }

    function convertResponseTree(root) {
        if (!root) {
            return;
        }

        if (root.nodeType === Node.TEXT_NODE) {
            convertResponseTextNode(root);
            return;
        }

        if (!(root instanceof Element)) {
            return;
        }

        const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT
        );

        let node;

        while ((node = walker.nextNode())) {
            convertResponseTextNode(node);
        }
    }

    function startObserver() {
        if (!document.body) {
            requestAnimationFrame(startObserver);
            return;
        }

        // 处理打开页面时已经存在的 Claude 回复。
        convertResponseTree(document.body);

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (
                    mutation.type === 'characterData' &&
                    mutation.target.nodeType === Node.TEXT_NODE
                ) {
                    convertResponseTextNode(mutation.target);
                    continue;
                }

                for (const node of mutation.addedNodes) {
                    convertResponseTree(node);
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    startObserver();
})();
