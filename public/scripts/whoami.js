import { marked, Renderer } from "https://cdn.jsdmirror.com/npm/marked/lib/marked.esm.js";

const DEFAULT_BIO = "这个人很懒，什么都没写。";
const DEFAULT_INTRO = "这个人很懒，连个人简介都没写。";
const DEFAULT_AVATAR =
    "https://cdn.jsdmirror.com/gh/FlowerAccepted/gh-src-for-cfsite-dns@main/defult_avatar.png";
const ACE_SCRIPT_URL =
    "https://cdn.jsdmirror.com/npm/ace-builds@1.43.3/src-min-noconflict/ace.js";
const HIGHLIGHT_JS_URL =
    "https://cdn.jsdmirror.com/npm/highlight.js@11.11.1/lib/common.min.js";
const HIGHLIGHT_CSS_URL =
    "https://cdn.jsdmirror.com/npm/highlight.js@11.11.1/styles/atom-one-light.min.css";
const CUTE_TABLE_MARKER = "<!--__LUOGU_CUTE_TABLE__-->";

let aceLoadPromise = null;
let highlightLoadPromise = null;

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function escapeRegExp(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const exists = Array.from(document.scripts).find((s) => s.src === src);
        if (exists) {
            exists.addEventListener("load", () => resolve(), { once: true });
            exists.addEventListener(
                "error",
                () => reject(new Error(`script load failed: ${src}`)),
                { once: true },
            );
            if (exists.dataset.loaded === "1") resolve();
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
        script.addEventListener(
            "error",
            () => reject(new Error(`script load failed: ${src}`)),
            { once: true },
        );
        document.head.appendChild(script);
    });
}

function ensureHighlightCss() {
    const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(
        (link) => link.href === HIGHLIGHT_CSS_URL,
    );
    if (exists) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = HIGHLIGHT_CSS_URL;
    document.head.appendChild(link);
}

function ensureHighlightLoaded() {
    if (window.hljs) {
        ensureHighlightCss();
        return Promise.resolve();
    }
    if (!highlightLoadPromise) {
        ensureHighlightCss();
        highlightLoadPromise = loadScript(HIGHLIGHT_JS_URL);
    }
    return highlightLoadPromise;
}

function ensureAceLoaded() {
    if (window.ace) return Promise.resolve();
    if (!aceLoadPromise) {
        aceLoadPromise = loadScript(ACE_SCRIPT_URL);
    }
    return aceLoadPromise;
}

function parseFenceInfo(rawLang) {
    const parts = String(rawLang || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    let language = "plaintext";
    let lineNumbers = false;
    let lineHighlights = "";

    for (const part of parts) {
        if (part === "line-numbers") {
            lineNumbers = true;
            continue;
        }
        if (part.startsWith("lines=")) {
            lineHighlights = part.slice("lines=".length);
            continue;
        }
        if (language === "plaintext") language = part;
    }

    return { language, lineNumbers, lineHighlights };
}

function parseLineSpec(spec) {
    const result = new Set();
    if (!spec) return result;

    for (const chunk of String(spec).split(",")) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;
        if (trimmed.includes("-")) {
            const [a, b] = trimmed.split("-");
            const start = Number.parseInt(a, 10);
            const end = Number.parseInt(b, 10);
            if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
            for (let n = start; n <= end; n += 1) result.add(n);
        } else {
            const line = Number.parseInt(trimmed, 10);
            if (Number.isFinite(line)) result.add(line);
        }
    }

    return result;
}

