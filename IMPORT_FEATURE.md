# Import機能 実装ドキュメント

**作成日**: 2026-01-06  
**機能概要**: aipri.jp マイページにログインし、プロフィール画像を取得するインポート機能

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

VerseConnectアプリに「インポート」機能を追加。aipri.jp マイページにログインし、ユーザーのプロフィール画像を取得・表示する。

### 主な特徴

- カードID、名前、誕生日でログイン
- セッションをElectron Storeで永続化（アプリ再起動後も維持）
- セッション期限切れ時の自動検出・ハンドリング
- リアルタイム入力バリデーション

---

## ファイル構成

```
src/
├── electron.js              # IPCハンドラー (aipri-login, aipri-check-session, aipri-clear-session)
├── preload.cjs              # レンダラーにAPI公開
├── app.d.ts                 # 型定義
├── lib/
│   └── stores/
│       └── session.svelte.ts # セッション状態管理ストア
└── routes/
    ├── +layout.svelte        # ヘッダーにインポートボタン追加
    └── import/
        └── +page.svelte      # インポートページ
```

---

## 技術仕様

### Electron メインプロセス (`electron.js`)

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
  aipriSession: null  // ← 追加
}
```

#### IPCハンドラー

| ハンドラー名 | 説明 |
|-------------|------|
| `aipri-login` | ログイン処理。成功時にCookieを永続化し、プロフィール画像URLを返却 |
| `aipri-check-session` | 保存されたセッションの有効性をチェック |
| `aipri-clear-session` | セッションをクリア（ログアウト） |

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

**レスポンス**: 302リダイレクト → ユーザーページ

### プロフィール画像の抽出

HTMLから以下のパターンでimg要素を検索:
```html
<img class="profile_thumbImage" src="/path/to/image.jpg" />
```

---

## フロントエンド仕様

### セッション管理ストア (`session.svelte.ts`)

Svelte 5 runesを使用したリアクティブ状態管理

```typescript
export const sessionState = $state({
  isLoggedIn: false,      // ログイン状態
  isChecking: true,       // セッションチェック中フラグ
  profileImageUrl: null,  // プロフィール画像URL
  error: null             // エラーメッセージ
});
```

**公開関数**:
- `checkSession()` - セッション有効性チェック
- `login(credentials)` - ログイン実行
- `logout()` - ログアウト

### インポートページ (`/import`)

#### 入力フィールド

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

---

## 今後の拡張に向けて

現在の実装は「段階的な実装」の第一段階として、プロフィール画像の表示のみを行っている。

### 拡張ポイント

1. **セッション再利用**: `store.get('aipriSession')` で保存されたCookieを取得し、他のAPIリクエストに使用可能

2. **追加エンドポイント**: 同じセッションを使って `/mypage` 配下の他のページにもアクセス可能

3. **画像抽出パターンの追加**: `extractProfileImage` 関数を拡張して他の画像も抽出可能

### 注意事項

- セッションは `electron-store` でローカルファイルに保存される
- セッション期限切れ時は自動的にクリアされる
- `net.fetch` は `redirect: 'follow'` を使用（`manual`はElectronでエラーになる場合がある）

---

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2026-01-06 | 初期実装 |
