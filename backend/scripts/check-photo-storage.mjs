import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { cert } from 'firebase-admin/app'
import { v2 as cloudinary } from 'cloudinary'

// Resolve paths from this script so the check also works outside the backend directory.
dotenv.config({ path: fileURLToPath(new URL('../.env.local', import.meta.url)), quiet: true })
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })

const required = [
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  'FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY',
]
const missing = required.filter(key => !process.env[key]?.trim())
if (missing.length) {
  console.error(`backend/.env.local に設定してください: ${missing.join(', ')}`)
  process.exitCode = 1
} else {
  let stage = 'Firebase'
  try {
    const credential = cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
    await credential.getAccessToken()
    console.log('Firebase: サービスアカウント認証 OK')
    stage = 'Cloudinary'
    await cloudinary.api.ping({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      timeout: 15000,
    })
    console.log('Cloudinary: 認証・接続 OK')
    console.log('接続確認が完了しました。npm run dev で起動し、写真と評価を送信して保存を確認してください。')
  } catch {
    // SDK errors may contain credential details; do not print the raw error.
    console.error(`${stage} の接続確認に失敗しました。設定値・ネットワーク・アクセス権を確認してください。`)
    process.exitCode = 1
  }
}
