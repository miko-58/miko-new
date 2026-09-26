# 1人1案件の適用手順

`activeHelps/{uid}` の `helpId` を投稿者・担当者の双方について同時に確保します。
募集投稿の作成数は制限しません。マッチングしてから完了するまでが「進行中」です。
進行中の案件の削除・再オープン、占有情報だけの解除は拒否します。
完了時は案件の状態・双方の占有解除・操作した本人の実績を同じトランザクションで更新します。
`userProfiles.activeHelpId` は旧フィールドで、この実装の判定には使用しません。

## ローカルテスト

Node 24 と Java 21 以上で、リポジトリルートから `npm run test:participation` を実行します。
専用の `demo-nearu-participation` エミュレータだけを使用し、本番へ接続しません。

## 本番への適用

1. Firebase管理者としてCLIへログインし、対象が `help5-d7f86` であることを確認します。
2. 管理者用のApplication Default Credentialsをローカル環境に用意します。秘密鍵はリポジトリへ保存しません。
3. `node scripts/migrate-active-helps.mjs --project=help5-d7f86` で読み取り専用の移行チェックを行います。
   複数案件がある場合は利用者・案件IDを報告して停止します。既存案件は自動終了しません。
4. `npx firebase deploy --only firestore:rules --project help5-d7f86` でルールを適用します。
   `appConfig/helpParticipation.enabled` がtrueになるまでは新規引受が停止します。既存案件の完了・チャットは利用できます。
5. `node scripts/migrate-active-helps.mjs --project=help5-d7f86 --apply --rules-installed` を実行します。
   既存進行中案件の占有情報と有効化フラグを同一トランザクションで保存します。
   競合や移行エラーがあれば有効化しません。450件超の占有更新は停止して別途移行設計を要求します。
6. 新しいフロントエンドをビルド・配信し、双方の実アカウントで引受・完了・次の引受を確認します。
   古いフロントエンドからの新規引受は新ルールが拒否するため、再読み込みを案内します。

適用時に既存の有効化フラグがtrueなら移行スクリプトは停止します。
再移行時は管理者が同フラグをfalseにしてから実施します。
Firestoreルールは他メンバーの変更と差分を確認してからデプロイしてください。
