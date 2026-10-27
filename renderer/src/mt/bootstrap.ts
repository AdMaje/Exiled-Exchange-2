import { createApp } from "vue";
import { fetchMtConfig, type MtHostState } from "./api";
import { createMtI18n } from "./i18n";
import MtHubApp from "./MtHubApp.vue";
import "./mt.css";

/**
 * MT: boot the fork hub. Deliberately does not import the overlay config, the
 * data loader or the IPC/WebSocket host: the hub must not be a WS client.
 */
export async function mountMtHub(): Promise<void> {
  let initialConfig: MtHostState | null = null;
  try {
    initialConfig = await fetchMtConfig();
  } catch {
    initialConfig = null;
  }

  document.title = "PoE2 MultiTool";

  const app = createApp(MtHubApp, { initialConfig });
  app.use(createMtI18n(initialConfig?.mt.language ?? "auto"));
  app.mount("#app");

  if (import.meta.env.DEV) {
    app.config.performance = true;
  }
}
