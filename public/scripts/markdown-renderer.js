import { marked, Renderer } from "https://cdn.jsdmirror.com/npm/marked/lib/marked.esm.js";

const HIDDEN_LEAF_RE = /::hidden\[([\s\S]*?)\]/g;
const ANTI_AI_LEAF_RE = /::anti-ai\[([\s\S]*?)\]/g;

function escapeHtml(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
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

export class ExtendedRenderer extends Renderer {
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

function preprocessMarkdown(markdown) {
    return stripLeafContainersForRender(markdown);
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

export function renderExtendedMarkdown(markdown, renderer) {
    const normalized = preprocessMarkdown(markdown).replace(/\r\n/g, "\n");
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
