import { getFirestore } from 'firebase-admin/firestore';
import { resultPhotoBlobName } from './resultPhotos.js';
import { cloudinaryConfig, signCloudinaryPhoto, uploadCloudinaryPhoto } from './cloudinaryPhotos.js';
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters, SASProtocol, StorageSharedKeyCredential } from "@azure/storage-blob";

// 個人の秘密情報はGit管理外の .env.local に置き、共有用 .env は不足分だけ補う。
dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const firebaseApp = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID ?? "",
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL ?? "",
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
});
const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME;

app.post("/api/photos", upload.single("photo"), async (req, res) => {
  try {
    const authorization = req.header("authorization");
    if (!authorization?.startsWith("Bearer ")) return res.status(401).json({ error: "ログインが必要です" });
    try {
      await getAuth(firebaseApp).verifyIdToken(authorization.slice("Bearer ".length));
    } catch {
      return res.status(401).json({ error: 'ログインを確認できませんでした' });
    }
    if (!req.file) return res.status(400).json({ error: "写真がありません" });
    try { cloudinaryConfig(); } catch {
      return res.status(503).json({ error: 'Cloudinaryの接続設定がありません。管理者に確認してください。' });
    }
    if (!req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: "画像のみアップロードできます" });
    res.json(await uploadCloudinaryPhoto(req.file.buffer));
  } catch {
    res.status(500).json({ error: "写真を保存できませんでした" });
  }
});

// 写真の所有記録はトークン本人のratingsから取得し、期限付きURLを再発行する。
app.get('/api/result-photos/:chatId', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'ログインが必要です' });
  let uid: string;
  try {
    uid = (await getAuth(firebaseApp).verifyIdToken(authorization.slice(7))).uid;
  } catch {
    return res.status(401).json({ error: 'ログインを確認できませんでした' });
  }
  const chatId = req.params.chatId;
  if (typeof chatId !== 'string' || !chatId || chatId.includes('/') || chatId.length > 1500) {
    return res.status(400).json({ error: '記録の指定が正しくありません' });
  }
  try {
    const record = await getFirestore(firebaseApp).collection('userProfiles').doc(uid).collection('ratings').doc(chatId).get();
    if (!record.exists) return res.status(404).json({ error: '写真の記録が見つかりません' });
    const data = record.data()!;
    const sign = (value: unknown) => {
      if (typeof value === 'string' && new URL(value).hostname === 'res.cloudinary.com') return signCloudinaryPhoto(value);
      if (!accountName || !accountKey || !containerName) throw new Error('Azure settings missing');
      const credential = new StorageSharedKeyCredential(accountName, accountKey);
      const container = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, credential).getContainerClient(containerName);
      const blobName = resultPhotoBlobName(value, accountName, containerName);
      const sas = generateBlobSASQueryParameters({ containerName, blobName, permissions: BlobSASPermissions.parse('r'),
        startsOn: new Date(Date.now() - 300000), expiresOn: new Date(Date.now() + 3600000), protocol: SASProtocol.Https }, credential).toString();
      return `${container.getBlockBlobClient(blobName).url}?${sas}`;
    };
    return res.json({ outerPhotoUrl: sign(data.outerPhotoUrl), innerPhotoUrl: sign(data.innerPhotoUrl) });
  } catch {
    return res.status(500).json({ error: '写真を読み込めませんでした' });
  }
});
app.get("/api/health", (req, res) => {
  res.json({
    message: "Express OK!"
  });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
