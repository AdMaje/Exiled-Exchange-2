import { createApp, watch } from "vue";
import App from "./web/App.vue";
import * as I18n from "./web/i18n";
import * as Data from "./assets/data";
import { initConfig, AppConfig } from "./web/Config";
import { Host } from "./web/background/IPC";
(async function () {
  // MT: fork hub entry. Runs before upstream init so the hub never reads the
  // overlay config, never sends `used-recently` and never opens the event
  // WebSocket (which would hijack last-active item text).
  if (new URLSearchParams(window.location.search).get("mt") === "hub") {
    const { mountMtHub } = await import("./mt/bootstrap");
    await mountMtHub();
    return;
  }

  await initConfig();
  const i18nPlugin = await I18n.init(AppConfig().language);
  await Data.init(AppConfig().language);
  await Host.init();

  watch(
    () => AppConfig().language,
    async () => {
      await Data.loadForLang(AppConfig().language);
      await I18n.loadLang(AppConfig().language);
    },
  );

  const app = createApp(App);
  app.use(i18nPlugin);
  app.mount("#app");
  if (import.meta.env.DEV) {
    app.config.performance = true;
    console.error("DEV MODE");
  }
})();
