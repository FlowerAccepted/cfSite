import { marked, Renderer } from "https://cdn.jsdmirror.com/npm/marked/lib/marked.esm.js";

const DEFAULT_BIO = "这个人很懒，什么都没写。";
const DEFAULT_INTRO = "这个人很懒，连个人简介都没写。";
const DEFAULT_AVATAR =
    "https://cdn.jsdmirror.com/gh/FlowerAccepted/gh-src-for-cfsite-dns@main/defult_avatar.png";
const ACE_SCRIPT_URL =
    "https://cdn.jsdelivr.net/npm/ace-builds@1.43.3/src-min-noconflict/ace.js";
const ACE_MARKDOWN_MODE_URL =
    "https://cdn.jsdelivr.net/npm/ace-builds@1.43.3/src-min-noconflict/mode-markdown.js";
const ACE_TEXT_MODE_URL =
    "https://cdn.jsdelivr.net/npm/ace-builds@1.43.3/src-min-noconflict/mode-text.js";
const ACE_CHROME_THEME_URL =
    "https://cdn.jsdelivr.net/npm/ace-builds@1.43.3/src-min-noconflict/theme-chrome.js";
const HIGHLIGHT_JS_URL =
    "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js";
const HIGHLIGHT_CSS_URL =
    "https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/atom-one-light.min.css";
const KATEX_JS_URLS = [
    "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js",
    "https://cdn.jsdmirror.com/npm/katex@0.16.11/dist/katex.min.js",
];
const KATEX_CSS_URLS = [
    "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css",
    "https://cdn.jsdmirror.com/npm/katex@0.16.11/dist/katex.min.css",
];
const KATEX_RENDER_AUTO_URLS = [
    "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js",
    "https://cdn.jsdmirror.com/npm/katex@0.16.11/dist/contrib/auto-render.min.js",
];
const HIDDEN_LEAF_RE = /::hidden\[([\s\S]*?)\]/g;
const ANTI_AI_LEAF_RE = /::anti-ai\[([\s\S]*?)\]/g;

let aceLoadPromise = null;
let aceDepsLoadPromise = null;
let highlightLoadPromise = null;
let katexCssLoadPromise = null;
let katexLoadPromise = null;
let aceCustomModeReady = false;

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

