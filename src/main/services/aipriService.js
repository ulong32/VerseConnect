import { randomUUID } from "crypto";
import { net, session } from "electron";
import fs from "fs";
import path from "path";
import { getProfileImagesDir, getStore } from "../store.js";

const AIPRI_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const AIPRI_BASE_URL = "https://aipri.jp";
const AIPRI_CDN_BASE_URL = "https://cdnaipriimg01.blob.core.windows.net";

/**
 * @typedef {{
 *   accountId?: string,
 *   name: string,
 *   cardId: string,
 *   birthdayM: string,
 *   birthdayD: string,
 *   sessionCookie: string | null,
 *   profileImagePath: string | null
 * }} AipriAccount
 */

/** @param {string | null | undefined} cookieString */
const summarizeCookieString = (cookieString) => {
  if (!cookieString) return "(empty)";
  const names = cookieString
    .split(";")
    .map((/** @type {string} */ part) => part.trim())
    .filter(Boolean)
    .map((/** @type {string} */ pair) => pair.split("=")[0])
    .filter(Boolean);
  const uniqueNames = [...new Set(names)];
  return `${uniqueNames.join(",")} (parts=${names.length})`;
};

/** @param {string | null | undefined} cookieString */
const hasRequiredSessionCookies = (cookieString) =>
  Boolean(
    cookieString && cookieString.includes("PHPSESSID=") && cookieString.includes("MYPAPSSID="),
  );

/**
 * Ensure account IDs exist and active account fields are consistent.
 * @param {ReturnType<typeof getStore>} store
 */
const getNormalizedAipriState = (store) => {
  const rawAccounts = /** @type {AipriAccount[]} */ (store.get("aipriAccounts") || []);
  let accountsChanged = false;
  const accounts = rawAccounts.map((account) => {
    if (account.accountId) return account;
    accountsChanged = true;
    return { ...account, accountId: randomUUID() };
  });

  let activeAccountId = store.get("aipriActiveAccountId") || null;
  const activeAccountName = store.get("aipriActiveAccountName") || null;
  if (!activeAccountId && activeAccountName) {
    activeAccountId =
      accounts.find((account) => account.name === activeAccountName)?.accountId || null;
  }

  if (activeAccountId && !accounts.some((account) => account.accountId === activeAccountId)) {
    activeAccountId = null;
  }

  const activeAccount = activeAccountId
    ? accounts.find((account) => account.accountId === activeAccountId)
    : null;
  const resolvedActiveName = activeAccount?.name || null;

  if (accountsChanged) {
    store.set("aipriAccounts", accounts);
  }
  if ((store.get("aipriActiveAccountId") || null) !== activeAccountId) {
    store.set("aipriActiveAccountId", activeAccountId);
  }
  if ((store.get("aipriActiveAccountName") || null) !== resolvedActiveName) {
    store.set("aipriActiveAccountName", resolvedActiveName);
  }

  return {
    accounts,
    activeAccountId,
    activeAccountName: resolvedActiveName,
  };
};

/** @param {Electron.Cookie[]} cookies */
const stringifyCookies = (cookies) => cookies.map((c) => `${c.name}=${c.value}`).join("; ");

/**
 * Parse Set-Cookie header and extract cookies
 * @param {string[]} setCookieHeaders
 * @returns {string}
 */
export const parseCookies = (setCookieHeaders) => {
  if (!setCookieHeaders || setCookieHeaders.length === 0) return "";
  const parsed = setCookieHeaders.map((cookie) => cookie.split(";")[0]).join("; ");
  console.log(
    "[Aipri Debug] parseCookies headers:",
    setCookieHeaders.length,
    "=>",
    summarizeCookieString(parsed),
  );
  return parsed;
};

/**
 * Extract profile image URL from HTML
 * @param {string} html
 * @returns {string | null}
 */
