export function cloudConfiguration(url = '', key = '') {
  if (!url && !key) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('云同步配置需要有效的 Supabase 项目 URL。');
  }
  if (
    parsed.protocol !== 'https:' ||
    !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('云同步只接受 HTTPS Supabase 项目根地址。');
  }
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role !== 'anon') throw new Error();
    } catch {
      throw new Error('只能使用 publishable key 或旧式 anon key，不能把私密服务端密钥写入网页。');
    }
  }
  return { url: parsed.origin, key };
}
