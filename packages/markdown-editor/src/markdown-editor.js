import { initMarkdownEditor } from "./markdownEditorController.js";
import { renderMarkdownEditorTemplate } from "./template.js";

const DEFAULT_TAG_NAME = "markdown-editor";

function readBooleanAttribute(element, name, fallback = true) {
    if (!element.hasAttribute(name)) return fallback;
    const value = element.getAttribute(name);
    return value !== "false" && value !== "0";
}

export class MarkdownEditorElement extends HTMLElement {
    connectedCallback() {
        if (!this.dataset.markdownEditorRendered) {
            this.render();
        }

        if (!readBooleanAttribute(this, "auto-init", true)) return;
        this.init();
    }

    render() {
        const prefix = this.getAttribute("prefix") || "md";
        this.innerHTML = renderMarkdownEditorTemplate({
            prefix,
            fileTitle: this.getAttribute("file-title") || "document.md",
            editorHeightClass: this.getAttribute("editor-height-class") || "h-96",
            editorPlaceholder: this.getAttribute("editor-placeholder") || "支持 Markdown",
            autoInit: readBooleanAttribute(this, "auto-init", true),
        });
        this.dataset.markdownEditorRendered = "1";
    }

    init() {
        const root = this.querySelector(".md-ide-shell[data-md-prefix]");
        if (root) initMarkdownEditor(root);
    }

    get value() {
        const prefix = this.getAttribute("prefix") || "md";
        const input = this.querySelector(`#${CSS.escape(prefix)}-input`);
        return input instanceof HTMLTextAreaElement ? input.value : "";
    }

    set value(nextValue) {
        const prefix = this.getAttribute("prefix") || "md";
        const input = this.querySelector(`#${CSS.escape(prefix)}-input`);
        if (!(input instanceof HTMLTextAreaElement)) return;
        input.value = String(nextValue ?? "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }
}

export function defineMarkdownEditor(tagName = DEFAULT_TAG_NAME) {
    if (!customElements.get(tagName)) {
        customElements.define(tagName, MarkdownEditorElement);
    }
    return customElements.get(tagName);
}

defineMarkdownEditor();

export { initMarkdownEditor, renderMarkdownEditorTemplate };
