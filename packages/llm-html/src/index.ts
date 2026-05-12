export const LLM_HTML_STYLES = String.raw`
:root {
  color-scheme: light;
  --llm-bg: #fbfaf7;
  --llm-text: #1e252b;
  --llm-muted: #68717a;
  --llm-line: #dde3e8;
  --llm-panel: #ffffff;
  --llm-code: #f1f4f6;
  --llm-blue: #2563eb;
  --llm-green: #16803c;
  --llm-yellow: #a16207;
  --llm-red: #c23131;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 24px;
  background: var(--llm-bg);
  color: var(--llm-text);
  font: 14px/1.68 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

h1,
h2,
h3,
h4 {
  margin: 0 0 12px;
  line-height: 1.25;
}

h1:not(:first-child),
h2:not(:first-child),
h3:not(:first-child),
h4:not(:first-child) {
  margin-top: 24px;
}

p,
ul,
ol,
pre,
blockquote,
table,
.note-info,
.note-success,
.note-warning,
.note-danger,
.collapse,
.tabs,
.steps,
.col-con {
  margin: 0 0 14px;
}

ul,
ol {
  padding-left: 22px;
}

pre {
  padding: 12px 14px;
  overflow-x: auto;
  border: 1px solid var(--llm-line);
  border-radius: 8px;
  background: var(--llm-code);
}

code {
  font-family: Consolas, Monaco, "Courier New", monospace;
  font-size: 0.92em;
}

:not(pre) > code {
  padding: 2px 5px;
  border-radius: 5px;
  background: var(--llm-code);
}

a {
  color: var(--llm-blue);
}

table {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border: 1px solid var(--llm-line);
  border-radius: 8px;
}

th,
td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--llm-line);
  text-align: left;
  vertical-align: top;
}

th {
  background: #eef3f8;
}

.note-info,
.note-success,
.note-warning,
.note-danger {
  padding: 11px 13px;
  border: 1px solid currentColor;
  border-left-width: 4px;
  border-radius: 8px;
  background: color-mix(in srgb, currentColor 9%, var(--llm-panel));
}

.note-info {
  color: var(--llm-blue);
}

.note-success {
  color: var(--llm-green);
}

.note-warning {
  color: var(--llm-yellow);
}

.note-danger {
  color: var(--llm-red);
}

.collapse {
  padding: 10px 12px;
  border: 1px solid var(--llm-line);
  border-radius: 8px;
  background: var(--llm-panel);
}

.collapse > summary {
  cursor: pointer;
  font-weight: 650;
}

.collapse > :not(summary):first-of-type {
  margin-top: 12px;
}

.tabs {
  border: 1px solid var(--llm-line);
  border-radius: 8px;
  background: var(--llm-panel);
  overflow: hidden;
}

.tab-list {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--llm-line);
  background: #eef3f8;
}

.tab-button {
  appearance: none;
  border: 0;
  border-right: 1px solid var(--llm-line);
  padding: 8px 12px;
  background: transparent;
  color: var(--llm-muted);
  cursor: pointer;
  font: inherit;
}

.tab-button[aria-selected="true"] {
  background: var(--llm-panel);
  color: var(--llm-text);
  font-weight: 650;
}

.tab {
  display: none;
  padding: 14px;
}

.tab.is-active {
  display: block;
}

.col-con {
  display: grid;
  grid-template-columns: var(--llm-col-template, repeat(auto-fit, minmax(220px, 1fr)));
  gap: 14px;
  align-items: start;
}

.steps {
  display: grid;
  gap: 8px;
}

.step {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 9px;
  align-items: start;
  padding: 9px 10px;
  border: 1px solid var(--llm-line);
  border-radius: 8px;
  background: var(--llm-panel);
}

.step-check:checked + .step-content {
  color: var(--llm-muted);
  text-decoration: line-through;
}

.tag-blue,
.tag-green,
.tag-yellow,
.tag-red,
.tag-bg-blue,
.tag-bg-green,
.tag-bg-yellow,
.tag-bg-red {
  border-radius: 999px;
  padding: 1px 7px;
  font-weight: 650;
}

.tag-blue {
  color: var(--llm-blue);
}

.tag-green {
  color: var(--llm-green);
}

.tag-yellow {
  color: var(--llm-yellow);
}

.tag-red {
  color: var(--llm-red);
}

.tag-bg-blue {
  color: #123a88;
  background: #dbeafe;
}

.tag-bg-green {
  color: #14532d;
  background: #dcfce7;
}

.tag-bg-yellow {
  color: #713f12;
  background: #fef3c7;
}

.tag-bg-red {
  color: #7f1d1d;
  background: #fee2e2;
}

@media (max-width: 700px) {
  body {
    padding: 16px;
  }

  .col-con {
    grid-template-columns: 1fr;
  }
}
`;

