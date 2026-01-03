import fs from "node:fs/promises";
import path from "node:path";

export type LandioTemplate = {
  inlineCss: string;
  bodyHtml: string;
};

function extractFirst(match: RegExpMatchArray | null): string {
  if (!match || match.length < 2) return "";
  return match[1] ?? "";
}

function rewriteInternalLinks(html: string): string {
  return html
    .replaceAll('href="index.html"', 'href="/"')
    .replaceAll('href="swap.html"', 'href="/swap"')
    .replaceAll('href="rewards.html"', 'href="/rewards"')
    .replaceAll('href="status.html"', 'href="/status"')
    .replaceAll('href="settings.html"', 'href="/settings"')
    .replaceAll('href="blog.html"', 'href="/blog"')
    .replaceAll('href="contact.html"', 'href="/contact"')
    .replaceAll('href="privacy.html"', 'href="/privacy"')
    .replaceAll('href="terms.html"', 'href="/terms"');
}

function stripNavFooterAndScripts(bodyHtml: string): string {
  // Remove the fixed nav and footer; we re-render nav in React for correct active state + wallet.
  let out = bodyHtml;

  out = out.replace(/<nav\s+class="nav"[\s\S]*?<\/nav>/i, "");
  out = out.replace(/<footer\s+class="footer"[\s\S]*?<\/footer>/i, "");

  // Remove inline scripts from the templates; page controllers re-implement needed behavior.
  out = out.replace(/<script>[\s\S]*?<\/script>/gi, "");

  return out;
}

export async function loadLandioTemplate(fileName: string): Promise<LandioTemplate> {
  const filePath = path.join(process.cwd(), "public", "landio", fileName);
  const raw = await fs.readFile(filePath, "utf8");

  const inlineCss = extractFirst(raw.match(/<style>([\s\S]*?)<\/style>/i));
  const bodyHtml = extractFirst(raw.match(/<body>([\s\S]*?)<\/body>/i));

  const cleanedBody = rewriteInternalLinks(stripNavFooterAndScripts(bodyHtml));

  return {
    inlineCss,
    bodyHtml: cleanedBody.trim(),
  };
}