export const extractProfileImage = (html) => {
  // Find img with class containing "profile_thumbImage"
  const match = html.match(/<img[^>]*class="[^"]*profile_thumbImage[^"]*"[^>]*src="([^"]+)"/);
  if (match && match[1]) {
    // If relative URL, make it absolute
    const src = match[1];
    if (src.startsWith("/")) {
      return AIPRI_BASE_URL + src;
    }
    return src;
  }
  // Try alternate pattern where src comes before class
  const altMatch = html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*profile_thumbImage[^"]*"/);
  if (altMatch && altMatch[1]) {
    const src = altMatch[1];
    if (src.startsWith("/")) {
      return AIPRI_BASE_URL + src;
    }
    return src;
  }
  return null;
};

/**
 * Get active account's session cookie
 * @returns {string | null}
 */
export const getActiveSessionCookie = () => {
  const store = getStore();
  const { accounts, activeAccountId } = getNormalizedAipriState(store);
  if (!activeAccountId) return null;

  const activeAccount = accounts.find((acc) => acc.accountId === activeAccountId);
  return activeAccount?.sessionCookie || null;
};

/**
 * Update active account's session cookie
 * @param {string} sessionCookie
 */
export const updateActiveSessionCookie = (sessionCookie) => {
  const store = getStore();
  const { accounts, activeAccountId } = getNormalizedAipriState(store);
  if (!activeAccountId) return;

  const updatedAccounts = accounts.map((acc) =>
    acc.accountId === activeAccountId ? { ...acc, sessionCookie } : acc,
  );
  store.set("aipriAccounts", updatedAccounts);
};

/**
 * Clear all aipri.jp cookies and set new ones from cookie string
 * This ensures net.fetch uses the correct account's session
 * @param {string} cookieString
 */
export const setAipriSessionCookies = async (cookieString) => {
  try {
    console.log("[Aipri Debug] setAipriSessionCookies input:", summarizeCookieString(cookieString));
    // First clear existing cookies
    const existingCookies = await session.defaultSession.cookies.get({ url: AIPRI_BASE_URL });
    for (const cookie of existingCookies) {
      await session.defaultSession.cookies.remove(AIPRI_BASE_URL, cookie.name);
    }
    const mypageCookies = await session.defaultSession.cookies.get({
      url: `${AIPRI_BASE_URL}/mypage/`,
    });
    for (const cookie of mypageCookies) {
      await session.defaultSession.cookies.remove(`${AIPRI_BASE_URL}/mypage/`, cookie.name);
    }

    // Parse and set new cookies
    if (cookieString) {
      const cookies = cookieString
        .split(";")
        .map((c) => c.trim())
        .filter((c) => c);
      for (const cookie of cookies) {
        const [name, ...valueParts] = cookie.split("=");
        const value = valueParts.join("=");
        if (name && value) {
          // Set cookie for both paths
          await session.defaultSession.cookies.set({
            url: AIPRI_BASE_URL,
            name: name.trim(),
            value: value.trim(),
            path: "/",
          });
          await session.defaultSession.cookies.set({
            url: `${AIPRI_BASE_URL}/mypage/`,
            name: name.trim(),
            value: value.trim(),
            path: "/mypage/",
          });
        }
      }
    }
  } catch (err) {
    console.error("Error setting aipri session cookies:", err);
  }
};

/**
 * Download and save profile image locally
 * @param {string} imageUrl
 * @param {string} accountName
 * @param {string} [sessionCookie] - Optional session cookie for authenticated download
 * @returns {Promise<string | null>}
 */
