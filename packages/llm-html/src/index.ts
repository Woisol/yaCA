import { refractor } from 'refractor';

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
  color: #28313a;
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
  min-width: 0;
}
.col-con > * {
  min-width: 0;
  overflow-wrap: break-word;
}
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 18px 26px;
  align-items: stretch;
}

.step {
  position: relative;
  flex: 1 1 300px;
  min-width: min(100%, 300px);
  padding: 14px 16px;
  border: 1px solid var(--llm-line);
  border-radius: 10px;
  background: var(--llm-panel);
  box-shadow: 0 10px 24px rgb(30 37 43 / 8%);
}

.step:not(:last-child)::after {
  content: '->';
  position: absolute;
  top: 50%;
  right: -22px;
  color: var(--llm-muted);
  font-weight: 800;
  transform: translateY(-50%);
}

.step:nth-child(2) {
  display: inline-block;
}

.step-check {
  display: inline-block;
  margin: 0 8px 0 0;
  vertical-align: -2px;
}

.step:has(.step-check:checked) {
  color: var(--llm-muted);
  text-decoration: line-through;
}

.token.comment,
.token.prolog,
.token.doctype,
.token.cdata {
  color: #6b7280;
}

.token.punctuation {
  color: #667085;
}

.token.property,
.token.tag,
.token.boolean,
.token.number,
.token.constant,
.token.symbol {
  color: #b42318;
}

.token.selector,
.token.attr-name,
.token.string,
.token.char,
.token.builtin,
.token.inserted {
  color: #067647;
}

.token.operator,
.token.entity,
.token.url,
.token.variable {
  color: #175cd3;
}

.token.atrule,
.token.attr-value,
.token.keyword {
  color: #6941c6;
}

.token.function,
.token.class-name {
  color: #b54708;
}

.token.regex,
.token.important {
  color: #c11574;
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

  .step {
    width: 100%;
    min-width: 100%;
  }

  .step:not(:last-child)::after {
    top: auto;
    right: 50%;
    bottom: -20px;
    transform: translateX(50%) rotate(90deg);
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
      const checkbox = document.createElement('input');
      checkbox.className = 'step-check';
      checkbox.type = 'checkbox';
      checkbox.setAttribute('aria-label', 'Mark step ' + (index + 1) + ' complete');
      step.prepend(checkbox);
    });
  }

  function initLlmHtmlRuntime() {
    initLlmHtmlColumns();
    initLlmHtmlTabs();
    initLlmHtmlSteps();
  }

  window.__yacaInitLlmHtmlRuntime = initLlmHtmlRuntime;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLlmHtmlRuntime, { once: true });
  } else {
    initLlmHtmlRuntime();
  }
})();
`;

export const LLM_HTML_PROMPT = [
  'HTML-first output for yaCA Web:',
  'When an answer benefits from visual structure, output only <body>...</body> HTML content. Do not output document declarations, <html>, <head>, <style>, or <script>.',
  'The web UI renders the body content in an isolated iframe and injects preset CSS and interaction JS.',
  'Do not write scripts. Do not rely on inline style or custom CSS.',
  'Use normal HTML for headings, paragraphs, lists, tables, links, and strong text.',
  'Preset names are CSS class names, not custom elements: write <div class="note-info">...</div>, never <note-info>...</note-info>.',
  'Available preset components: note-info, note-success, note-warning, note-danger; details.collapse; .tabs with child .tab[data-label]; .col-con with children .col-1, .col-2, etc.; .steps with child .step; inline tags tag-blue, tag-green, tag-yellow, tag-red and tag-bg-blue, tag-bg-green, tag-bg-yellow, tag-bg-red.',
  'For higher information density, combine related content with col-con and tabs, collapse lower-priority detail with details.collapse, and avoid relying on fenced code blocks as the primary layout.',
  'For plain explanations, code review, debugging, and tool-driven work where HTML would add no value, Markdown remains supported.'
].join('\n');

export const LLM_HTML_MESSAGE_CHANNEL = 'yaca.llm-html';

export type LlmHtmlPayloadMode = 'stream' | 'final';

export function createLlmHtmlShellDocument(options: { frameId: string; token: string }): string {
  const { frameId, token } = options;
  const csp = `default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'nonce-${token}'; font-src data:; media-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none';`;
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta http-equiv="Content-Security-Policy" content="${escapeHtmlAttribute(csp)}">`,
    `<style data-yaca-llm-html-style>${LLM_HTML_STYLES}</style>`,
    '</head>',
    '<body>',
    '<div id="llm-html-root"></div>',
    `<script nonce="${escapeHtmlAttribute(token)}" data-yaca-llm-html-runtime>${LLM_HTML_INTERACTION_SCRIPT}${createShellRuntimeScript(frameId, token)}</script>`,
    '</body>',
    '</html>'
  ].join('');
}

export function createLlmHtmlPayload(input: string, options: { mode: LlmHtmlPayloadMode }): string {
  const body = extractBodyContent(input.trim());
  const normalized = normalizePresetElements(sanitizeAuthoredHtml(body));
  return options.mode === 'final' ? highlightCodeBlocks(normalized) : normalized;
}

function createShellRuntimeScript(frameId: string, token: string): string {
  const config = JSON.stringify({ channel: LLM_HTML_MESSAGE_CHANNEL, frameId, token });
  return String.raw`
