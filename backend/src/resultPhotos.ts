/** 保存済みの自アカウントの写真だけを再署名する。外部URLや任意のBlobは許可しない。 */
export function resultPhotoBlobName(value: unknown, account: string, container: string): string {
  if (typeof value !== 'string') throw new Error('Missing photo URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.host !== `${account}.blob.core.windows.net` || url.username || url.password) {
    throw new Error('Invalid photo origin');
  }
  const prefix = `/${container}/`;
  if (!url.pathname.startsWith(prefix)) throw new Error('Invalid photo container');
  const name = url.pathname.slice(prefix.length);
  if (!/^posts\/[0-9a-f-]{36}\.jpg$/i.test(name)) throw new Error('Invalid photo path');
  return name;
}
