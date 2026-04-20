import { app } from "electron";
import { performLogin } from "../src/main/services/aipriService.js";
import { getStore, initStore } from "../src/main/store.js";

const summarizeCookieString = (cookieString) => {
  if (!cookieString) return "(empty)";
  const names = cookieString
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((pair) => pair.split("=")[0])
    .filter(Boolean);
  const uniqueNames = [...new Set(names)];
  return `${uniqueNames.join(",")} (parts=${names.length})`;
};

async function main() {
  await app.whenReady();
  await initStore();

  const store = getStore();
  const activeAccountName = store.get("aipriActiveAccountName");
  const accounts = store.get("aipriAccounts") || [];
  const account = accounts.find((acc) => acc.name === activeAccountName);

  if (!account) {
    console.error("[Debug] active account not found");
    app.quit();
    return;
  }

  console.log("[Debug] target account:", account.name, account.cardId);
  console.log("[Debug] existing session:", summarizeCookieString(account.sessionCookie || ""));

  const result = await performLogin({
    cardId: account.cardId,
    name: account.name,
    birthdayM: account.birthdayM,
    birthdayD: account.birthdayD,
  });

  console.log("[Debug] login success:", result.success);
  console.log("[Debug] login cookie summary:", summarizeCookieString(result.cookies || ""));
  console.log(
    "[Debug] has PHPSESSID / MYPAPSSID:",
    Boolean(result.cookies && result.cookies.includes("PHPSESSID=")),
    Boolean(result.cookies && result.cookies.includes("MYPAPSSID=")),
  );
  console.log("[Debug] profileImageUrl:", result.profileImageUrl || "(none)");
  if (!result.success) {
    console.log("[Debug] error:", result.error || "(none)");
  }

  app.quit();
}

main().catch((error) => {
  console.error("[Debug] fatal:", error);
  app.quit();
});