async function loadScriptWithFallback(urls) {
    let lastErr = null;
    for (const url of urls) {
        try {
            await loadScript(url);
            return;
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr || new Error("all script urls failed");
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

function ensureKatexCss() {
    const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find((link) =>
        KATEX_CSS_URLS.includes(link.href),
    );
    if (exists) return Promise.resolve();

    if (!katexCssLoadPromise) {
        katexCssLoadPromise = new Promise((resolve, reject) => {
            let index = 0;
            const tryNext = () => {
                if (index >= KATEX_CSS_URLS.length) {
                    reject(new Error("all katex css urls failed"));
                    return;
                }
                const href = KATEX_CSS_URLS[index];
                index += 1;

                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = href;
                link.addEventListener("load", () => resolve(), { once: true });
                link.addEventListener("error", () => {
                    link.remove();
                    tryNext();
                }, { once: true });
                document.head.appendChild(link);
            };
            tryNext();
        });
    }
    return katexCssLoadPromise;
}

function ensureKatexLoaded() {
    if (window.katex && window.renderMathInElement) {
        return ensureKatexCss();
    }

    if (!katexLoadPromise) {
        katexLoadPromise = ensureKatexCss()
            .then(() => loadScriptWithFallback(KATEX_JS_URLS))
            .then(() => loadScriptWithFallback(KATEX_RENDER_AUTO_URLS))
            .then(() => undefined);
    }
    return katexLoadPromise;
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
        return Promise.resolve();
    } catch {
        // Continue to network loading.
    }

    if (!aceDepsLoadPromise) {
        aceDepsLoadPromise = Promise.all([
            loadScript(ACE_TEXT_MODE_URL),
            loadScript(ACE_MARKDOWN_MODE_URL),
            loadScript(ACE_CHROME_THEME_URL),
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
    } catch (err) {
        console.warn("custom ace markdown mode init failed:", err);
        return false;
    }
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

function sanitizeHref(href) {
    if (!href || typeof href !== "string") return "#";
    try {
        const u = new URL(href, window.location.origin);
        if (["http:", "https:", "mailto:"].includes(u.protocol)) return u.toString();
    } catch {
        return "#";
    }
    return "#";
}

class IntroRenderer extends Renderer {
    link({ href, tokens }) {
        const text = escapeHtml((tokens || []).map((t) => t.text || "").join(""));
        const safeHref = escapeHtml(sanitizeHref(href));
        return `<a href="${safeHref}" class="basic-href" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }

    image({ href, title, text }) {
        const safeSrc = escapeHtml(sanitizeHref(href));
        const safeAlt = escapeHtml(text || "");
        const safeTitle = title ? ` title="${escapeHtml(title)}"` : "";
        return `<img src="${safeSrc}" alt="${safeAlt}"${safeTitle} loading="lazy" />`;
    }

    html({ text }) {
        return escapeHtml(text || "");
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

function stripLeafContainersForRender(markdown) {
    return String(markdown || "").replace(HIDDEN_LEAF_RE, "").replace(ANTI_AI_LEAF_RE, "");
}

function preprocessLuoguMarkdown(markdown) {
    return stripLeafContainersForRender(markdown);
}

function normalizeMarkdownForCopy(markdown) {
    return String(markdown || "").replace(ANTI_AI_LEAF_RE, "$1");
}

function parseCuteTableStart(line) {
    const match = String(line || "").match(/^\s*::cute-table\{([^}]+)\}\s*$/i);
    if (!match) return null;
    const style = String(match[1] || "").trim().toLowerCase();
    return { style: style === "three" ? "three" : "tuack" };
}

function isPipeTableRowLine(line) {
    const text = String(line || "").trim();
    if (!text) return false;
    let pipes = 0;
    for (let i = 0; i < text.length; i += 1) {
        if (text[i] === "|" && text[i - 1] !== "\\") pipes += 1;
    }
    return pipes >= 1;
}

function splitPipeTableCells(rowLine) {
    let line = String(rowLine || "").trim();
    if (line.startsWith("|")) line = line.slice(1);
    if (line.endsWith("|")) line = line.slice(0, -1);

    const cells = [];
    let current = "";

    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (ch === "\\" && line[i + 1] === "|") {
            current += "|";
            i += 1;
            continue;
        }
        if (ch === "|") {
            cells.push(current.trim());
            current = "";
            continue;
        }
        current += ch;
    }
    cells.push(current.trim());
    return cells;
}

function isAlignmentCell(cell) {
    return /^:?-{2,}:?$/.test(String(cell || "").trim());
}

function isAlignmentRow(cells) {
    return cells.length > 0 && cells.every((cell) => isAlignmentCell(cell) || cell.trim() === "");
}

function parseAlignments(cells, columns) {
    const result = Array.from({ length: columns }, () => "");
    for (let i = 0; i < columns; i += 1) {
        const raw = String(cells[i] || "").trim();
        if (/^:-+:$/.test(raw)) result[i] = "center";
        else if (/^:-+$/.test(raw)) result[i] = "left";
        else if (/^-+:$/.test(raw)) result[i] = "right";
    }
    return result;
}

function renderInlineMarkdownCell(text, renderer) {
    const content = String(text || "").trim();
    if (!content) return "&nbsp;";
    if (content === "^" || content === "<") return escapeHtml(content);
    return marked.parseInline(content, {
        renderer,
        gfm: true,
        breaks: false,
    });
}

function renderCuteTableBlock(style, rowLines, renderer) {
    const rows = rowLines.map(splitPipeTableCells);
    const columns = Math.max(1, ...rows.map((cells) => cells.length));
    const normalizedRows = rows.map((cells) => {
        const next = cells.slice();
        while (next.length < columns) next.push("");
        return next.slice(0, columns);
    });

    const sepIndexes = [];
    normalizedRows.forEach((cells, idx) => {
        if (isAlignmentRow(cells)) sepIndexes.push(idx);
    });

    let alignments = Array.from({ length: columns }, () => "");
    let headerRows = [];
    let bodyRows = [];

    if (sepIndexes.length > 0) {
        alignments = parseAlignments(normalizedRows[sepIndexes[0]], columns);
        headerRows = normalizedRows.slice(0, sepIndexes[0]);
        bodyRows = normalizedRows.slice(sepIndexes[sepIndexes.length - 1] + 1);
    } else {
        bodyRows = normalizedRows;
    }

    let html = `<table class="md-cute-table md-cute-table-${escapeHtml(style)}">`;

    if (headerRows.length > 0) {
        html += "<thead>";
        for (const row of headerRows) {
            html += "<tr>";
            row.forEach((cell, col) => {
                const align = alignments[col];
                const alignAttr = align ? ` style="text-align:${align}"` : "";
                html += `<th${alignAttr}>${renderInlineMarkdownCell(cell, renderer)}</th>`;
            });
            html += "</tr>";
        }
        html += "</thead>";
    }

    html += "<tbody>";
    for (const row of bodyRows) {
        html += "<tr>";
        row.forEach((cell, col) => {
            const align = alignments[col];
            const alignAttr = align ? ` style="text-align:${align}"` : "";
            html += `<td${alignAttr}>${renderInlineMarkdownCell(cell, renderer)}</td>`;
        });
        html += "</tr>";
    }
    html += "</tbody></table>";
    return html;
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
            const cuteTable = parseCuteTableStart(lines[i]);
            if (cuteTable) {
                const tableRows = [];
                let cursor = i + 1;
                while (cursor < end && isPipeTableRowLine(lines[cursor])) {
                    tableRows.push(lines[cursor]);
                    cursor += 1;
                }
                if (tableRows.length > 0) {
                    flush();
                    out += renderCuteTableBlock(cuteTable.style, tableRows, renderer);
                    i = cursor;
                    continue;
                }
                // Swallow marker line even if malformed table follows.
                i += 1;
                continue;
            }

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
    return root;
}

function applyMathRendering(root) {
    if (!window.renderMathInElement) return;
    try {
        window.renderMathInElement(root, {
            throwOnError: false,
            strict: "ignore",
            delimiters: [
                { left: "$$", right: "$$", display: true },
                { left: "\\[", right: "\\]", display: true },
                { left: "\\(", right: "\\)", display: false },
                { left: "$", right: "$", display: false },
            ],
            ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
        });
    } catch (err) {
        console.warn("katex render failed:", err);
    }
}

function applyCodeRendering(root) {
    const codeBlocks = root.querySelectorAll("pre.md-code-block");

    for (const pre of codeBlocks) {
        const code = pre.querySelector("code");
        if (!code) continue;

        const language = pre.dataset.language || "";
        const rawCode = code.textContent || "";
        if (window.hljs) {
            try {
                const lang = String(language || "").toLowerCase();
                let highlighted;
                if (lang && window.hljs.getLanguage?.(lang)) {
                    highlighted = window.hljs.highlight(rawCode, {
                        language: lang,
                        ignoreIllegals: true,
                    });
                } else {
                    highlighted = window.hljs.highlightAuto(rawCode);
                }
                code.innerHTML = highlighted.value;
                code.classList.add("hljs");
            } catch (err) {
                console.warn("hljs highlight failed, fallback highlighter used:", err);
                code.innerHTML = fallbackHighlightCode(rawCode, language);
                code.classList.add("hljs");
            }
        } else {
            code.innerHTML = fallbackHighlightCode(rawCode, language);
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
    applyMathRendering(root);
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
    const introApplyBtn = document.getElementById("intro-apply");
    const introSaveBtn = document.getElementById("intro-save");
    const introSaveToastEl = document.getElementById("intro-save-toast");
    const introSaveToastTextEl = document.getElementById("intro-save-toast-text");

    const introToolbarEl = document.getElementById("intro-toolbar");
    const introToolbarLeftEl = document.getElementById("intro-toolbar-left");
    const introSplitEl = document.getElementById("intro-split");
    const introDividerEl = document.getElementById("intro-divider");
    const introPaneEditorEl = document.getElementById("intro-pane-editor");
    const introPanePreviewEl = document.getElementById("intro-pane-preview");
    const introToolDialogEl = document.getElementById("intro-tool-dialog");
    const introToolDialogTitleEl = document.getElementById("intro-tool-dialog-title");
    const introToolDialogApplyBtn = document.getElementById("intro-dialog-apply");
    const introToolDialogCancelBtn = document.getElementById("intro-dialog-cancel");

    const introDialogLinkTextEl = document.getElementById("intro-dialog-link-text");
    const introDialogLinkUrlEl = document.getElementById("intro-dialog-link-url");
    const introDialogLinkTitleEl = document.getElementById("intro-dialog-link-title");
    const introDialogImageAltEl = document.getElementById("intro-dialog-image-alt");
    const introDialogImageUrlEl = document.getElementById("intro-dialog-image-url");
    const introDialogImageTitleEl = document.getElementById("intro-dialog-image-title");
    const introDialogCalloutKindEl = document.getElementById("intro-dialog-callout-kind");
    const introDialogCalloutTitleEl = document.getElementById("intro-dialog-callout-title");
    const introDialogCalloutOpenEl = document.getElementById("intro-dialog-callout-open");
    const introDialogTableStyleEl = document.getElementById("intro-dialog-table-style");
    const introDialogTableColsEl = document.getElementById("intro-dialog-table-cols");
    const introDialogTableRowsEl = document.getElementById("intro-dialog-table-rows");
    const introDialogTableHeadRowsEl = document.getElementById("intro-dialog-table-headrows");
    const introDialogTableMergeEl = document.getElementById("intro-dialog-table-merge");
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
    let statusFlashLock = false;
    let toastHideTimer = null;
    let currentDialogKind = "";
    let introBaseline = "";

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

    function flashStatus(message, timeout = 1600) {
        if (!introAceStatusEl) return;
        statusFlashLock = true;
        introAceStatusEl.textContent = message;
        window.setTimeout(() => {
            statusFlashLock = false;
            updateAceStatus();
        }, timeout);
    }

    function showIntroSavedToast(message = "保存成功") {
        if (!introSaveToastEl) return;
        if (introSaveToastTextEl) introSaveToastTextEl.textContent = message;

        introSaveToastEl.classList.remove("is-fading", "is-visible");
        // Force reflow so repeated saves replay drop-in animation.
        void introSaveToastEl.offsetWidth;
        introSaveToastEl.classList.add("is-visible");

        if (toastHideTimer) window.clearTimeout(toastHideTimer);
        toastHideTimer = window.setTimeout(() => {
            introSaveToastEl.classList.add("is-fading");
            introSaveToastEl.classList.remove("is-visible");
            window.setTimeout(() => {
                introSaveToastEl.classList.remove("is-fading");
            }, 420);
        }, 5000);
    }

    function updateAceStatus() {
        if (!introAceStatusEl) return;
        if (statusFlashLock) return;

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

    function isIntroEditing() {
        return Boolean(introEditorEl && !introEditorEl.classList.contains("hidden"));
    }

    function hasUnsavedIntroChanges() {
        if (!isIntroEditing()) return false;
        return getIntroEditorValue() !== introBaseline;
    }

    function confirmDiscardIntroChanges() {
        if (!hasUnsavedIntroChanges()) return true;
        return window.confirm("个人简介有未保存内容，确定退出编辑吗？");
    }

    function getCurrentSelectionText() {
        if (introEditor) {
            const range = introEditor.getSelectionRange();
            return introEditor.session.getTextRange(range);
        }
        if (!introInputEl) return "";
        const start = introInputEl.selectionStart || 0;
        const end = introInputEl.selectionEnd || start;
        return introInputEl.value.slice(start, end);
    }

    function clampInt(value, fallback, min, max) {
        const n = Number.parseInt(String(value), 10);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
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

    function closeToolDialog() {
        if (!introToolDialogEl) return;
        introToolDialogEl.classList.add("hidden");
        introToolDialogEl.classList.remove("is-open");
        introToolDialogEl.setAttribute("aria-hidden", "true");
        currentDialogKind = "";
        introEditor?.focus();
    }

    function openToolDialog(kind, button) {
        if (!introToolDialogEl) return;
        currentDialogKind = kind;

        introToolDialogEl.querySelectorAll("[data-dialog-panel]").forEach((panel) => {
            panel.classList.add("hidden");
        });
        const panel = introToolDialogEl.querySelector(`[data-dialog-panel="${kind}"]`);
        if (panel) panel.classList.remove("hidden");

        const selected = getCurrentSelectionText() || "text";
        if (kind === "link") {
            if (introToolDialogTitleEl) introToolDialogTitleEl.textContent = "插入链接";
            if (introDialogLinkTextEl) introDialogLinkTextEl.value = selected;
            if (introDialogLinkUrlEl) introDialogLinkUrlEl.value = "";
            if (introDialogLinkTitleEl) introDialogLinkTitleEl.value = "";
            introDialogLinkTextEl?.focus();
        } else if (kind === "image") {
            if (introToolDialogTitleEl) introToolDialogTitleEl.textContent = "插入图片";
            if (introDialogImageAltEl) introDialogImageAltEl.value = selected === "text" ? "alt" : selected;
            if (introDialogImageUrlEl) introDialogImageUrlEl.value = "";
            if (introDialogImageTitleEl) introDialogImageTitleEl.value = "";
            introDialogImageAltEl?.focus();
        } else if (kind === "callout") {
            if (introToolDialogTitleEl) introToolDialogTitleEl.textContent = "插入提示块";
            const calloutKind = button?.dataset.calloutKind || "info";
            if (introDialogCalloutKindEl) introDialogCalloutKindEl.value = calloutKind;
            if (introDialogCalloutTitleEl) {
                const defaultTitles = { info: "提示", success: "成功", warning: "警告", error: "错误" };
                introDialogCalloutTitleEl.value = defaultTitles[calloutKind] || "提示";
            }
            if (introDialogCalloutOpenEl) introDialogCalloutOpenEl.checked = true;
            introDialogCalloutTitleEl?.focus();
        } else if (kind === "table") {
            if (introToolDialogTitleEl) introToolDialogTitleEl.textContent = "插入表格";
            if (introDialogTableStyleEl) {
                introDialogTableStyleEl.value = button?.dataset.tableStyle || "plain";
            }
            if (introDialogTableColsEl) introDialogTableColsEl.value = "4";
            if (introDialogTableRowsEl) introDialogTableRowsEl.value = "6";
            if (introDialogTableHeadRowsEl) introDialogTableHeadRowsEl.value = "1";
            if (introDialogTableMergeEl) introDialogTableMergeEl.checked = false;
            introDialogTableColsEl?.focus();
        }

        closeCollapsedGroupMenus();
        introToolDialogEl.classList.remove("hidden");
        introToolDialogEl.classList.add("is-open");
        introToolDialogEl.setAttribute("aria-hidden", "false");
    }

    function applyToolDialog() {
        if (!currentDialogKind) return;
        let snippet = "";
        if (currentDialogKind === "link") {
            const text = introDialogLinkTextEl?.value?.trim() || "text";
            const href = introDialogLinkUrlEl?.value?.trim() || "|";
            const title = introDialogLinkTitleEl?.value?.trim();
            snippet = `[${text}](${href}${title ? ` "${title}"` : ""})`;
        } else if (currentDialogKind === "image") {
            const alt = introDialogImageAltEl?.value?.trim() || "alt";
            const src = introDialogImageUrlEl?.value?.trim() || "|";
            const title = introDialogImageTitleEl?.value?.trim();
            snippet = `![${alt}](${src}${title ? ` "${title}"` : ""})`;
        } else if (currentDialogKind === "callout") {
            const kind = introDialogCalloutKindEl?.value || "info";
            const title = introDialogCalloutTitleEl?.value?.trim() || "提示";
            const open = introDialogCalloutOpenEl?.checked ? "{open}" : "";
            snippet = `:::${kind}[${title}]${open}\n|\n:::\n`;
        } else if (currentDialogKind === "table") {
            snippet = buildTableSnippet(
                introDialogTableStyleEl?.value || "plain",
                introDialogTableColsEl?.value || "4",
                introDialogTableRowsEl?.value || "6",
                introDialogTableHeadRowsEl?.value || "1",
                Boolean(introDialogTableMergeEl?.checked),
            );
        }

        if (snippet) insertSnippet(snippet);
        closeToolDialog();
    }

    function bindToolDialog() {
        if (!introToolDialogEl) return;

        introToolDialogEl.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest("[data-dialog-close]")) closeToolDialog();
        });

        introToolDialogApplyBtn?.addEventListener("click", applyToolDialog);
        introToolDialogCancelBtn?.addEventListener("click", closeToolDialog);
        window.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;
            if (!introToolDialogEl.classList.contains("is-open")) return;
            closeToolDialog();
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

    function closeCollapsedGroupMenus() {
        introToolbarLeftEl?.querySelectorAll(".md-tool-group.is-open").forEach((el) => {
            el.classList.remove("is-open");
        });
    }

    function bindToolbarGroupHover() {
        if (!introToolbarLeftEl) return;

        let closeTimer = 0;
        const clearCloseTimer = () => {
            if (!closeTimer) return;
            window.clearTimeout(closeTimer);
            closeTimer = 0;
        };

        introToolbarLeftEl.addEventListener("pointerover", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const group = target.closest(".md-tool-group");
            if (!group || !group.classList.contains("is-collapsed")) return;
            clearCloseTimer();
            closeCollapsedGroupMenus();
            group.classList.add("is-open");
        });

        introToolbarLeftEl.addEventListener("pointerout", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const group = target.closest(".md-tool-group");
            if (!group || !group.classList.contains("is-collapsed")) return;

            const related = event.relatedTarget;
            if (related instanceof Node && group.contains(related)) return;

            clearCloseTimer();
            closeTimer = window.setTimeout(() => {
                group.classList.remove("is-open");
            }, 120);
        });
    }

    function relayoutToolbarGroups() {
        if (!introToolbarLeftEl) return;
        const groups = Array.from(introToolbarLeftEl.querySelectorAll(".md-tool-group"));
        if (groups.length === 0) return;

        groups.forEach((group) => {
            group.classList.remove("is-collapsed", "is-open");
        });

        for (
            let idx = groups.length - 1;
            idx >= 0 && introToolbarLeftEl.scrollWidth > introToolbarLeftEl.clientWidth;
            idx -= 1
        ) {
            groups[idx].classList.add("is-collapsed");
        }
    }

    async function copyMarkdownWithPolicy() {
        const raw = getIntroEditorValue();
        const normalized = normalizeMarkdownForCopy(raw);

        const fallbackCopy = () => {
            const textarea = document.createElement("textarea");
            textarea.value = normalized;
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
        };

        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(normalized);
            } else {
                fallbackCopy();
            }
            flashStatus("已复制 Markdown（anti-ai 已展开）");
        } catch (err) {
            console.warn("clipboard write failed, fallback to execCommand:", err);
            fallbackCopy();
            flashStatus("已复制 Markdown（fallback）");
        }
    }

    function initToolbarResponsiveLayout() {
        if (!introToolbarEl || !introToolbarLeftEl) return;

        relayoutToolbarGroups();
        const resizeHandler = () => relayoutToolbarGroups();
        window.addEventListener("resize", resizeHandler, { passive: true });

        if ("ResizeObserver" in window) {
            const observer = new ResizeObserver(() => {
                relayoutToolbarGroups();
            });
            observer.observe(introToolbarEl);
            observer.observe(introToolbarLeftEl);
        }

        document.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            if (!introToolbarEl.contains(target)) closeCollapsedGroupMenus();
        });
    }

    function bindToolbar() {
        if (!introToolbarEl) return;

        introToolbarEl.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            const button = target.closest("button");
            if (!button) return;

            if (button.dataset.groupToggle !== undefined) {
                const group = button.closest(".md-tool-group");
                if (!group || !group.classList.contains("is-collapsed")) return;
                const nextOpen = !group.classList.contains("is-open");
                closeCollapsedGroupMenus();
                if (nextOpen) group.classList.add("is-open");
                return;
            }

            const mode = button.dataset.view;
            if (mode) {
                setViewMode(mode);
                return;
            }

            const action = button.dataset.action;
            if (action === "copy-markdown") {
                void copyMarkdownWithPolicy();
                return;
            }

            const dialog = button.dataset.dialog;
            if (dialog) {
                openToolDialog(dialog, button);
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
            await ensureAceDepsLoaded();
            const ace = window.ace;
            if (!ace) throw new Error("ace not found on window");

            introEditor = ace.edit("intro-ide");
            introEditor.setTheme("ace/theme/chrome");
            const useCustomMode = ensureAceCustomMode();
            const targetMode = useCustomMode ? "ace/mode/cfsite_markdown" : "ace/mode/markdown";
            introEditor.session.setMode(targetMode);
            const modeId = introEditor.session.$mode?.$id || "";
            if (!modeId.includes("markdown")) {
                introEditor.session.setMode("ace/mode/markdown");
            }
            console.info("intro editor mode:", introEditor.session.$mode?.$id);
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
        introBaseline = currentIntro;
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

    function exitIntroEditMode(force = false) {
        if (!introEditBtn || !introViewEl || !introEditorEl) return;
        if (!force && !confirmDiscardIntroChanges()) return false;
        introEditorEl.classList.add("hidden");
        introEditBtn.classList.remove("hidden");
        introViewEl.classList.remove("hidden");
        setEditingPerformanceMode(false);
        closeToolDialog();
        return true;
    }

    async function saveIntro(keepEditing) {
        const nextIntro = getIntroEditorValue();
        const updated = await updateProfile({ intro: nextIntro });
        if (!updated) return false;

        currentIntro = updated.intro ?? nextIntro;
        introBaseline = currentIntro;
        renderMarkdown(introRenderEl, currentIntro, introRenderer);
        showIntroSavedToast("保存成功");

        if (keepEditing) {
            flashStatus("已保存");
            renderMarkdown(introPreviewEl, currentIntro, introRenderer);
            syncPreviewFromEditor();
        } else {
            exitIntroEditMode(true);
        }

        return true;
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
            try {
                await ensureKatexLoaded();
            } catch (err) {
                console.warn("katex load failed, continue without math render:", err);
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
    bindToolbarGroupHover();
    bindToolDialog();
    initToolbarResponsiveLayout();
    bindSplitDrag();
    setViewMode("split");
    window.addEventListener("beforeunload", (event) => {
        if (!hasUnsavedIntroChanges()) return;
        event.preventDefault();
        event.returnValue = "";
    });

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

    introCancelBtn?.addEventListener("click", () => {
        exitIntroEditMode(false);
    });
    introApplyBtn?.addEventListener("click", async () => {
        await saveIntro(true);
    });
    introSaveBtn?.addEventListener("click", async () => {
        await saveIntro(false);
    });

    goLoginBtn?.addEventListener("click", () => {
        location.href = "/login";
    });

    loadMe();
}
