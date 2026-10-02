# Cloudinaryへの写真保存

画像本体はCloudinary、評価と画像の参照URLはFirestoreに保存します。
市民が解決画面で写真と評価を送信すると、ヒーローのマイページ「助け合いの思い出」に表示されます。

## 設定

backend/.env.example を backend/.env.local にコピーします。既存ファイルは上書きせず不足項目を追記してください。
Cloudinary管理画面の「製品環境設定 → APIキー」の値を入力します。

```env
CLOUDINARY_CLOUD_NAME=Cloud nameの値
CLOUDINARY_API_KEY=API Keyの値
CLOUDINARY_API_SECRET=API Secretの値
```

Firebaseもログイン確認と評価の保存・取得に必要です。フロントエンドと同じプロジェクトのサービスアカウントを設定してください。

```env
FIREBASE_PROJECT_ID=プロジェクトID
FIREBASE_CLIENT_EMAIL=サービスアカウントのclient_email
FIREBASE_PRIVATE_KEY="サービスアカウントのprivate_key（改行は\n）"
```

.env.local はGit管理対象外です。秘密鍵をチャットやフロントエンドの環境変数へコピーしないでください。

プロジェクト直下で実行します。

```sh
npm install
npm run check:photos --workspace=backend
npm run dev
```

接続確認はFirebase認証とCloudinaryのpingのみ行います。画像のアップロード・削除やFirestoreの書き込みは行いません。設定変更後はバックエンドを再起動してください。

## 動作確認

市民として進行中のやり取りの解決画面で外カメ・内カメ各1枚と星評価を送信します。
ヒーローの「助け合いの思い出」で写真2枚を確認し、ページを開き直しても表示されることを確認してください。
Firestoreのルールも対象プロジェクトへ反映されている必要があります。

写真はauthenticatedのJPEGとして保存し、本人のFirestore記録を確認してから1時間有効のURLを発行します。未署名の参照URLを直接開いても表示されません。アップロードは最大8MBです。
仕様: https://cloudinary.com/documentation/image_upload_api_reference

新規保存にAzure設定は不要です。既存のAzure写真の表示には従来のAZURE_STORAGE_*設定を残してください。
開発時の/apiはViteからポート3000へ転送します。本番では/apiの転送またはVITE_API_BASE_URLの設定が必要です。
カメラはlocalhostまたはHTTPSで利用してください。
