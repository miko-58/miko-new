import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Writable } from 'node:stream'
import { v2 as cloudinary } from 'cloudinary'
import { cloudinaryPhotoId, signCloudinaryPhoto, uploadCloudinaryPhoto } from '../backend/src/cloudinaryPhotos.ts'

const id = 'nearu/posts/12345678-1234-1234-1234-123456789abc'
const base = `https://res.cloudinary.com/test-cloud/image/authenticated/v123/${id}.jpg`

test('accepts only application originals in the configured cloud', () => {
  assert.equal(cloudinaryPhotoId(base, 'test-cloud'), id)
  assert.equal(cloudinaryPhotoId(base.replace('/v123/', '/s--Abcd_123--/v123/'), 'test-cloud'), id)
  for (const value of [undefined, 'garbage', base.replace('https:', 'http:'),
    base.replace('/test-cloud/', '/other/'), base.replace('/authenticated/', '/upload/'),
    base.replace('/nearu/posts/', '/private/'), base.replace('res.cloudinary.com', 'evil.example'),
    base.replace('https://', 'https://user:pass@'), `${base}?x=1`, `${base}#x`]) {
    assert.throws(() => cloudinaryPhotoId(value, 'test-cloud'))
  }
})

function configure(t) {
  for (const [key, value] of Object.entries({ CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 'test-secret' })) {
    const before = process.env[key]
    process.env[key] = value
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before })
  }
}

test('issues a time-limited authenticated URL without leaking the secret', t => {
  configure(t)
  const now = Math.floor(Date.now() / 1000)
  const result = new URL(signCloudinaryPhoto(base))
  assert.equal(result.origin, 'https://api.cloudinary.com')
  assert.equal(result.searchParams.get('public_id'), id)
  assert.equal(result.searchParams.get('type'), 'authenticated')
  assert.ok(Number(result.searchParams.get('expires_at')) >= now + 3600)
  assert.ok(Number(result.searchParams.get('expires_at')) <= now + 3602)
  assert.ok(result.searchParams.get('signature'))
  assert.ok(!result.href.includes('test-secret'))
})

test('uploads bytes as an authenticated JPEG and keeps the permanent reference', async t => {
  configure(t)
  let options
  t.mock.method(cloudinary.uploader, 'upload_stream', (opts, callback) => {
    options = opts
    return new Writable({ write(chunk, encoding, done) {
      assert.equal(chunk.toString(), 'image bytes')
      done()
    }, final(done) {
      callback(undefined, { secure_url: `https://res.cloudinary.com/test-cloud/image/authenticated/s--Abcd_123--/v123/${opts.public_id}.jpg` })
      done()
    } })
  })
  const result = await uploadCloudinaryPhoto(Buffer.from('image bytes'))
  assert.equal(options.type, 'authenticated')
  assert.equal(options.format, 'jpg')
  assert.equal(options.overwrite, false)
  assert.equal(cloudinaryPhotoId(result.imageUrl, 'test-cloud'), result.blobName)
  assert.ok(!result.imageUrl.includes('/s--'))
})

test('does not expose provider errors or credentials', async t => {
  configure(t)
  t.mock.method(cloudinary.uploader, 'upload_stream', (opts, callback) => {
    return new Writable({ write(chunk, encoding, done) {
      callback({ message: 'test-secret' })
      done()
    } })
  })
  await assert.rejects(uploadCloudinaryPhoto(Buffer.from('x')), { message: 'Cloudinary upload failed' })
})
