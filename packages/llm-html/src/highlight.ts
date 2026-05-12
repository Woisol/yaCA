import { refractor } from 'refractor/all';

export function highlightLlmHtmlCodeBlocks(html: string): string {
  return html.replace(/<pre\b([^>]*)>\s*<code\b([^>]*)>([\s\S]*?)<\/code\s*>\s*<\/pre\s*>/gi, (match: string, preAttrs: string, codeAttrs: string, encodedCode: string) => {
    const language = getCodeLanguage(codeAttrs, encodedCode);
    if (!language || !refractor.registered(language)) return match;
    const code = decodeHtml(encodedCode);
    const highlighted = toHtml(refractor.highlight(code, language).children);
    return `<pre${preAttrs}><code${codeAttrs}>${highlighted}</code></pre>`;
  });
}

function getCodeLanguage(attrs: string, encodedCode: string): string | null {
  const match = /\bclass\s*=\s*(["'])(.*?)\1/i.exec(attrs);
  const className = match?.[2] ?? '';
  const language = /(?:^|\s)language-([^\s]+)/i.exec(className)?.[1] ?? null;
  if (!language) return inferCodeLanguage(decodeHtml(encodedCode));
  const normalized = language.toLowerCase();
  if (normalized === 'js') return 'javascript';
  if (normalized === 'ts') return 'typescript';
  if (normalized === 'sh' || normalized === 'shell') return 'bash';
  if (normalized === 'html' || normalized === 'xml') return 'markup';
  return normalized;
}

function inferCodeLanguage(code: string): string | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  if (/^[$#]\s|(?:^|\n)\s*(?:npm|pnpm|yarn|git|cd|echo|curl)\s/.test(trimmed)) return 'bash';
  if (/^\s*[{\[][\s\S]*[\]}]\s*$/.test(trimmed)) return 'json';
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) return 'markup';
  if (/\b(import|export|const|let|var|function|class|return|async|await|type|interface)\b/.test(trimmed)) return 'javascript';
  return null;
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
