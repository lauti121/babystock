import { Capacitor } from "@capacitor/core";
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";

window.BabyStockNativeAuth = {
  isNative: () => Capacitor.isNativePlatform(),
  async signInWithGoogle() {
    if (!Capacitor.isNativePlatform()) throw new Error("El ingreso nativo solo está disponible en Android.");
    return FirebaseAuthentication.signInWithGoogle();
  }
};