export const downloadAndSaveProfileImage = async (imageUrl, accountName, sessionCookie) => {
  console.log("[Profile Image] Downloading for account:", accountName, "URL:", imageUrl);
  try {
    // Set session cookies only when explicitly provided.
    if (sessionCookie) {
      await setAipriSessionCookies(sessionCookie);
    }

    const response = await net.fetch(imageUrl, {
      headers: { "User-Agent": AIPRI_USER_AGENT },
    });

    if (!response.ok) {
      console.error("Failed to download profile image:", response.status);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    // Sanitize account name for filename
    const safeAccountName = accountName.replace(/[<>:"/\\|?*]/g, "_");
    const filename = `${safeAccountName}.jpg`;
    const profileImagesDir = getProfileImagesDir();
    const filePath = path.join(profileImagesDir, filename);
    console.log("[Profile Image] Saving to:", filePath, "Buffer size:", buffer.length);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (error) {
    console.error("Error downloading profile image:", error);
    return null;
  }
};

/**
 * Perform login and return cookies
 * @param {{cardId: string, name: string, birthdayM: string, birthdayD: string}} credentials
 * @returns {Promise<{success: boolean, cookies?: string, profileImageUrl?: string, error?: string}>}
 */
export const performLogin = async (credentials) => {
  const { cardId, name, birthdayM, birthdayD } = credentials;

  try {
    console.log("[Aipri Debug] performLogin start:", { name, cardId });
    // Clear existing aipri.jp cookies to prevent session contamination
    const existingCookies = await session.defaultSession.cookies.get({ url: AIPRI_BASE_URL });
    for (const cookie of existingCookies) {
      await session.defaultSession.cookies.remove(AIPRI_BASE_URL, cookie.name);
    }
    const mypageCookies = await session.defaultSession.cookies.get({
      url: `${AIPRI_BASE_URL}/mypage/`,
    });
    for (const cookie of mypageCookies) {
      await session.defaultSession.cookies.remove(`${AIPRI_BASE_URL}/mypage/`, cookie.name);
    }

    // Build form data
    const formData = new URLSearchParams();
    formData.append("val[card_id]", cardId);
    formData.append("val[name]", name);
    formData.append("val[birthdayM]", birthdayM);
    formData.append("val[birthdayD]", birthdayD);

    const loginUrl = `${AIPRI_BASE_URL}/mypage/login`;

    // Make login request - follow redirects automatically
    const response = await net.fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": AIPRI_USER_AGENT,
        Referer: loginUrl,
        Origin: AIPRI_BASE_URL,
      },
      body: formData.toString(),
      redirect: "follow",
      credentials: "include",
      bypassCustomProtocolHandlers: true,
    });

    // Get cookies from response
    const setCookies = response.headers.getSetCookie();
    let cookies = parseCookies(setCookies);
    console.log(
      "[Aipri Debug] performLogin response set-cookie summary:",
      summarizeCookieString(cookies),
    );

    // When redirect:follow is used (and with Front Door), response headers can include only LB cookies.
    // If required app session cookies are missing, recover from the Electron cookie jar.
    if (!hasRequiredSessionCookies(cookies)) {
      try {
        // Get cookies for both root and /mypage/ path (MYPAPSSID has path=/mypage/)
        const rootCookies = await session.defaultSession.cookies.get({ url: AIPRI_BASE_URL });
        const mypageCookies = await session.defaultSession.cookies.get({
          url: `${AIPRI_BASE_URL}/mypage/`,
        });

        // Combine and dedupe cookies
        const allCookies = [...rootCookies, ...mypageCookies];
        const uniqueCookies = allCookies.filter(
          (cookie, index, self) => index === self.findIndex((c) => c.name === cookie.name),
        );

        const cookieMap = new Map();
        for (const cookie of uniqueCookies) {
          cookieMap.set(cookie.name, cookie);
        }

        if (cookies) {
          const parsedCookies = cookies
            .split(";")
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
              const [name, ...valueParts] = part.split("=");
              return { name, value: valueParts.join("=") };
            })
            .filter((entry) => entry.name && entry.value);

          for (const cookie of parsedCookies) {
            if (!cookieMap.has(cookie.name)) {
              cookieMap.set(cookie.name, cookie);
            }
          }
        }

        cookies = stringifyCookies(Array.from(cookieMap.values()));
        console.log(
          "[Aipri Debug] performLogin fallback session cookies:",
          Array.from(cookieMap.keys()).join(","),
          `count=${cookieMap.size}`,
        );
      } catch (err) {
        console.error("Error getting cookies from session:", err);
      }
    }

    // Check the final URL to determine if login succeeded
    const finalUrl = response.url;

    if (!response.ok) {
      return { success: false, error: `サーバーエラー (${response.status})` };
    }

    const html = await response.text();

    // Check if we're still on the login page (login failed)
    if (
      finalUrl.includes("/login") ||
      html.includes('id="loginForm"') ||
      html.includes("ログインフォーム")
    ) {
      console.log("[Aipri Debug] performLogin rejected as login page:", finalUrl);
      return { success: false, error: "ログインに失敗しました。入力情報を確認してください。" };
    }

    if (!hasRequiredSessionCookies(cookies)) {
      console.log(
        "[Aipri Debug] performLogin missing required session cookies:",
        summarizeCookieString(cookies),
      );
      return {
        success: false,
        error: "ログインセッションの取得に失敗しました。しばらくしてから再試行してください。",
      };
    }

    console.log(
      "[Aipri Debug] performLogin accepted:",
      name,
      "finalUrl=",
      finalUrl,
      "cookieSummary=",
      summarizeCookieString(cookies),
      "hasMYPAPSSID=",
      Boolean(cookies && cookies.includes("MYPAPSSID=")),
    );

    // Fetch mypage explicitly with the obtained cookies to get correct profile image
    let profileImageUrl = null;
    if (cookies) {
      try {
        console.log("[Profile Image] Fetching mypage with explicit cookies for:", name);
        // Set session cookies for this account
        await setAipriSessionCookies(cookies);

        const mypageResponse = await net.fetch(`${AIPRI_BASE_URL}/mypage`, {
          headers: {
            "User-Agent": AIPRI_USER_AGENT,
          },
          redirect: "follow",
        });

        console.log(
          "[Profile Image] Mypage response:",
          mypageResponse.status,
          "Final URL:",
          mypageResponse.url,
        );

        if (mypageResponse.ok) {
          const mypageHtml = await mypageResponse.text();
          // Check if we got redirected to login page
          if (mypageResponse.url.includes("/login")) {
            console.log("[Profile Image] Redirected to login, falling back to login HTML");
            profileImageUrl = extractProfileImage(html);
          } else {
            profileImageUrl = extractProfileImage(mypageHtml);
          }
          console.log("[Profile Image] Extracted URL:", profileImageUrl);
        }
      } catch (err) {
        console.error("Error fetching mypage for profile image:", err);
        // Fallback to login response HTML
        profileImageUrl = extractProfileImage(html);
      }
    } else {
      profileImageUrl = extractProfileImage(html);
    }

    return {
      success: true,
      cookies: cookies || "",
      profileImageUrl: profileImageUrl || undefined,
    };
  } catch (error) {
    console.error("Aipri login error:", error);
    return { success: false, error: `通信エラー: ${String(error)}` };
  }
};