function fallbackHighlightCode(source, language) {
    const lang = String(language || "").toLowerCase();
    const keywordsByLang = {
        cpp: [
            "auto",
            "bool",
            "break",
            "case",
            "catch",
            "class",
            "const",
            "constexpr",
            "continue",
            "default",
            "delete",
            "do",
            "double",
            "else",
            "enum",
            "explicit",
            "extern",
            "false",
            "float",
            "for",
            "friend",
            "goto",
            "if",
            "inline",
            "int",
            "long",
            "namespace",
            "new",
            "noexcept",
            "nullptr",
            "operator",
            "private",
            "protected",
            "public",
            "return",
            "short",
            "signed",
            "sizeof",
            "static",
            "struct",
            "switch",
            "template",
            "this",
            "throw",
            "true",
            "try",
            "typedef",
            "typename",
            "union",
            "unsigned",
            "using",
            "virtual",
            "void",
            "volatile",
            "while",
        ],
        c: [
            "auto",
            "break",
            "case",
            "char",
            "const",
            "continue",
            "default",
            "do",
            "double",
            "else",
            "enum",
            "extern",
            "float",
            "for",
            "goto",
            "if",
            "inline",
            "int",
            "long",
            "register",
            "restrict",
            "return",
            "short",
            "signed",
            "sizeof",
            "static",
            "struct",
            "switch",
            "typedef",
            "union",
            "unsigned",
            "void",
            "volatile",
            "while",
        ],
        js: [
            "await",
            "break",
            "case",
            "catch",
            "class",
            "const",
            "continue",
            "debugger",
            "default",
            "delete",
            "do",
            "else",
            "export",
            "extends",
            "false",
            "finally",
            "for",
            "function",
            "if",
            "import",
            "in",
            "instanceof",
            "let",
            "new",
            "null",
            "return",
            "super",
            "switch",
            "this",
            "throw",
            "true",
            "try",
            "typeof",
            "var",
            "void",
            "while",
            "yield",
        ],
        ts: [
            "as",
            "async",
            "await",
            "boolean",
            "break",
            "case",
            "catch",
            "class",
            "const",
            "continue",
            "declare",
            "default",
            "do",
            "else",
            "enum",
            "export",
            "extends",
            "false",
            "finally",
            "for",
            "function",
            "if",
            "implements",
            "import",
            "in",
            "infer",
            "interface",
            "let",
            "module",
            "new",
            "null",
            "number",
            "private",
            "protected",
            "public",
            "readonly",
            "return",
            "string",
            "switch",
            "this",
            "throw",
            "true",
            "try",
            "type",
            "typeof",
            "undefined",
            "var",
            "void",
            "while",
        ],
        py: [
            "and",
            "as",
            "assert",
            "async",
            "await",
            "break",
            "class",
            "continue",
            "def",
            "del",
            "elif",
            "else",
            "except",
            "False",
            "finally",
            "for",
            "from",
            "global",
            "if",
            "import",
            "in",
            "is",
            "lambda",
            "None",
            "nonlocal",
            "not",
            "or",
            "pass",
            "raise",
            "return",
            "True",
            "try",
            "while",
            "with",
            "yield",
        ],
        java: [
            "abstract",
            "assert",
            "boolean",
            "break",
            "byte",
            "case",
            "catch",
            "char",
            "class",
            "const",
            "continue",
            "default",
            "do",
            "double",
            "else",
            "enum",
            "extends",
            "false",
            "final",
            "finally",
            "float",
            "for",
            "if",
            "implements",
            "import",
            "instanceof",
            "int",
            "interface",
            "long",
            "native",
            "new",
            "null",
            "package",
            "private",
            "protected",
            "public",
            "return",
            "short",
            "static",
            "strictfp",
            "super",
            "switch",
            "synchronized",
            "this",
            "throw",
            "throws",
            "transient",
            "true",
            "try",
            "void",
            "volatile",
            "while",
        ],
        rust: [
            "as",
            "async",
            "await",
            "break",
            "const",
            "continue",
            "crate",
            "else",
            "enum",
            "extern",
            "false",
            "fn",
            "for",
            "if",
            "impl",
            "in",
            "let",
            "loop",
            "match",
            "mod",
            "move",
            "mut",
            "pub",
            "ref",
            "return",
            "self",
            "Self",
            "static",
            "struct",
            "super",
            "trait",
            "true",
            "type",
            "unsafe",
            "use",
            "where",
            "while",
        ],
        go: [
            "break",
            "case",
            "chan",
            "const",
            "continue",
            "default",
            "defer",
            "else",
            "fallthrough",
            "false",
            "for",
            "func",
            "go",
            "goto",
            "if",
            "import",
            "interface",
            "map",
            "package",
            "range",
            "return",
            "select",
            "struct",
            "switch",
            "true",
            "type",
            "var",
        ],
        sh: [
            "if",
            "then",
            "else",
            "elif",
            "fi",
            "for",
            "while",
            "do",
            "done",
            "case",
            "esac",
            "function",
            "in",
            "select",
            "time",
        ],
    };

    const normalizedLang =
        lang === "javascript"
            ? "js"
            : lang === "typescript"
              ? "ts"
              : lang === "python"
              ? "py"
                : lang === "c++"
                  ? "cpp"
                  : lang === "cxx"
                    ? "cpp"
                    : lang === "node"
                      ? "js"
                      : lang === "jsx"
                        ? "js"
                        : lang === "tsx"
                          ? "ts"
                          : lang === "shell"
                            ? "sh"
                            : lang === "bash"
                              ? "sh"
                              : lang === "zsh"
                                ? "sh"
                  : lang;

    let text = String(source || "");
    const globalTokens = [];
    const stashGlobal = (regex, cls) => {
        text = text.replace(regex, (match) => {
            const marker = `#{${globalTokens.length}}#`;
            globalTokens.push({ value: match, cls });
            return marker;
        });
    };

    if (
        ["c", "cpp", "cs", "go", "java", "js", "php", "rust", "swift", "ts", "kotlin"].includes(
            normalizedLang,
        )
    ) {
        stashGlobal(/\/\*[\s\S]*?\*\//g, "hljs-comment");
        stashGlobal(/\/\/[^\n]*/g, "hljs-comment");
    }
    if (["py", "sh", "yaml", "yml", "toml", "ini"].includes(normalizedLang)) {
        stashGlobal(/(^|\s)#.*$/gm, "hljs-comment");
    }
    if (["c", "cpp"].includes(normalizedLang)) {
        stashGlobal(/^\s*#\s*[a-zA-Z_]\w*[^\n]*$/gm, "hljs-meta");
    }
    stashGlobal(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, "hljs-string");

    const kw = keywordsByLang[normalizedLang] || keywordsByLang.js;

    function highlightPlain(segment) {
        if (!segment) return "";

        let raw = segment;
        const localTokens = [];
        const stashLocal = (regex, cls) => {
            raw = raw.replace(regex, (match) => {
                const marker = `@{${localTokens.length}}@`;
                localTokens.push({ value: match, cls });
                return marker;
            });
        };

        stashLocal(/\b0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*\b/g, "hljs-number");
        stashLocal(/\b0[bB][01]+(?:_[01]+)*\b/g, "hljs-number");
        stashLocal(/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?:u|U|l|L|f|F)*\b/g, "hljs-number");
        if (kw.length > 0) {
            const kwPattern = new RegExp(`\\b(${kw.map(escapeRegExp).join("|")})\\b`, "g");
            stashLocal(kwPattern, "hljs-keyword");
        }
        stashLocal(/\b[A-Z_][A-Z0-9_]{2,}\b/g, "hljs-symbol");
        stashLocal(
            /\b(?:std|size_t|string|vector|map|set|unordered_map|unordered_set|pair|tuple|optional|bool|int|long|short|float|double|char|void|u?int(?:8|16|32|64)_t)\b/g,
            "hljs-type",
        );
        stashLocal(/\b([A-Za-z_]\w*)(?=\s*\()/g, "hljs-title");

        const escaped = escapeHtml(raw);
        return escaped.replace(/@\{(\d+)\}@/g, (_, idx) => {
            const entry = localTokens[Number.parseInt(idx, 10)];
            if (!entry) return "";
            return `<span class="${entry.cls}">${escapeHtml(entry.value)}</span>`;
        });
    }

    let html = "";
    const markerRegex = /#\{(\d+)\}#/g;
    let lastIndex = 0;
    let matched;
    while ((matched = markerRegex.exec(text)) !== null) {
        const chunk = text.slice(lastIndex, matched.index);
        html += highlightPlain(chunk);

        const tokenIndex = Number.parseInt(matched[1], 10);
        const token = globalTokens[tokenIndex];
        if (token) {
            html += `<span class="${token.cls}">${escapeHtml(token.value)}</span>`;
        }
        lastIndex = markerRegex.lastIndex;
    }
    html += highlightPlain(text.slice(lastIndex));
    return html;
}

class IntroRenderer extends Renderer {
    link({ href, tokens }) {
        const text = (tokens || []).map((t) => t.text || "").join("");
        return `<a href="${href}" class="basic-href" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }

    code(token) {
        const code = token.text || "";
        const info = parseFenceInfo(token.lang || "");
        const codeEscaped = escapeHtml(code);
        const attrs = [
            `data-language="${escapeHtml(info.language)}"`,
            `data-line-numbers="${info.lineNumbers ? "1" : "0"}"`,
            `data-line-highlights="${escapeHtml(info.lineHighlights)}"`,
        ].join(" ");

        return `<pre class="md-code-block glass-panel" ${attrs}><code class="language-${escapeHtml(info.language)}">${codeEscaped}</code></pre>`;
    }
}

function parseDirectiveStart(line) {
    const alignMatch = line.match(/^(\:{3,})align\{(center|right)\}\s*$/);
    if (alignMatch) {
        return {
            fence: alignMatch[1],
            type: "align",
            align: alignMatch[2],
        };
    }

    const epiMatch = line.match(/^(\:{3,})epigraph(?:\[(.*)\])?\s*$/);
    if (epiMatch) {
        return {
            fence: epiMatch[1],
            type: "epigraph",
            title: (epiMatch[2] || "").trim(),
        };
    }

    const panelMatch = line.match(
        /^(\:{3,})(info|success|warning|error)(?:\[(.*)\])?(?:\{(open)\})?\s*$/,
    );
    if (panelMatch) {
        return {
            fence: panelMatch[1],
            type: "panel",
            kind: panelMatch[2],
            title: (panelMatch[3] || "").trim(),
            open: panelMatch[4] === "open",
        };
    }

    return null;
}

function findDirectiveEnd(lines, startIndex, fence) {
    for (let i = startIndex; i < lines.length; i += 1) {
        if (lines[i].trim() === fence) return i;
    }
    return -1;
}

function renderDirectiveBlock(directive, innerHtml) {
    if (directive.type === "align") {
        return `<div class="md-align md-align-${directive.align}">${innerHtml}</div>`;
    }

    if (directive.type === "epigraph") {
        const title = directive.title
            ? `<figcaption>~ ${escapeHtml(directive.title)}</figcaption>`
            : "";
        return `<figure class="md-epigraph"><blockquote>${innerHtml}</blockquote>${title}</figure>`;
    }

    if (directive.type === "panel") {
        const title = directive.title || directive.kind.toUpperCase();
        return `<details class="md-admonition md-${directive.kind}" ${directive.open ? "open" : ""}><summary>${escapeHtml(title)}</summary><div class="md-admonition-body">${innerHtml}</div></details>`;
    }

    return innerHtml;
}

function preprocessLuoguMarkdown(markdown) {
    return String(markdown || "").replace(/^\s*::cute-table\{tuack\}\s*$/gm, CUTE_TABLE_MARKER);
}

function renderExtendedMarkdown(markdown, renderer) {
    const normalized = preprocessLuoguMarkdown(markdown).replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");

    function parseSegment(start, end) {
        let out = "";
        let buffer = [];

        const flush = () => {
            if (buffer.length === 0) return;
            out += marked.parse(buffer.join("\n"), {
                renderer,
                gfm: true,
                breaks: false,
            });
            buffer = [];
        };

        let i = start;
        while (i < end) {
            const directive = parseDirectiveStart(lines[i]);
            if (!directive) {
                buffer.push(lines[i]);
                i += 1;
                continue;
            }

            const closeIndex = findDirectiveEnd(lines, i + 1, directive.fence);
            if (closeIndex === -1 || closeIndex >= end) {
                buffer.push(lines[i]);
                i += 1;
                continue;
            }

            flush();
            const innerHtml = parseSegment(i + 1, closeIndex);
            out += renderDirectiveBlock(directive, innerHtml);
            i = closeIndex + 1;
        }

        flush();
        return out;
    }

    return parseSegment(0, lines.length);
}

function findCellAtColumn(row, targetColumn) {
    let col = 0;
    for (const cell of Array.from(row.cells)) {
        const span = Number.parseInt(cell.getAttribute("colspan") || "1", 10);
        if (targetColumn >= col && targetColumn < col + span) return cell;
        col += span;
    }
    return null;
}

function findUpperMergeTarget(rows, rowIndex, column) {
    for (let r = rowIndex - 1; r >= 0; r -= 1) {
        const candidate = findCellAtColumn(rows[r], column);
        if (candidate) return candidate;
    }
    return null;
}

function applyTableMerge(root) {
    const tables = root.querySelectorAll("table");

    for (const table of tables) {
        for (const row of Array.from(table.rows)) {
            for (const cell of Array.from(row.cells)) {
                if (cell.textContent.trim() !== "<") continue;
                const prev = cell.previousElementSibling;
                if (!prev) continue;
                const prevColspan = Number.parseInt(prev.getAttribute("colspan") || "1", 10);
                prev.setAttribute("colspan", String(prevColspan + 1));
                cell.remove();
            }
        }

        const rows = Array.from(table.rows);
        for (let r = 1; r < rows.length; r += 1) {
            const row = rows[r];
            let col = 0;

            for (const cell of Array.from(row.cells)) {
                const span = Number.parseInt(cell.getAttribute("colspan") || "1", 10);
                const marker = cell.textContent.trim();

                if (marker === "^") {
                    const upper = findUpperMergeTarget(rows, r, col);
                    if (upper) {
                        const upperRowspan = Number.parseInt(upper.getAttribute("rowspan") || "1", 10);
                        upper.setAttribute("rowspan", String(upperRowspan + 1));
                        cell.remove();
                    }
                }

                col += span;
            }
        }
    }
}

function applyCuteTable(root) {
    const markers = Array.from(root.childNodes).filter(
        (node) => node.nodeType === Node.COMMENT_NODE && node.nodeValue === "__LUOGU_CUTE_TABLE__",
    );

    for (const marker of markers) {
        let next = marker.nextSibling;
        while (next && next.nodeType === Node.TEXT_NODE && !next.textContent.trim()) {
            next = next.nextSibling;
        }
        if (next && next.nodeType === Node.ELEMENT_NODE && next.tagName === "TABLE") {
            next.classList.add("md-cute-table", "md-cute-table-tuack");
        }
        marker.remove();
    }
}

function applyCodeRendering(root) {
    const codeBlocks = root.querySelectorAll("pre.md-code-block");

    for (const pre of codeBlocks) {
        const code = pre.querySelector("code");
        if (!code) continue;

        const language = pre.dataset.language || "";
        if (window.hljs) {
            window.hljs.highlightElement(code);
        } else {
            code.innerHTML = fallbackHighlightCode(code.textContent || "", language);
            code.classList.add("hljs");
        }

        const lineNumbers = pre.dataset.lineNumbers === "1";
        const highlightSet = parseLineSpec(pre.dataset.lineHighlights || "");

        if (!lineNumbers && highlightSet.size === 0) continue;

        const htmlLines = code.innerHTML.split("\n");
        code.innerHTML = htmlLines
            .map((lineHtml, i) => {
                const lineNo = i + 1;
                const highlighted = highlightSet.has(lineNo) ? " is-highlighted" : "";
                const safeLine = lineHtml.length > 0 ? lineHtml : " ";
                return `<span class="md-code-line${highlighted}" data-line="${lineNo}">${safeLine}</span>`;
            })
            .join("");

        if (lineNumbers) pre.classList.add("has-line-numbers");
    }
}

function finalizeMarkdownHtml(root) {
    applyCuteTable(root);
    applyTableMerge(root);
    applyCodeRendering(root);
}

function showUnauthModal(unauthModal, profileCard) {
    profileCard?.classList.add("hidden");
    unauthModal?.classList.remove("hidden");
    unauthModal?.classList.add("flex");
}

function hideUnauthModal(unauthModal) {
    unauthModal?.classList.remove("flex");
    unauthModal?.classList.add("hidden");
}

function renderMarkdown(targetEl, markdown, renderer) {
    if (!targetEl) return;
    const source = (markdown || "").trim() || DEFAULT_INTRO;
    const html = renderExtendedMarkdown(source, renderer);
    targetEl.innerHTML = html;
    finalizeMarkdownHtml(targetEl);
}

function resolveSnippet(snippet, selected) {
    const hasSelection = Boolean(selected);
    const fallbackSel = snippet.includes("](") ? "text" : "";
    return snippet.replaceAll("{sel}", hasSelection ? selected : fallbackSel);
}

export function initWhoami() {
    const API_BASE = window.__WHOAMI_API_BASE__;
    if (!API_BASE) {
        throw new Error("API_BASE is missing on window.__WHOAMI_API_BASE__");
    }

    const profileCard = document.getElementById("profile-card");
    const unauthModal = document.getElementById("un-auth");
    const goLoginBtn = document.getElementById("go-login");

    const avatarEl = document.getElementById("avatar");
    const nicknameEl = document.getElementById("nickname");
    const usernameEl = document.getElementById("username");

    const bioDisplayEl = document.getElementById("bio-display");
    const bioEditorEl = document.getElementById("bio-editor");
    const bioInputEl = document.getElementById("bio-input");
    const bioCancelBtn = document.getElementById("bio-cancel");
    const bioSaveBtn = document.getElementById("bio-save");

    const introEditBtn = document.getElementById("intro-edit-btn");
    const introViewEl = document.getElementById("intro-view");
    const introRenderEl = document.getElementById("intro-render");
    const introEditorEl = document.getElementById("intro-editor");
    const introInputEl = document.getElementById("intro-input");
    const introAceHostEl = document.getElementById("intro-ide");
    const introAceStatusEl = document.getElementById("intro-ide-status");
    const introPreviewEl = document.getElementById("intro-preview");
    const introCancelBtn = document.getElementById("intro-cancel");
    const introSaveBtn = document.getElementById("intro-save");

    const introToolbarEl = document.getElementById("intro-toolbar");
    const introSplitEl = document.getElementById("intro-split");
    const introDividerEl = document.getElementById("intro-divider");
    const introPaneEditorEl = document.getElementById("intro-pane-editor");
    const introPanePreviewEl = document.getElementById("intro-pane-preview");
    const mainContentEl =
        document.querySelector("main.whoami-main") || document.querySelector("main.content");

    const introRenderer = new IntroRenderer();

    let currentBio = "";
    let currentIntro = "";
    let introEditor = null;
    let introFallbackBound = false;
    let splitRatio = 50;
    let currentView = "split";
    let syncingFromEditor = false;
    let syncingFromPreview = false;

    function setEditingPerformanceMode(editing) {
        if (!mainContentEl) return;
        mainContentEl.classList.toggle("whoami-editing", Boolean(editing));
    }

    function getIntroEditorValue() {
        if (introEditor) return introEditor.getValue();
        return introInputEl?.value || "";
    }

    function setIntroEditorValue(value) {
        if (introEditor) {
            introEditor.setValue(value, -1);
            return;
        }
        if (introInputEl) introInputEl.value = value;
    }

    function updateAceStatus() {
        if (!introAceStatusEl) return;

        if (!introEditor) {
            if (!introInputEl) return;
            const pos = introInputEl.selectionStart || 0;
            const text = introInputEl.value.slice(0, pos);
            const lines = text.split("\n");
            introAceStatusEl.textContent = `行 ${lines.length}, 列 ${(lines.at(-1) || "").length + 1}`;
            return;
        }

        const pos = introEditor.getCursorPosition();
        introAceStatusEl.textContent = `行 ${pos.row + 1}, 列 ${pos.column + 1}`;
    }

    function bindFallbackInputOnce() {
        if (introFallbackBound || !introInputEl) return;
        introFallbackBound = true;
        introInputEl.classList.remove("hidden");
        introInputEl.addEventListener("input", () => {
            renderMarkdown(introPreviewEl, introInputEl.value, introRenderer);
            updateAceStatus();
        });
        introInputEl.addEventListener("keyup", updateAceStatus);
        introInputEl.addEventListener("click", updateAceStatus);
        introInputEl.addEventListener("scroll", () => {
            syncPreviewFromEditor();
        });
    }

    function getEditorScrollRatio() {
        if (introEditor) {
            const session = introEditor.getSession();
            const top = session.getScrollTop();
            const lineHeight = introEditor.renderer.lineHeight || 16;
            const fullHeight = session.getScreenLength() * lineHeight;
            const viewHeight = introEditor.renderer.$size.scrollerHeight || 1;
            const max = Math.max(1, fullHeight - viewHeight);
            return Math.max(0, Math.min(1, top / max));
        }

        if (introInputEl) {
            const max = Math.max(1, introInputEl.scrollHeight - introInputEl.clientHeight);
            return Math.max(0, Math.min(1, introInputEl.scrollTop / max));
        }

        return 0;
    }

    function setEditorScrollRatio(ratio) {
        const value = Math.max(0, Math.min(1, ratio));
        if (introEditor) {
            const session = introEditor.getSession();
            const lineHeight = introEditor.renderer.lineHeight || 16;
            const fullHeight = session.getScreenLength() * lineHeight;
            const viewHeight = introEditor.renderer.$size.scrollerHeight || 1;
            const max = Math.max(0, fullHeight - viewHeight);
            session.setScrollTop(value * max);
            return;
        }

        if (introInputEl) {
            const max = Math.max(0, introInputEl.scrollHeight - introInputEl.clientHeight);
            introInputEl.scrollTop = value * max;
        }
    }

    function syncPreviewFromEditor() {
        if (!introPanePreviewEl || syncingFromPreview) return;
        syncingFromEditor = true;
        const ratio = getEditorScrollRatio();
        const maxPreview = Math.max(0, introPanePreviewEl.scrollHeight - introPanePreviewEl.clientHeight);
        introPanePreviewEl.scrollTop = ratio * maxPreview;
        syncingFromEditor = false;
    }

    function syncEditorFromPreview() {
        if (!introPanePreviewEl || syncingFromEditor) return;
        syncingFromPreview = true;
        const maxPreview = Math.max(1, introPanePreviewEl.scrollHeight - introPanePreviewEl.clientHeight);
        const ratio = introPanePreviewEl.scrollTop / maxPreview;
        setEditorScrollRatio(ratio);
        syncingFromPreview = false;
    }

    function applySplitRatio(nextRatio) {
        splitRatio = Math.max(18, Math.min(82, nextRatio));
        if (!introPaneEditorEl || !introPanePreviewEl || currentView !== "split") return;
        introPaneEditorEl.style.flex = `0 0 ${splitRatio}%`;
        introPanePreviewEl.style.flex = `0 0 ${100 - splitRatio}%`;
        introEditor?.resize();
    }

    function setViewMode(mode) {
        if (!introPaneEditorEl || !introPanePreviewEl || !introDividerEl) return;
        currentView = mode;

        introToolbarEl?.querySelectorAll("[data-view]").forEach((btn) => {
            if (!(btn instanceof HTMLElement)) return;
            btn.classList.toggle("is-active", btn.dataset.view === mode);
        });

        if (mode === "editor") {
            introPaneEditorEl.classList.remove("hidden");
            introPanePreviewEl.classList.add("hidden");
            introDividerEl.classList.add("hidden");
            introPaneEditorEl.style.flex = "1 1 100%";
        } else if (mode === "preview") {
            introPaneEditorEl.classList.add("hidden");
            introPanePreviewEl.classList.remove("hidden");
            introDividerEl.classList.add("hidden");
            introPanePreviewEl.style.flex = "1 1 100%";
        } else {
            introPaneEditorEl.classList.remove("hidden");
            introPanePreviewEl.classList.remove("hidden");
            introDividerEl.classList.remove("hidden");
            applySplitRatio(splitRatio);
        }

        introEditor?.resize();
    }

    function bindSplitDrag() {
        if (!introDividerEl || !introSplitEl) return;

        let dragging = false;

        const onMove = (event) => {
            if (!dragging) return;
            const rect = introSplitEl.getBoundingClientRect();
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

        introDividerEl.addEventListener("pointerdown", (event) => {
            if (currentView !== "split") return;
            dragging = true;
            document.body.classList.add("md-resizing");
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            event.preventDefault();
        });
    }

    function insertSnippet(snippet) {
        const raw = String(snippet || "");

        if (introEditor) {
            const range = introEditor.getSelectionRange();
            const selected = introEditor.session.getTextRange(range);
            const resolved = resolveSnippet(raw, selected);
            const cursorOffset = resolved.indexOf("|");
            const text = resolved.replace("|", "");
            const startIndex = introEditor.session.doc.positionToIndex(range.start, 0);
            introEditor.session.replace(range, text);
            const cursorIndex = startIndex + (cursorOffset >= 0 ? cursorOffset : text.length);
            const cursorPos = introEditor.session.doc.indexToPosition(cursorIndex, 0);
            introEditor.selection.clearSelection();
            introEditor.moveCursorToPosition(cursorPos);
            introEditor.focus();
            renderMarkdown(introPreviewEl, getIntroEditorValue(), introRenderer);
            updateAceStatus();
            return;
        }

        if (!introInputEl) return;

        const start = introInputEl.selectionStart;
        const end = introInputEl.selectionEnd;
        const selected = introInputEl.value.slice(start, end);
        const resolved = resolveSnippet(raw, selected);
        const cursorOffset = resolved.indexOf("|");
        const text = resolved.replace("|", "");

        introInputEl.value =
            introInputEl.value.slice(0, start) + text + introInputEl.value.slice(end);

        const nextPos = start + (cursorOffset >= 0 ? cursorOffset : text.length);
        introInputEl.selectionStart = nextPos;
        introInputEl.selectionEnd = nextPos;
        introInputEl.focus();
        renderMarkdown(introPreviewEl, introInputEl.value, introRenderer);
        updateAceStatus();
    }

    function bindToolbar() {
        if (!introToolbarEl) return;

        introToolbarEl.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const button = target.closest("button");
            if (!button) return;

            const mode = button.dataset.view;
            if (mode) {
                setViewMode(mode);
                return;
            }

            const snippet = button.dataset.snippet;
            if (!snippet) return;
            insertSnippet(snippet);
        });
    }

    async function ensureIntroEditor() {
        if (introEditor || !introAceHostEl) return;

        try {
            await ensureAceLoaded();
            const ace = window.ace;
            if (!ace) throw new Error("ace not found on window");

            introEditor = ace.edit("intro-ide");
            introEditor.setTheme("ace/theme/chrome");
            introEditor.session.setMode("ace/mode/markdown");
            introEditor.session.setUseWrapMode(true);
            introEditor.setShowPrintMargin(false);
            introEditor.setOptions({
                fontSize: "15px",
                showLineNumbers: true,
                highlightActiveLine: true,
                highlightGutterLine: true,
                tabSize: 2,
                useSoftTabs: true,
            });
            introEditor.session.on("change", () => {
                renderMarkdown(introPreviewEl, getIntroEditorValue(), introRenderer);
                updateAceStatus();
                syncPreviewFromEditor();
            });
            introEditor.selection.on("changeCursor", updateAceStatus);
            introEditor.session.on("changeScrollTop", syncPreviewFromEditor);
            updateAceStatus();
        } catch (err) {
            console.error("ace editor load failed, fallback to textarea:", err);
            introAceHostEl.classList.add("hidden");
            bindFallbackInputOnce();
        }
    }

    function renderBio() {
        if (!bioDisplayEl) return;
        bioDisplayEl.textContent = currentBio.trim() || DEFAULT_BIO;
    }

    function enterBioEditMode() {
        if (!bioInputEl || !bioDisplayEl || !bioEditorEl) return;
        bioInputEl.value = currentBio;
        bioDisplayEl.classList.add("hidden");
        bioEditorEl.classList.remove("hidden");
        bioEditorEl.classList.add("flex");
        bioInputEl.focus();
    }

    function exitBioEditMode() {
        if (!bioDisplayEl || !bioEditorEl) return;
        bioEditorEl.classList.remove("flex");
        bioEditorEl.classList.add("hidden");
        bioDisplayEl.classList.remove("hidden");
    }

    async function enterIntroEditMode() {
        if (!introEditBtn || !introViewEl || !introEditorEl) return;

        await ensureIntroEditor();
        setIntroEditorValue(currentIntro);
        renderMarkdown(introPreviewEl, currentIntro, introRenderer);
        setViewMode("split");
        syncPreviewFromEditor();
        updateAceStatus();

        introEditBtn.classList.add("hidden");
        introViewEl.classList.add("hidden");
        introEditorEl.classList.remove("hidden");
        setEditingPerformanceMode(true);

        if (introEditor) introEditor.focus();
        else introInputEl?.focus();
    }

    function exitIntroEditMode() {
        if (!introEditBtn || !introViewEl || !introEditorEl) return;
        introEditorEl.classList.add("hidden");
        introEditBtn.classList.remove("hidden");
        introViewEl.classList.remove("hidden");
        setEditingPerformanceMode(false);
    }

    async function updateProfile(patch) {
        try {
            const res = await fetch(`${API_BASE}/api/update-profile`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            if (!res.ok) {
                if (res.status === 401) {
                    setEditingPerformanceMode(false);
                    showUnauthModal(unauthModal, profileCard);
                    return null;
                }
                throw new Error(await res.text());
            }
            return await res.json();
        } catch (err) {
            console.error("update-profile failed:", err);
            setEditingPerformanceMode(false);
            showUnauthModal(unauthModal, profileCard);
            return null;
        }
    }

    async function loadMe() {
        try {
            try {
                await ensureHighlightLoaded();
            } catch (err) {
                console.warn("highlight.js load failed, continue without syntax highlight:", err);
            }

            const res = await fetch(`${API_BASE}/api/me`, {
                credentials: "include",
            });
            if (!res.ok) {
                setEditingPerformanceMode(false);
                showUnauthModal(unauthModal, profileCard);
                return;
            }

            const data = await res.json();
            const p = data.profile || {};
            currentBio = p.bio || "";
            currentIntro = p.intro || "";

            hideUnauthModal(unauthModal);
            if (avatarEl) avatarEl.src = p.avatar || DEFAULT_AVATAR;
            if (nicknameEl) nicknameEl.textContent = p.nickname || data.username;
            if (usernameEl) usernameEl.textContent = "@" + data.username;
            renderBio();
            renderMarkdown(introRenderEl, currentIntro, introRenderer);
            profileCard?.classList.remove("hidden");
        } catch (err) {
            console.error("loadMe failed:", err);
            setEditingPerformanceMode(false);
            showUnauthModal(unauthModal, profileCard);
        }
    }

    introPanePreviewEl?.addEventListener("scroll", syncEditorFromPreview, { passive: true });
    bindToolbar();
    bindSplitDrag();
    setViewMode("split");

    bioDisplayEl?.addEventListener("click", enterBioEditMode);
    bioCancelBtn?.addEventListener("click", exitBioEditMode);
    bioSaveBtn?.addEventListener("click", async () => {
        if (!bioInputEl) return;
        const nextBio = bioInputEl.value;
        const updated = await updateProfile({ bio: nextBio });
        if (!updated) return;
        currentBio = updated.bio ?? nextBio;
        renderBio();
        exitBioEditMode();
    });

    introEditBtn?.addEventListener("click", () => {
        void enterIntroEditMode();
    });

    introCancelBtn?.addEventListener("click", exitIntroEditMode);
    introSaveBtn?.addEventListener("click", async () => {
        const nextIntro = getIntroEditorValue();
        const updated = await updateProfile({ intro: nextIntro });
        if (!updated) return;
        currentIntro = updated.intro ?? nextIntro;
        renderMarkdown(introRenderEl, currentIntro, introRenderer);
        exitIntroEditMode();
    });

    goLoginBtn?.addEventListener("click", () => {
        location.href = "/login";
    });

    loadMe();
}