(() => {
  const config = ${config};
  const root = document.getElementById('llm-html-root');
  let pendingHeightFrame = 0;

  function isFrameMessage(event) {
    const data = event.data;
    return data
      && typeof data === 'object'
      && data.channel === config.channel
      && data.frameId === config.frameId
      && data.token === config.token;
  }

  function reportHeight() {
    const body = document.body;
    const doc = document.documentElement;
    const rootRect = root ? root.getBoundingClientRect() : { height: 0 };
    const height = Math.ceil(Math.max(
      root ? root.scrollHeight : 0,
      rootRect.height,
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      doc ? doc.scrollHeight : 0,
      doc ? doc.offsetHeight : 0
    ));
    window.parent.postMessage({
      channel: config.channel,
      type: 'height',
      frameId: config.frameId,
      token: config.token,
      height
    }, '*');
  }

  function scheduleHeightReport() {
    if (pendingHeightFrame) cancelAnimationFrame(pendingHeightFrame);
    pendingHeightFrame = requestAnimationFrame(() => {
      pendingHeightFrame = 0;
      reportHeight();
    });
  }

  window.addEventListener('message', (event) => {
    if (!isFrameMessage(event)) return;
    const data = event.data;
    if (data.type !== 'update' || !root) return;
    root.innerHTML = typeof data.html === 'string' ? data.html : '';
    if (typeof window.__yacaInitLlmHtmlRuntime === 'function') {
      window.__yacaInitLlmHtmlRuntime();
    }
    scheduleHeightReport();
  });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleHeightReport);
    if (root) observer.observe(root);
    observer.observe(document.body);
    observer.observe(document.documentElement);
  }

  window.addEventListener('load', scheduleHeightReport);
  document.addEventListener('toggle', scheduleHeightReport, true);
  scheduleHeightReport();
})();
`;
}

function extractBodyContent(input: string): string {
  const bodyOpen = /<body\b[^>]*>/i.exec(input);
  if (!bodyOpen) return '';
  const afterBodyOpen = input.slice(bodyOpen.index + bodyOpen[0].length);
  const bodyClose = /<\/body\s*>/i.exec(afterBodyOpen);
  return bodyClose ? afterBodyOpen.slice(0, bodyClose.index) : afterBodyOpen;
}

function sanitizeAuthoredHtml(html: string): string {
  return sanitizeUrlAttributes(html
    .replace(/<\s*(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?(?:<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/<\s*(link|meta|base)\b[^>]*(?:>|$)/gi, '')
    .replace(/\s+on[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi, '')
    .replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi, '')
    .replace(/\s+srcset\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi, ''));
}

function sanitizeUrlAttributes(html: string): string {
  return html
    .replace(/\s+(href|src|xlink:href)\s*=\s*(["'])(.*?)\2/gi, (_match: string, attrName: string, quote: string, value: string) => {
      return ` ${attrName}=${quote}${escapeHtmlAttribute(toSafeUrlAttribute(attrName, value))}${quote}`;
    })
    .replace(/\s+(href|src|xlink:href)\s*=\s*([^\s"'=<>`]+)/gi, (_match: string, attrName: string, value: string) => {
      return ` ${attrName}="${escapeHtmlAttribute(toSafeUrlAttribute(attrName, value))}"`;
    });
}

