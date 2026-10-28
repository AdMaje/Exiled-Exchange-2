import { describe, expect, it } from "vitest";
import {
  MT_GUIDE_MAX_TASKS,
  countGuideTasks,
  guideStarter,
  isMtGuideSlug,
  isTaskChecked,
  parseGuideSource,
  setTaskChecked,
  slugifyGuideTitle,
} from "@ipc/mtGuides";
import {
  bundledGuides,
  createGuideEntry,
  guideTaskStats,
  mergeGuides,
  searchGuides,
} from "@/mt/guides/catalog";
import { renderGuideMarkdown } from "@/mt/guides/markdown";

describe("guide frontmatter", () => {
  it("reads title, tags and body", () => {
    const parsed = parseGuideSource(
      "---\ntitle: My guide\ntags: [Divine, trading]\norder: 4\n---\n# Heading\n\nBody\n",
    );

    expect(parsed.title).toBe("My guide");
    expect(parsed.tags).toEqual(["divine", "trading"]);
    expect(parsed.fields.order).toBe("4");
    expect(parsed.body).toBe("# Heading\n\nBody\n");
  });

  it("falls back to the first heading and keeps malformed blocks as body", () => {
    expect(parseGuideSource("# Heading only\n").title).toBe("Heading only");
    expect(parseGuideSource("---\nnot frontmatter\n").body).toContain(
      "not frontmatter",
    );
    expect(parseGuideSource("---\ntitle: Unterminated\n").title).toBe("");
  });

  it("normalizes CRLF and unquotes values", () => {
    const parsed = parseGuideSource(
      '---\r\ntitle: "Quoted title"\r\ntags: "one, two"\r\n---\r\n# X\r\n',
    );
    expect(parsed.title).toBe("Quoted title");
    expect(parsed.tags).toEqual(["one", "two"]);
  });
});

describe("guide slugs", () => {
  it("accepts only the path-safe slug alphabet", () => {
    expect(isMtGuideSlug("my-guide_2")).toBe(true);
    expect(isMtGuideSlug("a")).toBe(true);
    expect(isMtGuideSlug("My-Guide")).toBe(false);
    expect(isMtGuideSlug("-leading")).toBe(false);
    expect(isMtGuideSlug("has space")).toBe(false);
    expect(isMtGuideSlug("../escape")).toBe(false);
    expect(isMtGuideSlug("x".repeat(65))).toBe(false);
  });

  it("derives a safe slug from a title", () => {
    expect(slugifyGuideTitle("Divine Orb: trading 101")).toBe(
      "divine-orb-trading-101",
    );
    expect(slugifyGuideTitle("  ...  ")).toBe("guide");
    expect(slugifyGuideTitle("Ä").length).toBeLessThanOrEqual(48);
    expect(slugifyGuideTitle("x".repeat(120)).length).toBe(48);
  });

  it("ships a starter with two tasks", () => {
    const starter = parseGuideSource(guideStarter("My notes"));
    expect(starter.title).toBe("My notes");
    expect(starter.tags).toEqual(["notes"]);
    expect(countGuideTasks(starter.body)).toBe(2);
  });
});

describe("checklist bitmask", () => {
  it("sets, reads and clears single bits", () => {
    let bits = 0;
    expect(isTaskChecked(bits, 0)).toBe(false);

    bits = setTaskChecked(bits, 0, true);
    bits = setTaskChecked(bits, 2, true);
    expect(isTaskChecked(bits, 0)).toBe(true);
    expect(isTaskChecked(bits, 1)).toBe(false);
    expect(isTaskChecked(bits, 2)).toBe(true);

    bits = setTaskChecked(bits, 0, false);
    expect(isTaskChecked(bits, 0)).toBe(false);
    expect(isTaskChecked(bits, 2)).toBe(true);
  });

  it("ignores out-of-range indexes and invalid stored values", () => {
    expect(setTaskChecked(0, -1, true)).toBe(0);
    expect(setTaskChecked(0, MT_GUIDE_MAX_TASKS, true)).toBe(0);
    expect(setTaskChecked(0, 1.5, true)).toBe(0);
    expect(isTaskChecked(-5, 0)).toBe(false);
    expect(isTaskChecked(Number.NaN, 0)).toBe(false);

    const top = setTaskChecked(0, MT_GUIDE_MAX_TASKS - 1, true);
    expect(Number.isSafeInteger(top)).toBe(true);
    expect(isTaskChecked(top, MT_GUIDE_MAX_TASKS - 1)).toBe(true);
  });

  it("counts only list-style task items", () => {
    const body = "- [ ] one\n- [x] two\n  - [X] nested\n\n[ ] not a task";
    expect(countGuideTasks(body)).toBe(3);

    const bits = setTaskChecked(setTaskChecked(0, 1, true), 2, true);
    expect(guideTaskStats(body, bits)).toEqual({ total: 3, checked: 2 });
  });
});

