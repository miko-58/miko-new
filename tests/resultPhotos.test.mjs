import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resultPhotoBlobName } from '../backend/src/resultPhotos.ts'
const blob = 'posts/12345678-1234-1234-1234-123456789abc.jpg'
const base = `https://nearu.blob.core.windows.net/photos/${blob}`
test('previously saved URL can be reissued after its SAS expires', () => {
  assert.equal(resultPhotoBlobName(`${base}?se=2020-01-01&sig=expired`, 'nearu', 'photos'), blob)
})
test('rejects other origins, containers, and paths', () => {
  for (const value of [undefined, 'not a URL', base.replace('https:', 'http:'), base.replace('nearu.', 'other.'),
    base.replace('/photos/', '/private/'), base.replace('posts/', 'secrets/'),
    base.replace('nearu.blob.core.windows.net', 'nearu.blob.core.windows.net.evil.test'),
    base.replace('/posts/', '/posts/%2e%2e/'), base.replace('https://', 'https://user:pass@')]) {
    assert.throws(() => resultPhotoBlobName(value, 'nearu', 'photos'))
  }
})
