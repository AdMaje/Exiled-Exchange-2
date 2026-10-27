import { defineAsyncComponent, type Component } from "vue";

export interface MtModule {
  id: string;
  /** Key in the fork-local mt i18n messages. */
  titleKey: string;
  /** Font Awesome class. */
  icon?: string;
  component: Component;
}

/**
 * One entry per hub tab. Adding a module = one entry + one component; nothing
 * else in the shell needs to change. Phase 2 ships placeholders only.
 */
export const mtModules: MtModule[] = [
  {
    id: "economy",
    titleKey: "modules.economy.title",
    icon: "fa-solid fa-coins",
    component: defineAsyncComponent(
      () => import("./modules/economy/EconomyModule.vue"),
    ),
  },
  {
    id: "guides",
    titleKey: "modules.guides.title",
    icon: "fa-solid fa-book-open",
    component: defineAsyncComponent(
      () => import("./modules/guides/GuidesModule.vue"),
    ),
  },
  {
    id: "widgets",
    titleKey: "modules.widgets.title",
    icon: "fa-solid fa-table-cells-large",
    component: defineAsyncComponent(
      () => import("./modules/widgets/WidgetsModule.vue"),
    ),
  },
];

/** Unknown ids fall back to the first module so a stale link still renders. */
export function findMtModule(id: string | null | undefined): MtModule {
  return mtModules.find((module) => module.id === id) ?? mtModules[0];
}
