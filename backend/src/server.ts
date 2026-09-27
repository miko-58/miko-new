import express from "express";
import cors from "cors";
import "dotenv/config";
import multer from "multer";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { BlobServiceClient, BlobSASPermissions, generateBlobSASQueryParameters, SASProtocol, StorageSharedKeyCredential } from "@azure/storage-blob";

const app = express();
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const firebaseApp = getApps().length ? getApps()[0] : initializeApp({
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
    await getAuth(firebaseApp).verifyIdToken(authorization.slice("Bearer ".length));
    if (!req.file) return res.status(400).json({ error: "写真がありません" });
    if (!accountName || !accountKey || !containerName) return res.status(500).json({ error: "Azure設定がありません" });
    if (!req.file.mimetype.startsWith("image/")) return res.status(400).json({ error: "画像のみアップロードできます" });
    const credential = new StorageSharedKeyCredential(accountName, accountKey);
    const service = new BlobServiceClient(`https://${accountName}.blob.core.windows.net`, credential);
    const blobName = `posts/${crypto.randomUUID()}.jpg`;
    const blob = service.getContainerClient(containerName).getBlockBlobClient(blobName);
    await blob.uploadData(req.file.buffer, { blobHTTPHeaders: { blobContentType: req.file.mimetype } });
    const startsOn = new Date(Date.now() - 5 * 60 * 1000);
    const expiresOn = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const sas = generateBlobSASQueryParameters({ containerName, blobName, permissions: BlobSASPermissions.parse("r"), startsOn, expiresOn, protocol: SASProtocol.Https }, credential).toString();
    res.json({ blobName, imageUrl: `${blob.url}?${sas}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "写真を保存できませんでした" });
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
