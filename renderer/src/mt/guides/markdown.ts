/**
 * MT: Markdown rendering for guides.
 *
 * markdown-it is configured with `html: false`: user guide files are data, not
 * trusted HTML. The only raw HTML emitted is the checkbox we create ourselves.
 * Links and images get safe external attributes because the hub must not
 * navigate away from its local page.
 */
import MarkdownIt from "markdown-it";
import { MT_GUIDE_MAX_TASKS, isTaskChecked } from "@ipc/mtGuides";

interface GuideEnv {
  mtProgress: number;
  mtTaskCount?: number;
}

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false,
});

function insideListItem(
  tokens: ReadonlyArray<{ type: string; level: number }>,
  index: number,
): boolean {
  const level = tokens[index].level;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const token = tokens[cursor];
    if (token.type === "list_item_close" && token.level < level) return false;
    if (token.type === "list_item_open" && token.level < level) return true;
  }
  return false;
}

md.core.ruler.after("inline", "mt_task_list", (state) => {
  let taskIndex = 0;

  for (let index = 0; index < state.tokens.length; index += 1) {
    const token = state.tokens[index];
    if (token.type !== "inline" || !token.children?.length) continue;
    if (!insideListItem(state.tokens, index)) continue;

    const first = token.children[0];
    if (first.type !== "text") continue;

    const match = /^\[([ xX])\]\s+/.exec(first.content);
    if (!match) continue;

    const progress = (state.env as GuideEnv).mtProgress ?? 0;
    const persisted = taskIndex < MT_GUIDE_MAX_TASKS;
    const checked = persisted && isTaskChecked(progress, taskIndex);
    const attrs = persisted ? ` data-mt-task="${taskIndex}"` : " disabled";
    const box = new state.Token("html_inline", "", 0);
    box.content = `<input type="checkbox" class="mt-task" aria-label="Checklist item"${attrs}${
      checked ? " checked" : ""
    } /> `;

    first.content = first.content.slice(match[0].length);
    token.children.unshift(box);
    taskIndex += 1;
  }

  (state.env as GuideEnv).mtTaskCount = taskIndex;
});

const defaultLinkOpen =
  md.renderer.rules.link_open ??
  ((tokens, index, options, _env, self) =>
    self.renderToken(tokens, index, options));

md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  const token = tokens[index];
  token.attrSet("target", "_blank");
  token.attrSet("rel", "noopener noreferrer");
  return defaultLinkOpen(tokens, index, options, env, self);
};

const defaultImage =
  md.renderer.rules.image ??
  ((tokens, index, options, _env, self) =>
    self.renderToken(tokens, index, options));

md.renderer.rules.image = (tokens, index, options, env, self) => {
  const token = tokens[index];
  token.attrSet("loading", "lazy");
  token.attrSet("referrerpolicy", "no-referrer");
  return defaultImage(tokens, index, options, env, self);
};

export interface RenderedGuide {
  html: string;
  total: number;
}

export function renderGuideMarkdown(
  body: string,
  progress: number,
): RenderedGuide {
  const env: GuideEnv = { mtProgress: progress };
  const html = md.render(body, env);
  return { html, total: env.mtTaskCount ?? 0 };
}
