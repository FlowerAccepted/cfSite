import { ExtendedRenderer, renderExtendedMarkdown } from "./markdownRenderer.client.js";

const ACE_SCRIPT_URL =
        "https://cdn.jsdelivr.net/npm/ace-builds@1.43.3/src-min-noconflict/ace.js";
    const ACE_MARKDOWN_MODE_URL =
        "https://cdn.jsdelivr.net/npm/ace-builds@1.43.3/src-min-noconflict/mode-markdown.js";
    const ACE_TEXT_MODE_URL =
        "https://cdn.jsdelivr.net/npm/ace-builds@1.43.3/src-min-noconflict/mode-text.js";
    const ACE_CHROME_THEME_URL =
        "https://cdn.jsdelivr.net/npm/ace-builds@1.43.3/src-min-noconflict/theme-chrome.js";
    const ACE_DARK_THEME_URL =
        "https://cdn.jsdelivr.net/npm/ace-builds@1.43.3/src-min-noconflict/theme-tomorrow_night_eighties.js";

    let aceLoadPromise = null;
    let aceDepsLoadPromise = null;
    let aceCustomModeReady = false;

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = Array.from(document.scripts).find((script) => script.src === src);
            if (existing) {
                if (existing.dataset.loaded === "1") {
                    resolve();
                    return;
                }
                existing.addEventListener("load", () => resolve(), { once: true });
                existing.addEventListener("error", () => reject(new Error(`script load failed: ${src}`)), {
                    once: true,
                });
                return;
            }

            const script = document.createElement("script");
            script.src = src;
            script.async = true;
            script.addEventListener(
                "load",
                () => {
                    script.dataset.loaded = "1";
                    resolve();
                },
                { once: true },
            );
            script.addEventListener("error", () => reject(new Error(`script load failed: ${src}`)), {
                once: true,
            });
            document.head.appendChild(script);
        });
    }

    function ensureAceLoaded() {
        if (window.ace) return Promise.resolve();
        if (!aceLoadPromise) {
            aceLoadPromise = loadScript(ACE_SCRIPT_URL);
        }
        return aceLoadPromise;
    }

    function ensureAceDepsLoaded() {
        if (!window.ace) return Promise.resolve();
        const ace = window.ace;

        try {
            ace.require("ace/mode/markdown");
            ace.require("ace/theme/chrome");
            ace.require("ace/theme/tomorrow_night_eighties");
            return Promise.resolve();
        } catch {
            // continue to network loading
        }

        if (!aceDepsLoadPromise) {
            aceDepsLoadPromise = Promise.all([
                loadScript(ACE_TEXT_MODE_URL),
                loadScript(ACE_MARKDOWN_MODE_URL),
                loadScript(ACE_CHROME_THEME_URL),
                loadScript(ACE_DARK_THEME_URL),
            ]).then(() => undefined);
        }

        return aceDepsLoadPromise;
    }

    function ensureAceCustomMode() {
        const ace = window.ace;
        if (!ace || !ace.define || !ace.require) return false;
        if (aceCustomModeReady) return true;

        try {
            ace.require("ace/mode/cfsite_markdown");
            aceCustomModeReady = true;
            return true;
        } catch {
            // continue and define
        }

        try {
            ace.define(
                "ace/mode/cfsite_markdown_highlight_rules",
                ["require", "exports", "module", "ace/lib/oop", "ace/mode/text_highlight_rules"],
                (require, exports) => {
                    const oop = require("ace/lib/oop");
                    const TextHighlightRules = require("ace/mode/text_highlight_rules").TextHighlightRules;

                    const CfSiteMarkdownHighlightRules = function() {
                        this.$rules = {
                            start: [
                                { token: "markup.heading", regex: /^\s{0,3}#{1,6}\s+.*$/ },
                                { token: "string.blockquote", regex: /^\s{0,3}>\s+.*$/ },
                                { token: "markup.list", regex: /^\s{0,3}-\s+\[[ xX]\]\s+.*$/ },
                                { token: "markup.list", regex: /^\s{0,3}(?:[-+*]|\d+\.)\s+.*$/ },
                                { token: "support.constant", regex: /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/ },
                                { token: "comment", regex: /^\s*\|.*\|\s*$/ },
                                { token: "invalid", regex: /::anti-ai\[[^\]]*\]/ },
                                { token: "comment", regex: /::hidden\[[^\]]*\]/ },
                                { token: "constant.language", regex: /^::cute-table\{(?:tuack|three)\}\s*$/ },
                                {
                                    token: "support.function",
                                    regex: /^:::(?:info|success|warning|error)(?:\[[^\]]*\])?(?:\{open\})?\s*$/,
                                },
                                {
                                    token: "support.function",
                                    regex: /^:::(?:align\{(?:center|right)\}|epigraph(?:\[[^\]]*\])?)\s*$/,
                                },
                                { token: "support.function", regex: /^:::\s*$/ },
                                { token: "markup.raw", regex: /`[^`\n]+`/ },
                                { token: "markup.raw", regex: /\$\$[\s\S]*?\$\$/ },
                                { token: "markup.raw", regex: /\$(?:\\\$|[^$\n])+\$/ },
                                { token: "markup.bold", regex: /\*\*(?=\S)([\s\S]*?\S)\*\*/ },
                                { token: "markup.italic", regex: /\*(?=\S)([\s\S]*?\S)\*/ },
                                { token: "markup.underline", regex: /!\[(?:[^\]\\]|\\.)*\]\((?:[^)\\]|\\.)+\)/ },
                                { token: "markup.underline", regex: /\[(?:[^\]\\]|\\.)+\]\((?:[^)\\]|\\.)+\)/ },
                                { token: "text", regex: /[^`*_[!>\-|:#\n]+/ },
                                { token: "text", regex: /./ },
                            ],
                        };
                        this.normalizeRules();
                    };

                    oop.inherits(CfSiteMarkdownHighlightRules, TextHighlightRules);
                    exports.CfSiteMarkdownHighlightRules = CfSiteMarkdownHighlightRules;
                },
            );

            ace.define(
                "ace/mode/cfsite_markdown",
                [
                    "require",
                    "exports",
                    "module",
                    "ace/lib/oop",
                    "ace/mode/text",
                    "ace/mode/cfsite_markdown_highlight_rules",
                ],
                (require, exports) => {
                    const oop = require("ace/lib/oop");
                    const TextMode = require("ace/mode/text").Mode;
                    const CfSiteMarkdownHighlightRules =
                        require("ace/mode/cfsite_markdown_highlight_rules").CfSiteMarkdownHighlightRules;

                    const Mode = function() {
                        TextMode.call(this);
                        this.HighlightRules = CfSiteMarkdownHighlightRules;
                        this.$id = "ace/mode/cfsite_markdown";
                    };

                    oop.inherits(Mode, TextMode);
                    exports.Mode = Mode;
                },
            );

            ace.require("ace/mode/cfsite_markdown");
            aceCustomModeReady = true;
            return true;
        } catch (error) {
            console.warn("custom ace markdown mode init failed:", error);
            return false;
        }
    }

    function resolveSnippet(snippet, selected) {
        return String(snippet || "")
            .replaceAll("{sel}", selected || "")
            .replace("|", "|");
    }

    function clampInt(value, fallback, min, max) {
        const num = Number.parseInt(String(value), 10);
        if (!Number.isFinite(num)) return fallback;
        return Math.max(min, Math.min(max, num));
    }

    function buildTableSnippet(style, colsInput, rowsInput, headerRowsInput, withMerge) {
        const styleKind = style === "three" ? "three" : style === "tuack" ? "tuack" : "plain";
        const cols = clampInt(colsInput, 4, 1, 12);
        const rows = clampInt(rowsInput, 6, 1, 50);
        const headerRows = clampInt(
            headerRowsInput,
            styleKind === "plain" ? 1 : 1,
            styleKind === "plain" ? 1 : 0,
            6,
        );

        const lines = [];
        if (styleKind !== "plain") {
            lines.push(`::cute-table{${styleKind}}`);
        }

        for (let h = 0; h < headerRows; h += 1) {
            const row = Array.from({ length: cols }, (_, c) =>
                h === 0 ? `列${c + 1}` : `副头${h + 1}-${c + 1}`,
            );
            lines.push(`| ${row.join(" | ")} |`);
        }

        const aligns = Array.from({ length: cols }, () => ":-:").join(" | ");
        lines.push(`| ${aligns} |`);

        const body = [];
        for (let r = 0; r < rows; r += 1) {
            body.push(Array.from({ length: cols }, (_, c) => `R${r + 1}C${c + 1}`));
        }

        if (withMerge && rows >= 3 && cols >= 3) {
            body[1][0] = "^";
            body[1][1] = "<";
            body[2][2] = "^";
        }

        for (const row of body) {
            lines.push(`| ${row.join(" | ")} |`);
        }

        return lines.join("\n") + "\n";
    }

    export function initMarkdownEditor(root) {
        if (!(root instanceof HTMLElement) || root.dataset.mdInitialized === "1") return;
        root.dataset.mdInitialized = "1";

        const prefix = root.dataset.mdPrefix;
        if (!prefix) return;

        const inputEl = document.getElementById(`${prefix}-input`);
        const aceHostEl = document.getElementById(`${prefix}-ide`);
        const statusEl = document.getElementById(`${prefix}-ide-status`);
        const previewEl = document.getElementById(`${prefix}-preview`);
        const toolbarEl = document.getElementById(`${prefix}-toolbar`);
        const toolbarLeftEl = document.getElementById(`${prefix}-toolbar-left`);
        const splitEl = document.getElementById(`${prefix}-split`);
        const dividerEl = document.getElementById(`${prefix}-divider`);
        const paneEditorEl = document.getElementById(`${prefix}-pane-editor`);
        const panePreviewEl = document.getElementById(`${prefix}-pane-preview`);
        const toolDialogEl = document.getElementById(`${prefix}-tool-dialog`);
        const toolDialogTitleEl = document.getElementById(`${prefix}-tool-dialog-title`);
        const toolDialogApplyBtn = document.getElementById(`${prefix}-dialog-apply`);
        const toolDialogCancelBtn = document.getElementById(`${prefix}-dialog-cancel`);

        const dialogLinkTextEl = document.getElementById(`${prefix}-dialog-link-text`);
        const dialogLinkUrlEl = document.getElementById(`${prefix}-dialog-link-url`);
        const dialogLinkTitleEl = document.getElementById(`${prefix}-dialog-link-title`);
        const dialogImageAltEl = document.getElementById(`${prefix}-dialog-image-alt`);
        const dialogImageUrlEl = document.getElementById(`${prefix}-dialog-image-url`);
        const dialogImageTitleEl = document.getElementById(`${prefix}-dialog-image-title`);
        const dialogCalloutKindEl = document.getElementById(`${prefix}-dialog-callout-kind`);
        const dialogCalloutTitleEl = document.getElementById(`${prefix}-dialog-callout-title`);
        const dialogCalloutOpenEl = document.getElementById(`${prefix}-dialog-callout-open`);
        const dialogTableStyleEl = document.getElementById(`${prefix}-dialog-table-style`);
        const dialogTableColsEl = document.getElementById(`${prefix}-dialog-table-cols`);
        const dialogTableRowsEl = document.getElementById(`${prefix}-dialog-table-rows`);
        const dialogTableHeadRowsEl = document.getElementById(`${prefix}-dialog-table-headrows`);
        const dialogTableMergeEl = document.getElementById(`${prefix}-dialog-table-merge`);

        if (!(inputEl instanceof HTMLTextAreaElement) || !(aceHostEl instanceof HTMLElement)) return;

        const renderer = new ExtendedRenderer();
        let editor = null;
        let splitRatio = 50;
        let currentView = "split";
        let currentDialogKind = "";
        let fallbackBound = false;
        let syncingFromEditor = false;
        let syncingFromPreview = false;

        inputEl.classList.remove("hidden");

        function renderPreview(markdown) {
            if (!previewEl) return;
            previewEl.innerHTML = renderExtendedMarkdown(markdown, renderer);
        }

        function getEditorValue() {
            if (editor) return editor.getValue();
            return inputEl.value || "";
        }

        function setEditorValue(value) {
            const nextValue = String(value ?? "");
            inputEl.value = nextValue;
            if (editor) {
                editor.setValue(nextValue, -1);
            }
            renderPreview(nextValue);
            updateStatus();
        }

        function updateStatus() {
            if (!statusEl) return;

            if (!editor) {
                const pos = inputEl.selectionStart || 0;
                const text = inputEl.value.slice(0, pos);
                const lines = text.split("\n");
                statusEl.textContent = `行 ${lines.length}, 列 ${(lines.at(-1) || "").length + 1}`;
                return;
            }

            const pos = editor.getCursorPosition();
            statusEl.textContent = `行 ${pos.row + 1}, 列 ${pos.column + 1}`;
        }

        function bindFallbackOnce() {
            if (fallbackBound) return;
            fallbackBound = true;

            inputEl.addEventListener("input", () => {
                renderPreview(inputEl.value);
                updateStatus();
            });
            inputEl.addEventListener("keyup", updateStatus);
            inputEl.addEventListener("click", updateStatus);
            inputEl.addEventListener("scroll", syncPreviewFromEditor);
        }

        function getEditorScrollRatio() {
            if (editor) {
                const session = editor.getSession();
                const top = session.getScrollTop();
                const lineHeight = editor.renderer.lineHeight || 16;
                const fullHeight = session.getScreenLength() * lineHeight;
                const viewHeight = editor.renderer.$size.scrollerHeight || 1;
                const max = Math.max(1, fullHeight - viewHeight);
                return Math.max(0, Math.min(1, top / max));
            }

            const max = Math.max(1, inputEl.scrollHeight - inputEl.clientHeight);
            return Math.max(0, Math.min(1, inputEl.scrollTop / max));
        }

        function setEditorScrollRatio(ratio) {
            const nextRatio = Math.max(0, Math.min(1, ratio));
            if (editor) {
                const session = editor.getSession();
                const lineHeight = editor.renderer.lineHeight || 16;
                const fullHeight = session.getScreenLength() * lineHeight;
                const viewHeight = editor.renderer.$size.scrollerHeight || 1;
                const max = Math.max(0, fullHeight - viewHeight);
                session.setScrollTop(nextRatio * max);
                return;
            }

            const max = Math.max(0, inputEl.scrollHeight - inputEl.clientHeight);
            inputEl.scrollTop = nextRatio * max;
        }

        function syncPreviewFromEditor() {
            if (!(panePreviewEl instanceof HTMLElement) || syncingFromPreview) return;
            syncingFromEditor = true;
            const ratio = getEditorScrollRatio();
            const maxPreview = Math.max(0, panePreviewEl.scrollHeight - panePreviewEl.clientHeight);
            panePreviewEl.scrollTop = ratio * maxPreview;
            syncingFromEditor = false;
        }

        function syncEditorFromPreview() {
            if (!(panePreviewEl instanceof HTMLElement) || syncingFromEditor) return;
            syncingFromPreview = true;
            const maxPreview = Math.max(1, panePreviewEl.scrollHeight - panePreviewEl.clientHeight);
            setEditorScrollRatio(panePreviewEl.scrollTop / maxPreview);
            syncingFromPreview = false;
        }

        function resolveAceTheme() {
            const isDark = document.documentElement.classList.contains("dark-theme");
            return isDark ? "ace/theme/tomorrow_night_eighties" : "ace/theme/chrome";
        }

        function applySplitRatio(nextRatio) {
            splitRatio = Math.max(18, Math.min(82, nextRatio));
            if (!(paneEditorEl instanceof HTMLElement) || !(panePreviewEl instanceof HTMLElement) || currentView !== "split") {
                return;
            }

            paneEditorEl.style.flex = `0 0 ${splitRatio}%`;
            panePreviewEl.style.flex = `0 0 ${100 - splitRatio}%`;
            editor?.resize();
        }

        function setViewMode(mode) {
            if (!(paneEditorEl instanceof HTMLElement) || !(panePreviewEl instanceof HTMLElement) || !(dividerEl instanceof HTMLElement)) {
                return;
            }

            currentView = mode;
            toolbarEl?.querySelectorAll("[data-view]").forEach((btn) => {
                if (!(btn instanceof HTMLElement)) return;
                btn.classList.toggle("is-active", btn.dataset.view === mode);
            });

            if (mode === "editor") {
                paneEditorEl.classList.remove("hidden");
                panePreviewEl.classList.add("hidden");
                dividerEl.classList.add("hidden");
                paneEditorEl.style.flex = "1 1 100%";
            } else if (mode === "preview") {
                paneEditorEl.classList.add("hidden");
                panePreviewEl.classList.remove("hidden");
                dividerEl.classList.add("hidden");
                panePreviewEl.style.flex = "1 1 100%";
            } else {
                paneEditorEl.classList.remove("hidden");
                panePreviewEl.classList.remove("hidden");
                dividerEl.classList.remove("hidden");
                applySplitRatio(splitRatio);
            }

            editor?.resize();
        }

        function getCurrentSelectionText() {
            if (editor) {
                const range = editor.getSelectionRange();
                return editor.session.getTextRange(range);
            }
            const start = inputEl.selectionStart || 0;
            const end = inputEl.selectionEnd || start;
            return inputEl.value.slice(start, end);
        }

        function insertSnippet(snippet) {
            const raw = String(snippet || "");

            if (editor) {
                const range = editor.getSelectionRange();
                const selected = editor.session.getTextRange(range);
                const resolved = resolveSnippet(raw, selected);
                const cursorOffset = resolved.indexOf("|");
                const text = resolved.replace("|", "");
                const startIndex = editor.session.doc.positionToIndex(range.start, 0);
                editor.session.replace(range, text);
                inputEl.value = editor.getValue();
                const cursorIndex = startIndex + (cursorOffset >= 0 ? cursorOffset : text.length);
                const cursorPos = editor.session.doc.indexToPosition(cursorIndex, 0);
                editor.selection.clearSelection();
                editor.moveCursorToPosition(cursorPos);
                editor.focus();
                renderPreview(editor.getValue());
                updateStatus();
                return;
            }

            const start = inputEl.selectionStart || 0;
            const end = inputEl.selectionEnd || start;
            const selected = inputEl.value.slice(start, end);
            const resolved = resolveSnippet(raw, selected);
            const cursorOffset = resolved.indexOf("|");
            const text = resolved.replace("|", "");

            inputEl.value = inputEl.value.slice(0, start) + text + inputEl.value.slice(end);
            const nextPos = start + (cursorOffset >= 0 ? cursorOffset : text.length);
            inputEl.selectionStart = nextPos;
            inputEl.selectionEnd = nextPos;
            inputEl.focus();
            renderPreview(inputEl.value);
            updateStatus();
        }

        function closeCollapsedGroupMenus() {
            toolbarLeftEl?.querySelectorAll(".md-tool-group.is-open").forEach((el) => {
                el.classList.remove("is-open");
            });
        }

        function openToolDialog(kind, button) {
            if (!(toolDialogEl instanceof HTMLElement)) return;
            currentDialogKind = kind;

            toolDialogEl.querySelectorAll("[data-dialog-panel]").forEach((panel) => {
                panel.classList.add("hidden");
            });
            const panel = toolDialogEl.querySelector(`[data-dialog-panel="${kind}"]`);
            if (panel) panel.classList.remove("hidden");

            const selected = getCurrentSelectionText() || "text";
            if (kind === "link") {
                if (toolDialogTitleEl) toolDialogTitleEl.textContent = "插入链接";
                if (dialogLinkTextEl instanceof HTMLInputElement) dialogLinkTextEl.value = selected;
                if (dialogLinkUrlEl instanceof HTMLInputElement) dialogLinkUrlEl.value = "";
                if (dialogLinkTitleEl instanceof HTMLInputElement) dialogLinkTitleEl.value = "";
                dialogLinkTextEl?.focus();
            } else if (kind === "image") {
                if (toolDialogTitleEl) toolDialogTitleEl.textContent = "插入图片";
                if (dialogImageAltEl instanceof HTMLInputElement) {
                    dialogImageAltEl.value = selected === "text" ? "alt" : selected;
                }
                if (dialogImageUrlEl instanceof HTMLInputElement) dialogImageUrlEl.value = "";
                if (dialogImageTitleEl instanceof HTMLInputElement) dialogImageTitleEl.value = "";
                dialogImageAltEl?.focus();
            } else if (kind === "callout") {
                if (toolDialogTitleEl) toolDialogTitleEl.textContent = "插入提示块";
                const calloutKind = button?.dataset.calloutKind || "info";
                if (dialogCalloutKindEl instanceof HTMLSelectElement) dialogCalloutKindEl.value = calloutKind;
                if (dialogCalloutTitleEl instanceof HTMLInputElement) {
                    const defaults = { info: "提示", success: "成功", warning: "警告", error: "错误" };
                    dialogCalloutTitleEl.value = defaults[calloutKind] || "提示";
                }
                if (dialogCalloutOpenEl instanceof HTMLInputElement) dialogCalloutOpenEl.checked = true;
                dialogCalloutTitleEl?.focus();
            } else if (kind === "table") {
                if (toolDialogTitleEl) toolDialogTitleEl.textContent = "插入表格";
                if (dialogTableStyleEl instanceof HTMLSelectElement) {
                    dialogTableStyleEl.value = button?.dataset.tableStyle || "plain";
                }
                if (dialogTableColsEl instanceof HTMLInputElement) dialogTableColsEl.value = "4";
                if (dialogTableRowsEl instanceof HTMLInputElement) dialogTableRowsEl.value = "6";
                if (dialogTableHeadRowsEl instanceof HTMLInputElement) dialogTableHeadRowsEl.value = "1";
                if (dialogTableMergeEl instanceof HTMLInputElement) dialogTableMergeEl.checked = false;
                dialogTableColsEl?.focus();
            }

            closeCollapsedGroupMenus();
            toolDialogEl.classList.remove("hidden");
            toolDialogEl.classList.add("is-open");
            toolDialogEl.setAttribute("aria-hidden", "false");
        }

        function closeToolDialog() {
            if (!(toolDialogEl instanceof HTMLElement)) return;
            toolDialogEl.classList.add("hidden");
            toolDialogEl.classList.remove("is-open");
            toolDialogEl.setAttribute("aria-hidden", "true");
            currentDialogKind = "";
            editor?.focus();
        }

        function applyToolDialog() {
            if (!currentDialogKind) return;

            let snippet = "";
            if (currentDialogKind === "link") {
                const text = dialogLinkTextEl?.value?.trim() || "text";
                const href = dialogLinkUrlEl?.value?.trim() || "|";
                const title = dialogLinkTitleEl?.value?.trim();
                snippet = `[${text}](${href}${title ? ` "${title}"` : ""})`;
            } else if (currentDialogKind === "image") {
                const alt = dialogImageAltEl?.value?.trim() || "alt";
                const src = dialogImageUrlEl?.value?.trim() || "|";
                const title = dialogImageTitleEl?.value?.trim();
                snippet = `![${alt}](${src}${title ? ` "${title}"` : ""})`;
            } else if (currentDialogKind === "callout") {
                const kind = dialogCalloutKindEl?.value || "info";
                const title = dialogCalloutTitleEl?.value?.trim() || "提示";
                const open = dialogCalloutOpenEl?.checked ? "{open}" : "";
                snippet = `:::${kind}[${title}]${open}\n|\n:::\n`;
            } else if (currentDialogKind === "table") {
                snippet = buildTableSnippet(
                    dialogTableStyleEl?.value || "plain",
                    dialogTableColsEl?.value || "4",
                    dialogTableRowsEl?.value || "6",
                    dialogTableHeadRowsEl?.value || "1",
                    Boolean(dialogTableMergeEl?.checked),
                );
            }

            if (snippet) insertSnippet(snippet);
            closeToolDialog();
        }

        function relayoutToolbarGroups() {
            if (!(toolbarLeftEl instanceof HTMLElement)) return;
            const groups = Array.from(toolbarLeftEl.querySelectorAll(".md-tool-group"));
            groups.forEach((group) => {
                group.classList.remove("is-collapsed", "is-open");
            });

            for (
                let idx = groups.length - 1;
                idx >= 0 && toolbarLeftEl.scrollWidth > toolbarLeftEl.clientWidth;
                idx -= 1
            ) {
                groups[idx].classList.add("is-collapsed");
            }
        }

        function bindToolbarResponsiveLayout() {
            if (!(toolbarEl instanceof HTMLElement) || !(toolbarLeftEl instanceof HTMLElement)) return;

            relayoutToolbarGroups();
            window.addEventListener("resize", relayoutToolbarGroups, { passive: true });

            if ("ResizeObserver" in window) {
                const observer = new ResizeObserver(() => {
                    relayoutToolbarGroups();
                });
                observer.observe(toolbarEl);
                observer.observe(toolbarLeftEl);
            }

            document.addEventListener("click", (event) => {
                const target = event.target;
                if (!(target instanceof Node)) return;
                if (!toolbarEl.contains(target)) closeCollapsedGroupMenus();
            });

            let closeTimer = 0;
            const clearTimer = () => {
                if (!closeTimer) return;
                window.clearTimeout(closeTimer);
                closeTimer = 0;
            };

            toolbarLeftEl.addEventListener("pointerover", (event) => {
                const target = event.target;
                if (!(target instanceof Element)) return;
                const group = target.closest(".md-tool-group");
                if (!group || !group.classList.contains("is-collapsed")) return;
                clearTimer();
                closeCollapsedGroupMenus();
                group.classList.add("is-open");
            });

            toolbarLeftEl.addEventListener("pointerout", (event) => {
                const target = event.target;
                if (!(target instanceof Element)) return;
                const group = target.closest(".md-tool-group");
                if (!group || !group.classList.contains("is-collapsed")) return;

                const related = event.relatedTarget;
                if (related instanceof Node && group.contains(related)) return;

                clearTimer();
                closeTimer = window.setTimeout(() => {
                    group.classList.remove("is-open");
                }, 120);
            });
        }

        function bindSplitDrag() {
            if (!(dividerEl instanceof HTMLElement) || !(splitEl instanceof HTMLElement)) return;

            let dragging = false;

            const onMove = (event) => {
                if (!dragging) return;
                const rect = splitEl.getBoundingClientRect();
                if (rect.width <= 0) return;
                const ratio = ((event.clientX - rect.left) / rect.width) * 100;
                applySplitRatio(ratio);
            };

            const onUp = () => {
                if (!dragging) return;
                dragging = false;
                document.body.classList.remove("md-resizing");
                window.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
            };

            dividerEl.addEventListener("pointerdown", (event) => {
                if (currentView !== "split") return;
                dragging = true;
                document.body.classList.add("md-resizing");
                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", onUp);
                event.preventDefault();
            });
        }

        async function copyMarkdown() {
            const text = getEditorValue();
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    throw new Error("clipboard unavailable");
                }
            } catch {
                const textarea = document.createElement("textarea");
                textarea.value = text;
                textarea.style.position = "fixed";
                textarea.style.left = "-9999px";
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                try {
                    document.execCommand("copy");
                } finally {
                    textarea.remove();
                }
            }
        }

        function bindToolbar() {
            if (!(toolbarEl instanceof HTMLElement)) return;

            toolbarEl.addEventListener("click", (event) => {
                const target = event.target;
                if (!(target instanceof Element)) return;
                const button = target.closest("button");
                if (!(button instanceof HTMLButtonElement)) return;

                if (button.dataset.groupToggle !== undefined) {
                    const group = button.closest(".md-tool-group");
                    if (!group || !group.classList.contains("is-collapsed")) return;
                    const nextOpen = !group.classList.contains("is-open");
                    closeCollapsedGroupMenus();
                    if (nextOpen) group.classList.add("is-open");
                    return;
                }

                if (button.dataset.view) {
                    setViewMode(button.dataset.view);
                    return;
                }

                if (button.dataset.action === "copy-markdown") {
                    void copyMarkdown();
                    return;
                }

                if (button.dataset.dialog) {
                    openToolDialog(button.dataset.dialog, button);
                    return;
                }

                if (button.dataset.snippet) {
                    insertSnippet(button.dataset.snippet);
                }
            });
        }

        function bindToolDialog() {
            if (!(toolDialogEl instanceof HTMLElement)) return;

            toolDialogEl.addEventListener("click", (event) => {
                const target = event.target;
                if (!(target instanceof Element)) return;
                if (target.closest("[data-dialog-close]")) closeToolDialog();
            });

            toolDialogApplyBtn?.addEventListener("click", applyToolDialog);
            toolDialogCancelBtn?.addEventListener("click", closeToolDialog);
            window.addEventListener("keydown", (event) => {
                if (event.key !== "Escape") return;
                if (!toolDialogEl.classList.contains("is-open")) return;
                closeToolDialog();
            });
        }

        async function ensureEditor() {
            if (editor || !(aceHostEl instanceof HTMLElement)) return;

            bindFallbackOnce();

            try {
                await ensureAceLoaded();
                await ensureAceDepsLoaded();

                const ace = window.ace;
                if (!ace) throw new Error("ace not found on window");

                editor = ace.edit(aceHostEl.id);
                editor.setTheme(resolveAceTheme());
                const useCustomMode = ensureAceCustomMode();
                editor.session.setMode(useCustomMode ? "ace/mode/cfsite_markdown" : "ace/mode/markdown");
                editor.session.setUseWrapMode(true);
                editor.setShowPrintMargin(false);
                editor.setOptions({
                    fontSize: "15px",
                    showLineNumbers: true,
                    highlightActiveLine: true,
                    highlightGutterLine: true,
                    tabSize: 2,
                    useSoftTabs: true,
                });

                editor.setValue(inputEl.value || "", -1);
                inputEl.classList.add("hidden");

                editor.session.on("change", () => {
                    inputEl.value = editor.getValue();
                    renderPreview(inputEl.value);
                    updateStatus();
                    syncPreviewFromEditor();
                });
                editor.selection.on("changeCursor", updateStatus);
                editor.session.on("changeScrollTop", syncPreviewFromEditor);
                editor.resize();
                updateStatus();
            } catch (error) {
                console.error("ace editor load failed, fallback to textarea:", error);
                aceHostEl.classList.add("hidden");
                inputEl.classList.remove("hidden");
                bindFallbackOnce();
            }
        }

        bindFallbackOnce();
        bindToolbar();
        bindToolDialog();
        bindToolbarResponsiveLayout();
        bindSplitDrag();
        panePreviewEl?.addEventListener("scroll", syncEditorFromPreview, { passive: true });

        renderPreview(inputEl.value || "");
        updateStatus();
        setViewMode("split");
        void ensureEditor();

        const observer = new MutationObserver(() => {
            if (!editor) return;
            editor.setTheme(resolveAceTheme());
        });
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });
    }

