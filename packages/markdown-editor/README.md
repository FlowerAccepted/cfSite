# @cfsite/markdown-editor

Standalone Markdown editor web component.

## Browser Usage

```html
<link rel="stylesheet" href="/path/to/markdown-editor/styles.css" />

<markdown-editor
  prefix="article"
  file-title="new-post.md"
  editor-height-class="h-96"
></markdown-editor>

<script type="module">
  import "@cfsite/markdown-editor";

  const editor = document.querySelector("markdown-editor");
  console.log(editor.value);
</script>
```

The component renders into light DOM, so forms can still read the textarea at `${prefix}-input`.

CSS is intentionally external: import `@cfsite/markdown-editor/styles.css`, copy it into your app, or provide compatible environment styles and CSS variables yourself.

## Astro Usage

```astro
---
import MarkdownIDE from "@cfsite/markdown-editor/astro";
---

<MarkdownIDE prefix="article" fileTitle="new-post.md" />
```
