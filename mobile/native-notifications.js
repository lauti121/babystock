import { Capacitor } from "@capacitor/core";
import OneSignal from "@onesignal/capacitor-plugin";
import { notificationsConfig } from "../notifications-config.js";

const configured = !notificationsConfig.oneSignalAppId.startsWith("PEGA_AQUI");
let started = false;

async function start() {
  if (!Capacitor.isNativePlatform() || !configured) return false;
  if (!started) {
    await OneSignal.initialize({ appId: notificationsConfig.oneSignalAppId });
    started = true;
  }
  return true;
}

window.BabyStockNativePush = {
  isNative: () => Capacitor.isNativePlatform(),
  isConfigured: () => configured,
  async identify(externalId) {
    if (!(await start())) return false;
    await OneSignal.login(externalId);
    return true;
  },
  async requestPermission(externalId) {
    if (!(await start())) return { ok: false, reason: "not-configured" };
    await OneSignal.login(externalId);
    const granted = await OneSignal.Notifications.requestPermission(true);
    return { ok: Boolean(granted) };
  },
  async clearIdentity() {
    if (!started) return;
    await OneSignal.logout();
  }
};
