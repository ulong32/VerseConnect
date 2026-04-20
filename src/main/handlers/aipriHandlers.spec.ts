import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

type Account = {
  accountId?: string;
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

type IpcHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

const handlerMap = new Map<string, IpcHandler>();

const ipcHandleMock = vi.fn((channel: string, handler: IpcHandler) => {
  handlerMap.set(channel, handler);
});

const performLoginMock = vi.fn();
const verifySessionMock = vi.fn();
const downloadAndSaveProfileImageMock = vi.fn();
const fetchPhotosMock = vi.fn();
const downloadPhotoMock = vi.fn();

let storeState: StoreState;

const mockStore = {
  get: vi.fn((key: keyof StoreState) => storeState[key]),
  set: vi.fn((key: keyof StoreState, value: StoreState[keyof StoreState]) => {
    (storeState as Record<string, unknown>)[key] = value;
  }),
};

vi.mock("electron", () => ({
  ipcMain: {
    handle: ipcHandleMock,
  },
}));

vi.mock("../services/aipriService.js", () => ({
  performLogin: performLoginMock,
  verifySession: verifySessionMock,
  downloadAndSaveProfileImage: downloadAndSaveProfileImageMock,
  fetchPhotos: fetchPhotosMock,
  downloadPhoto: downloadPhotoMock,
}));

vi.mock("../store.js", () => ({
  getStore: vi.fn(() => mockStore),
}));

async function registerHandlers() {
  vi.resetModules();
  handlerMap.clear();
  const { setupAipriHandlers } = await import("./aipriHandlers.js");
  setupAipriHandlers();
}

async function invokeHandler(channel: string, ...args: unknown[]) {
  const handler = handlerMap.get(channel);
  if (!handler) {
    throw new Error(`handler not found: ${channel}`);
  }
  return handler({}, ...args);
}

describe("aipriHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handlerMap.clear();

    storeState = {
      aipriAccounts: [],
      aipriActiveAccountId: null,
      aipriActiveAccountName: null,
    };

    performLoginMock.mockReset();
    verifySessionMock.mockReset();
    downloadAndSaveProfileImageMock.mockReset();
    fetchPhotosMock.mockReset();
    downloadPhotoMock.mockReset();
  });

  it("does not register deprecated aipri-login handler", async () => {
    await registerHandlers();

    const registeredChannels = [...handlerMap.keys()];

    expect(registeredChannels).not.toContain("aipri-login");
    expect(registeredChannels).toContain("aipri-get-accounts");
    expect(registeredChannels).toContain("aipri-add-account");
    expect(registeredChannels).toContain("aipri-switch-account");
  });

  it("migrates legacy account record by generating accountId on get-accounts", async () => {
    storeState.aipriAccounts = [
      {
        name: "Alice",
        cardId: "00000000-AAAAAAA",
        birthdayM: "01",
        birthdayD: "01",
        sessionCookie: "PHPSESSID=old; MYPAPSSID=old",
        profileImagePath: null,
      },
    ];
    storeState.aipriActiveAccountName = "Alice";

    await registerHandlers();
    const result = (await invokeHandler("aipri-get-accounts")) as {
      accounts: Account[];
      activeAccountId: string | null;
      activeAccountName: string | null;
    };

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].accountId).toBeTruthy();
    expect(result.activeAccountId).toBe(result.accounts[0].accountId);
    expect(result.activeAccountName).toBe("Alice");
    expect(storeState.aipriActiveAccountId).toBe(result.accounts[0].accountId);
    expect(storeState.aipriActiveAccountName).toBe("Alice");
  });

  it("keeps active account unchanged when switch-account relogin fails", async () => {
    const alice: Account = {
      accountId: "acc-1",
      name: "Alice",
      cardId: "00000000-AAAAAAA",
      birthdayM: "01",
      birthdayD: "01",
      sessionCookie: "PHPSESSID=a; MYPAPSSID=b",
      profileImagePath: null,
    };
    const bob: Account = {
      accountId: "acc-2",
      name: "Bob",
      cardId: "11111111-BBBBBBB",
      birthdayM: "02",
      birthdayD: "02",
      sessionCookie: "PHPSESSID=c; MYPAPSSID=d",
      profileImagePath: null,
    };

    storeState.aipriAccounts = [alice, bob];
    storeState.aipriActiveAccountId = alice.accountId || null;
    storeState.aipriActiveAccountName = alice.name;

    performLoginMock.mockResolvedValue({
      success: false,
      error: "login failed",
    });

    await registerHandlers();

    const result = (await invokeHandler("aipri-switch-account", bob.accountId)) as {
      success: boolean;
      error?: string;
    };

    expect(result.success).toBe(false);
    expect(result.error).toBe("login failed");
    expect(storeState.aipriActiveAccountId).toBe(alice.accountId);
    expect(storeState.aipriActiveAccountName).toBe(alice.name);
  });
});