export const LLM_HTML_INTERACTION_SCRIPT = String.raw`
(() => {
  function initLlmHtmlColumns() {
    document.querySelectorAll('.col-con').forEach((container) => {
      const tracks = Array.from(container.children).map((child) => {
        const match = Array.from(child.classList).join(' ').match(/(?:^|\s)col-(\d+)(?:\s|$)/);
        return match ? Math.max(1, Number(match[1])) + 'fr' : '1fr';
      });
      if (tracks.length > 0) container.style.setProperty('--llm-col-template', tracks.join(' '));
    });
  }

  function initLlmHtmlTabs() {
    document.querySelectorAll('.tabs').forEach((tabs, groupIndex) => {
      const panels = Array.from(tabs.querySelectorAll(':scope > .tab'));
      if (panels.length === 0 || tabs.querySelector(':scope > .tab-list')) return;

      const list = document.createElement('div');
      list.className = 'tab-list';
      list.setAttribute('role', 'tablist');
      tabs.prepend(list);

      panels.forEach((panel, index) => {
        const id = 'llm-tab-' + groupIndex + '-' + index;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tab-button';
        button.id = id + '-button';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', id);
        button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        button.textContent = panel.getAttribute('data-label') || 'Tab ' + (index + 1);
        panel.id = id;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', button.id);
        panel.classList.toggle('is-active', index === 0);
        button.addEventListener('click', () => {
          panels.forEach((nextPanel) => nextPanel.classList.remove('is-active'));
          list.querySelectorAll('.tab-button').forEach((nextButton) => nextButton.setAttribute('aria-selected', 'false'));
          panel.classList.add('is-active');
          button.setAttribute('aria-selected', 'true');
        });
        list.append(button);
      });
    });
  }

  function initLlmHtmlSteps() {
    document.querySelectorAll('.steps > .step').forEach((step, index) => {
      if (step.querySelector(':scope > .step-check')) return;
      const content = document.createElement('span');
      content.className = 'step-content';
      while (step.firstChild) content.append(step.firstChild);
      const checkbox = document.createElement('input');
      checkbox.className = 'step-check';
      checkbox.type = 'checkbox';
      checkbox.setAttribute('aria-label', 'Mark step ' + (index + 1) + ' complete');
      step.append(checkbox, content);
    });
  }

  function initLlmHtmlRuntime() {
    initLlmHtmlColumns();
    initLlmHtmlTabs();
    initLlmHtmlSteps();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLlmHtmlRuntime, { once: true });
  } else {
    initLlmHtmlRuntime();
  }
})();
`;

export const LLM_HTML_PROMPT = [
  'HTML-first output for yaCA Web:',
  'When an answer benefits from visual structure, output a complete standalone HTML document beginning with <!doctype html>. The web UI renders it in an isolated iframe and injects preset CSS and interaction JS.',
  'Do not write scripts. Do not rely on inline style or custom CSS unless the user explicitly asks for a standalone artifact that needs it.',
  'Use normal HTML for headings, paragraphs, lists, tables, links, strong text, and code blocks.',
  'Available preset components: note-info, note-success, note-warning, note-danger; details.collapse; .tabs with child .tab[data-label]; .col-con with children .col-1, .col-2, etc.; .steps with child .step; inline tags tag-blue, tag-green, tag-yellow, tag-red and tag-bg-blue, tag-bg-green, tag-bg-yellow, tag-bg-red.',
  'For plain explanations, code review, debugging, and tool-driven work where HTML would add no value, Markdown remains supported.'
].join('\n');