describe("bundled guide catalog", () => {
  it("bundles the three sample guides in order", () => {
    expect(bundledGuides.map((entry) => entry.slug)).toEqual([
      "how-to-use-this-hub",
      "first-steps-checklist",
      "economy-basics",
    ]);
    for (const entry of bundledGuides) {
      expect(entry.source).toBe("bundled");
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.body.length).toBeGreaterThan(0);
      expect(entry.tags.length).toBeGreaterThan(0);
    }
  });

  it("lets user guides override a bundled slug", () => {
    const user = createGuideEntry(
      "economy-basics",
      "---\ntitle: User override\n---\n# User\n",
      "user",
      123,
    );
    const merged = mergeGuides(bundledGuides, [user]);

    expect(
      merged.find((entry) => entry.slug === "economy-basics"),
    ).toMatchObject({ title: "User override", source: "user", updatedAt: 123 });
    expect(merged.length).toBe(bundledGuides.length);
  });

  it("searches title, tags and body with AND semantics", () => {
    expect(
      searchGuides(bundledGuides, "divine").map((entry) => entry.slug),
    ).toContain("economy-basics");
    expect(searchGuides(bundledGuides, "checklist setup")).toHaveLength(1);
    expect(searchGuides(bundledGuides, "checklist divine")).toHaveLength(0);
    expect(searchGuides(bundledGuides, "  ")).toHaveLength(
      bundledGuides.length,
    );
  });
});

describe("guide markdown rendering", () => {
  it("renders task items as checkboxes with stable indexes", () => {
    const rendered = renderGuideMarkdown(
      "- [ ] first\n- [x] second\n- [ ] third\n",
      setTaskChecked(0, 1, true),
    );

    expect(rendered.total).toBe(3);
    expect(rendered.html.match(/data-mt-task="/g)).toHaveLength(3);

    const first =
      /<input[^>]*data-mt-task="0"[^>]*>/.exec(rendered.html)?.[0] ?? "";
    const second =
      /<input[^>]*data-mt-task="1"[^>]*>/.exec(rendered.html)?.[0] ?? "";
    expect(first).not.toContain("checked");
    expect(second).toContain("checked");
  });

  it("escapes raw HTML from guide files", () => {
    const rendered = renderGuideMarkdown(
      '<script>alert("x")</script>\n\n<img src=x onerror=alert(1)>',
      0,
    );
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).not.toContain("<img src=x");
    expect(rendered.html).toContain("&lt;script&gt;");
  });

  it("does not turn a plain paragraph into a checkbox", () => {
    const rendered = renderGuideMarkdown("[ ] not a task\n", 0);
    expect(rendered.total).toBe(0);
    expect(rendered.html).not.toContain("mt-task");
  });

  it("opens links and images safely", () => {
    const rendered = renderGuideMarkdown(
      "[site](https://example.com)\n\n![alt](https://example.com/a.png)",
      0,
    );
    expect(rendered.html).toContain('target="_blank"');
    expect(rendered.html).toContain('rel="noopener noreferrer"');
    expect(rendered.html).toContain('referrerpolicy="no-referrer"');
    expect(rendered.html).toContain('loading="lazy"');
  });
});
