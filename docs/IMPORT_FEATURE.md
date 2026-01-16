# Import機能 実装ドキュメント

**作成日**: 2026-01-06  
**最終更新**: 2026-01-06  
**機能概要**: aipri.jp マイページにログインし、プロフィール画像の取得およびフォトのインポートを行う機能

---

## 目次

1. [機能概要](#機能概要)
2. [ファイル構成](#ファイル構成)
3. [技術仕様](#技術仕様)
4. [API仕様](#api仕様)
5. [フロントエンド仕様](#フロントエンド仕様)
6. [今後の拡張に向けて](#今後の拡張に向けて)

---

## 機能概要

VerseConnectアプリに「インポート」機能を追加。aipri.jp マイページにログインし、ユーザーのプロフィール画像を取得・表示し、マイページ上のフォトをローカルにダウンロード・保存する。

### 主な特徴

- カードID、名前、誕生日でログイン
- セッションをElectron Storeで永続化（アプリ再起動後も維持）
- セッション期限切れ時の自動検出・ハンドリング
- リアルタイム入力バリデーション
- ページ遷移してもログイン状態を維持
- **フォトインポート機能**: マイページAPIからフォトリストを取得し、ローカルフォルダに保存
- 進捗表示（プログレスバー）
- 重複ファイルの自動スキップ
- 200msの遅延によるサーバー負荷軽減

---

## ファイル構成

```
src/
├── electron.js              # IPCハンドラー (認証系 + フォトインポート系)
├── preload.cjs              # レンダラーにAPI公開
├── app.d.ts                 # 型定義 (AipriPhoto, AipriFetchPhotosResult等)
├── lib/
│   └── stores/
│       └── session.svelte.ts # セッション状態管理ストア
└── routes/
    ├── +layout.svelte        # ヘッダーにインポートボタン追加
    └── import/
        └── +page.svelte      # インポートページ（ログイン + フォトインポートUI）
```

---

## 技術仕様

### Electron メインプロセス (`electron.js`)

#### インポート

```javascript
import { ..., session } from 'electron';
```

#### 定数

```javascript
const AIPRI_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ...';
const AIPRI_BASE_URL = 'https://aipri.jp';
```

#### ストア拡張

`electron-store` に `aipriSession` フィールドを追加（Cookie文字列を保存）

```javascript
defaults: {
  folderPath: '',
  customCharacters: [],
  customTags: [],
  aipriSession: null  // Cookie文字列 "PHPSESSID=xxx; MYPAPSSID=yyy"
}
```

#### IPCハンドラー

| ハンドラー名 | 説明 |
|-------------|------|
| `aipri-login` | ログイン処理。成功時にCookieを永続化し、プロフィール画像URLを返却 |
| `aipri-check-session` | 保存されたセッションの有効性をチェック（MYPAPSSID確認 + /mypage アクセス） |
| `aipri-clear-session` | セッションをクリア（ログアウト） |
| `aipri-fetch-photos` | 指定年月のフォトリストをAPIから取得 |
| `aipri-download-photo` | 個別の画像をダウンロードしてローカルに保存（重複スキップ対応） |

#### Cookie取得の仕組み

`redirect: 'follow'` を使用する場合、リダイレクト時のSet-Cookieヘッダーは最終レスポンスで取得できない。
そのため、`session.defaultSession.cookies.get()` を使用してElectronのCookieストアからCookieを取得する。

```javascript
// MYPAPSSIDは path=/mypage/ なので両方のパスからCookieを取得
const rootCookies = await session.defaultSession.cookies.get({ url: AIPRI_BASE_URL });
const mypageCookies = await session.defaultSession.cookies.get({ url: `${AIPRI_BASE_URL}/mypage/` });
```

#### ヘルパー関数

- `parseCookies(setCookieHeaders)` - Set-Cookieヘッダーを解析
- `extractProfileImage(html)` - HTMLから `profile_thumbImage` クラスのimg srcを抽出

---

## API仕様

### ログインAPI

**エンドポイント**: `POST https://aipri.jp/mypage/login`

**リクエストヘッダー**:
```
Content-Type: application/x-www-form-urlencoded
User-Agent: [Chrome風UA]
Referer: https://aipri.jp/mypage/login
Origin: https://aipri.jp
```

**リクエストボディ**:
```
val[card_id]=00000000-0000000
val[name]=ユーザー名
val[birthdayM]=01
val[birthdayD]=01
```

**重要なフェッチオプション**:
```javascript
{
  redirect: 'follow',
  credentials: 'include',
  bypassCustomProtocolHandlers: true
}
```

**レスポンス**: 302リダイレクト → ユーザーページ

**設定されるCookie**:
- `PHPSESSID` - path: `/`
- `MYPAPSSID` - path: `/mypage/`, expires: 約30日後

### セッションチェック

1. 保存されたCookieに `MYPAPSSID=` が含まれているか確認
2. `/mypage` にCookie付きでアクセス
3. 最終URLが `/login` を含まなければセッション有効

### フォトリストAPI

**エンドポイント**: `POST https://aipri.jp/mypage/api/myphoto-list`

**リクエストヘッダー**:
```
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
X-Requested-With: XMLHttpRequest
User-Agent: [Chrome風UA]
Cookie: [保存済みセッションCookie]
```

**リクエストボディ**:
```
target_ym=202601
data_count=999
```

**レスポンス**:
```typescript
interface AipriApiResponse {
  code: string;  // "00" = 成功
  message: string;
  data: {
    last_photo_seq: number;
    photo_list: AipriPhoto[];
  };
}

interface AipriPhoto {
  photo_seq: number;
  play_date: string;        // "YYYY-MM-DD"
  photo_file_url: string;   // CDN URL（Cookie不要）
  thumb_file_url: string;
  page_path: string;
  friend_card_flg: 0 | 1;
}
```

**注意事項**:
- APIにはセッションCookieが必要
- CDN（画像URL）にはCookieは不要
- 取得可能なのは今月と先月のみ

---

## フロントエンド仕様

### セッション管理ストア (`session.svelte.ts`)

Svelte 5 runesを使用したリアクティブ状態管理

```typescript
export const sessionState = $state({
  isLoggedIn: false,      // ログイン状態
  isChecking: false,      // セッションチェック中フラグ
  hasChecked: false,      // 一度チェック済みかどうか
  profileImageUrl: null,  // プロフィール画像URL
  error: null             // エラーメッセージ
});
```

**公開関数**:
- `checkSession(force?: boolean)` - セッション有効性チェック（force=trueで強制再チェック）
- `login(credentials)` - ログイン実行
- `logout()` - ログアウト

**ページ遷移時の動作**:
- `hasChecked` フラグにより、一度チェック済みなら再チェックをスキップ
- ログイン済みの場合もスキップして即座に表示

### インポートページ (`/import`)

#### ログインフォーム

| フィールド | バリデーション |
|-----------|---------------|
| カードID | `/^[0-9A-Z]{8}-[0-9A-Z]{7}$/` (16文字、ハイフン含む) |
| 名前 | 1〜10文字 |
| 誕生月 | 01〜12 |
| 誕生日 | 01〜31（月に応じた上限） |

#### バリデーションタイミング

- **blur時**: 入力完了時にエラー表示
- **submit時**: 全フィールドを再検証

#### 自動フォーマット

- カードID: 英数字のみ抽出、大文字変換、8文字後にハイフン自動挿入
- 月/日: 数字のみ抽出、0埋め

#### フォトインポートUI（ログイン後に表示）

| 要素 | 説明 |
|-----|------|
| 対象月セレクト | 今月/先月を選択 |
| インポート開始ボタン | クリックでダウンロード処理開始 |
| プログレスバー | ダウンロード進捗を表示（現在/合計、スキップ数） |
| 結果メッセージ | 完了/エラー/0件/全スキップ時の各種メッセージ |

#### インポート処理フロー

1. 設定から `folderPath` を取得（未設定の場合はエラー）
2. `aipri-fetch-photos` でフォトリストを取得
3. 各フォトに対して `aipri-download-photo` を実行
   - ファイル名: `aipriverse_album_YYYYMMDD_N.jpg`
   - 既存ファイルはスキップ
   - 200ms間隔でダウンロード（サーバー負荷軽減）
4. 結果メッセージを表示
   - 成功: 「X枚をインポートしました」
   - 全スキップ: 「新しい写真はありませんでした（すべて既存）」
   - 0件: 「この月の写真は見つかりませんでした」
   - エラー: 「X枚をインポート、Y枚をスキップ、Z枚がエラー」

---

## 型定義 (`app.d.ts`)

```typescript
interface AipriPhoto {
  photo_seq: number;
  play_date: string;
  photo_file_url: string;
  thumb_file_url: string;
  page_path: string;
  friend_card_flg: 0 | 1;
}

interface AipriFetchPhotosResult {
  success: boolean;
  photos?: AipriPhoto[];
  error?: string;
}

interface AipriDownloadResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
}
```

---

## 今後の拡張に向けて

### 実装済み

- ✅ ログイン/ログアウト
- ✅ セッション永続化
- ✅ プロフィール画像表示
- ✅ フォトインポート（今月/先月）
- ✅ 進捗表示
- ✅ 重複スキップ

### 拡張ポイント

1. **過去月の取得**: APIが対応すれば、より古い月のフォトも取得可能

2. **追加エンドポイント**: 同じセッションを使って `/mypage` 配下の他のページにもアクセス可能
   ```javascript
   const response = await net.fetch(`${AIPRI_BASE_URL}/mypage/xxx`, {
     headers: {
       'User-Agent': AIPRI_USER_AGENT,
       'Cookie': store.get('aipriSession')
     }
   });
   ```

3. **サムネイル活用**: `thumb_file_url` を使ったプレビュー表示

### 注意事項

- セッションは `electron-store` でローカルファイルに保存される
- セッション期限切れ時は自動的にクリアされる
- `net.fetch` は `redirect: 'follow'` を使用（`redirect: 'manual'` はElectronでエラーになる）
- Cookie取得には `session.defaultSession.cookies.get()` を使用（Set-Cookieヘッダーからは取得不可）
- MYPAPSSID は `path=/mypage/` なので、Cookie取得時に `/mypage/` パスも指定する
- CDNへの画像リクエストにはCookieは不要
- ダウンロード時は200ms間隔で実行（DoS判定回避）

---

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2026-01-06 | 初期実装 |
| 2026-01-06 | カードID形式を8-7に修正 |
| 2026-01-06 | Cookie取得方法を修正（session.cookies API使用） |
| 2026-01-06 | セッション永続化とページ遷移対応を追加 |
| 2026-01-06 | フォトインポート機能を実装（aipri-fetch-photos, aipri-download-photo） |