/**
 * Fetch photos from myphoto-list API
 * @param {string} targetYm YYYYMM format
 * @param {boolean} isRetry Whether this is a retry attempt
 * @returns {Promise<{success: boolean, photos?: any[], error?: string, reloggedIn?: boolean}>}
 */
export const fetchPhotos = async (targetYm, isRetry = false) => {
  const store = getStore();
  const { accounts, activeAccountId } = getNormalizedAipriState(store);

  if (!activeAccountId) {
    return { success: false, error: "アクティブなアカウントがありません。" };
  }

  const account = accounts.find((acc) => acc.accountId === activeAccountId);

  if (!account) {
    return { success: false, error: "アカウントが見つかりません。" };
  }

  const sessionCookies = account.sessionCookie;

  if (!sessionCookies) {
    // No session, try to login
    if (!isRetry) {
      return await performReloginAndRetry(store, account, accounts, targetYm);
    }
    return { success: false, error: "セッションがありません。ログインしてください。" };
  }

  try {
    // Set session cookies for this account
    await setAipriSessionCookies(sessionCookies);

    const formData = new URLSearchParams();
    formData.append("target_ym", targetYm);
    formData.append("data_count", "999");

    const response = await net.fetch(`${AIPRI_BASE_URL}/mypage/api/myphoto-list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": AIPRI_USER_AGENT,
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      return { success: false, error: `APIエラー (${response.status})` };
    }

    const result = await response.json();

    // Check for session expired error (code 90)
    if (result.code === "90") {
      if (!isRetry) {
        return await performReloginAndRetry(store, account, accounts, targetYm);
      } else {
        return { success: false, error: "セッションが期限切れです。再ログインに失敗しました。" };
      }
    }

    if (result.code !== "00") {
      return { success: false, error: result.message || "APIエラーが発生しました" };
    }

    return {
      success: true,
      photos: result.data?.photo_list || [],
    };
  } catch (error) {
    console.error("Fetch photos error:", error);
    return { success: false, error: `通信エラー: ${String(error)}` };
  }
};

/**
 * Helper function to perform re-login and retry fetchPhotos
 * @param {ReturnType<typeof import('../store.js').getStore>} store
 * @param {AipriAccount} account
 * @param {AipriAccount[]} accounts
 * @param {string} targetYm
 * @returns {Promise<{success: boolean, photos?: any[], error?: string, reloggedIn?: boolean}>}
 */
async function performReloginAndRetry(store, account, accounts, targetYm) {
  const loginResult = await performLogin({
    cardId: account.cardId,
    name: account.name,
    birthdayM: account.birthdayM,
    birthdayD: account.birthdayD,
  });

  if (!loginResult.success) {
    return { success: false, error: `再ログインに失敗しました: ${loginResult.error}` };
  }

  // Update account with new session
  const updatedAccounts = accounts.map((acc) =>
    acc.accountId === account.accountId
      ? { ...acc, sessionCookie: loginResult.cookies || null }
      : acc,
  );
  store.set("aipriAccounts", updatedAccounts);

  // Retry fetch with new session
  const retryResult = await fetchPhotos(targetYm, true);

  return { ...retryResult, reloggedIn: true };
}

/**
 * Download a single photo and save to folder
 * @param {string} url
 * @param {string} filename
 * @param {string} folderPath
 * @returns {Promise<{success: boolean, skipped?: boolean, error?: string}>}
 */
export const downloadPhoto = async (url, filename, folderPath) => {
  if (!url || !filename || !folderPath) {
    return { success: false, error: "無効なパラメータです" };
  }

  // Security: validate the download URL is from the expected domain
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { success: false, error: "無効なURLです" };
  }
  if (parsedUrl.origin !== new URL(AIPRI_CDN_BASE_URL).origin) {
    return { success: false, error: "許可されていないダウンロード元です" };
  }

  // Security: strip any directory components from the filename to prevent path traversal
  const safeFilename = path.basename(filename);
  if (!safeFilename || safeFilename === "." || safeFilename === "..") {
    return { success: false, error: "無効なファイル名です" };
  }

  const targetPath = path.join(folderPath, safeFilename);

  // Check if file already exists
  if (fs.existsSync(targetPath)) {
    return { success: true, skipped: true };
  }

  // Get active account's session cookie
  const sessionCookies = getActiveSessionCookie();

  try {
    // Set session cookies for this account
    await setAipriSessionCookies(sessionCookies || "");

    const response = await net.fetch(url, {
      headers: { "User-Agent": AIPRI_USER_AGENT },
      redirect: "error",
    });

    if (!response.ok) {
      return { success: false, error: `ダウンロードエラー (${response.status})` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(targetPath, buffer);

    return { success: true, skipped: false };
  } catch (error) {
    console.error("Download photo error:", error);
    return { success: false, error: `ダウンロードエラー: ${String(error)}` };
  }
};

/**
 * Verify if the session is valid by fetching mypage
 * @param {string} sessionCookie
 * @returns {Promise<{valid: boolean, profileImageUrl?: string, reason?: string}>}
 */
export const verifySession = async (sessionCookie) => {
  try {
    // Set session cookies
    await setAipriSessionCookies(sessionCookie);

    const response = await net.fetch(`${AIPRI_BASE_URL}/mypage`, {
      headers: {
        "User-Agent": AIPRI_USER_AGENT,
      },
      redirect: "follow",
    });

    const finalUrl = response.url;

    if (finalUrl.includes("/mypage/login") || finalUrl.includes("/login")) {
      return { valid: false, reason: "セッションが期限切れです" };
    }

    if (response.ok) {
      const html = await response.text();
      const profileImageUrl = extractProfileImage(html);
      return { valid: true, profileImageUrl: profileImageUrl || undefined };
    }

    return { valid: false, reason: `予期しないレスポンス (${response.status})` };
  } catch (error) {
    console.error("Session verify error:", error);
    return { valid: false, reason: `通信エラー: ${String(error)}` };
  }
};
