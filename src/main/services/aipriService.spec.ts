import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

type Account = {
  accountId: string;
  name: string;
  cardId: string;
  birthdayM: string;
  birthdayD: string;
  sessionCookie: string | null;
  profileImagePath: string | null;
};

type StoreState = {
  aipriAccounts: Account[];
  aipriActiveAccountId: string | null;
  aipriActiveAccountName: string | null;
};

type ResponseStub = {
  ok: boolean;
  status: number;
  url: string;
  headers: {
    getSetCookie: () => string[];
  };
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

const fetchMock = vi.fn();
const cookiesGetMock = vi.fn();
const cookiesRemoveMock = vi.fn();
const cookiesSetMock = vi.fn();

let storeState: StoreState;

const mockStore = {
  get: vi.fn((key: keyof StoreState) => storeState[key]),
  set: vi.fn((key: keyof StoreState, value: StoreState[keyof StoreState]) => {
    (storeState as Record<string, unknown>)[key] = value;
  }),
};

vi.mock("electron", () => ({
  net: {
    fetch: fetchMock,
  },
  session: {
    defaultSession: {
      cookies: {
        get: cookiesGetMock,
        remove: cookiesRemoveMock,
        set: cookiesSetMock,
      },
    },
  },
}));

vi.mock("../store.js", () => ({
  getStore: vi.fn(() => mockStore),
  getProfileImagesDir: vi.fn(() => "C:/tmp/profile_images"),
}));

function createResponse(options: {
  ok?: boolean;
  status?: number;
  url: string;
  setCookies?: string[];
  jsonBody?: unknown;
  textBody?: string;
}): ResponseStub {
  const { ok = true, status = 200, url, setCookies = [], jsonBody = {}, textBody = "" } = options;

  return {
    ok,
    status,
    url,
    headers: {
      getSetCookie: () => setCookies,
    },
    json: async () => jsonBody,
    text: async () => textBody,
  };
}

describe("aipriService fetchPhotos", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    storeState = {
      aipriAccounts: [
        {
          accountId: "acc-1",
          name: "Alice",
          cardId: "00000000-AAAAAAA",
          birthdayM: "01",
          birthdayD: "01",
          sessionCookie: "PHPSESSID=old-session; MYPAPSSID=old-mypap",
          profileImagePath: null,
        },
      ],
      aipriActiveAccountId: "acc-1",
      aipriActiveAccountName: "Alice",
    };

    cookiesGetMock.mockResolvedValue([]);
    cookiesRemoveMock.mockResolvedValue(undefined);
    cookiesSetMock.mockResolvedValue(undefined);
    fetchMock.mockReset();
  });

  it("re-logins and retries once when myphoto-list returns code 90", async () => {
    let photoApiCallCount = 0;

    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/mypage/api/myphoto-list")) {
        photoApiCallCount += 1;
        if (photoApiCallCount === 1) {
          return createResponse({
            url,
            jsonBody: { code: "90", message: "session expired" },
          });
        }

        return createResponse({
          url,
          jsonBody: {
            code: "00",
            data: {
              photo_list: [
                {
                  photo_seq: 1,
                  play_date: "2026-01-01",
                  photo_file_url: "https://cdnaipriimg01.blob.core.windows.net/a.jpg",
                  thumb_file_url: "https://cdnaipriimg01.blob.core.windows.net/a_thumb.jpg",
                  page_path: "/mypage/photo/1",
                  friend_card_flg: 0,
                },
              ],
            },
          },
        });
      }

      if (url.endsWith("/mypage/login")) {
        return createResponse({
          url: "https://aipri.jp/mypage",
          setCookies: [
            "PHPSESSID=new-session; Path=/; HttpOnly",
            "MYPAPSSID=new-mypap; Path=/mypage/; HttpOnly",
          ],
          textBody: "<html><body>mypage</body></html>",
        });
      }

      if (url.endsWith("/mypage")) {
        return createResponse({
          url: "https://aipri.jp/mypage",
          textBody: '<img class="profile_thumbImage" src="/images/profile.jpg" />',
        });
      }

      throw new Error(`unexpected fetch url: ${url}`);
    });

    vi.resetModules();
    const { fetchPhotos } = await import("./aipriService.js");

    const result = (await fetchPhotos("202601")) as {
      success: boolean;
      reloggedIn?: boolean;
      photos?: unknown[];
    };

    expect(result.success).toBe(true);
    expect(result.reloggedIn).toBe(true);
    expect(result.photos).toHaveLength(1);
    expect(photoApiCallCount).toBe(2);

    const updatedAccount = storeState.aipriAccounts[0];
    expect(updatedAccount.sessionCookie).toContain("PHPSESSID=new-session");
    expect(updatedAccount.sessionCookie).toContain("MYPAPSSID=new-mypap");
  });
});