function toSafeUrlAttribute(attrName: string, value: string): string {
  const trimmed = value.trim();
  if (isSafeUrl(trimmed, attrName)) return trimmed;
  return attrName.toLowerCase() === 'href' || attrName.toLowerCase() === 'xlink:href' ? '#' : '';
}

function isSafeUrl(value: string, attrName: string): boolean {
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(value)) return true;
  if (/^blob:/i.test(value)) return true;
  if (/^data:image\//i.test(value) && attrName.toLowerCase() === 'src') return true;
  return false;
}

function normalizePresetElements(html: string): string {
  const blockClasses = ['note-info', 'note-success', 'note-warning', 'note-danger', 'collapse', 'tabs', 'tab', 'col-con', 'steps', 'step'];
  const inlineClasses = ['tag-blue', 'tag-green', 'tag-yellow', 'tag-red', 'tag-bg-blue', 'tag-bg-green', 'tag-bg-yellow', 'tag-bg-red'];
  let normalized = html;

  for (const className of blockClasses) {
    normalized = replaceCustomElement(normalized, className, 'div');
  }
  for (const className of inlineClasses) {
    normalized = replaceCustomElement(normalized, className, 'span');
  }

  return normalized;
}

function replaceCustomElement(html: string, name: string, tagName: 'div' | 'span'): string {
  const elementPattern = new RegExp(`<${name}(\\s[^>]*)?>([\\s\\S]*?)<\\/${name}\\s*>`, 'gi');
  const selfClosingPattern = new RegExp(`<${name}(\\s[^>]*)?\\/>`, 'gi');

  return html
    .replace(elementPattern, (_match: string, attrs = '', content: string) => `<${tagName}${mergeClassAttribute(attrs, name)}>${content}</${tagName}>`)
    .replace(selfClosingPattern, (_match: string, attrs = '') => `<${tagName}${mergeClassAttribute(attrs, name)}></${tagName}>`);
}

function mergeClassAttribute(attrs: string, className: string): string {
  const source = attrs ?? '';
  if (/\sclass\s*=/i.test(source)) {
    return source.replace(/\sclass\s*=\s*(["'])(.*?)\1/i, (_match: string, quote: string, value: string) => {
      const classes = value.split(/\s+/).filter(Boolean);
      if (!classes.includes(className)) classes.unshift(className);
      return ` class=${quote}${classes.join(' ')}${quote}`;
    });
  }
  return ` class="${className}"${source}`;
}

function highlightCodeBlocks(html: string): string {
  return html.replace(/<pre\b([^>]*)>\s*<code\b([^>]*)>([\s\S]*?)<\/code\s*>\s*<\/pre\s*>/gi, (match: string, preAttrs: string, codeAttrs: string, encodedCode: string) => {
    const language = getCodeLanguage(codeAttrs);
    if (!language || !refractor.registered(language)) return match;
    const code = decodeHtml(encodedCode);
    const highlighted = toHtml(refractor.highlight(code, language).children);
    return `<pre${preAttrs}><code${codeAttrs}>${highlighted}</code></pre>`;
  });
}

function getCodeLanguage(attrs: string): string | null {
  const match = /\bclass\s*=\s*(["'])(.*?)\1/i.exec(attrs);
  const className = match?.[2] ?? '';
  const language = /(?:^|\s)language-([^\s]+)/i.exec(className)?.[1] ?? null;
  if (!language) return null;
  if (language.toLowerCase() === 'js') return 'javascript';
  if (language.toLowerCase() === 'ts') return 'typescript';
  return language.toLowerCase();
}

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function toHtml(nodes: HastNode[]): string {
  return nodes.map((node) => {
    if (node.type === 'text') return escapeHtmlText(node.value ?? '');
    if (node.type !== 'element' || !node.tagName) return '';
    const attrs = propertiesToAttributes(node.properties ?? {});
    return `<${node.tagName}${attrs}>${toHtml(node.children ?? [])}</${node.tagName}>`;
  }).join('');
}

function propertiesToAttributes(properties: Record<string, unknown>): string {
  return Object.entries(properties)
    .map(([name, value]) => {
      if (value === null || value === undefined || value === false) return '';
      const attrName = name === 'className' ? 'class' : name;
      const attrValue = Array.isArray(value) ? value.join(' ') : String(value);
      return ` ${attrName}="${escapeHtmlAttribute(attrValue)}"`;
    })
    .join('');
}

function decodeHtml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeHtmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replaceAll('"', '&quot;');
}
