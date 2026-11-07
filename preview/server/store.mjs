import { get, put, del } from '@vercel/blob';
import publicPosts from '../public-posts.json' with { type: 'json' };

const avatarPattern = /^\/assets\/archive\/avatar-[a-f0-9]{20}\.(?:jpg|jpeg|png|webp|gif)$/;
const archiveAvatars = new Map(publicPosts.filter(post => avatarPattern.test(post.avatar || '')).map(post => [post.id, post.avatar]));
export function archiveAvatar(post) {
  if (avatarPattern.test(post?.avatar || '')) return post.avatar;
  return archiveAvatars.get(post?.id) || '';
}

const statePath = 'opy-v2/community.json';
const credentials = process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {};
const options = { access: 'private', useCache: false, ...credentials };
export function initialState() {
  return { version: 2, posts: structuredClone(publicPosts), messages: [], interests: {}, limits: {}, saberes: {}, musicLikes: {}, submissions: [], accounts: [], etnia: {} };
}
if (process.env.OPY_LOCAL_DATA_DIR && process.env.VERCEL) throw new Error('Armazenamento local não pode ser ativado na Vercel.');
const local = process.env.OPY_LOCAL_DATA_DIR
  ? (await import('./local-store.mjs')).createLocalStore(process.env.OPY_LOCAL_DATA_DIR, initialState)
  : null;
export async function readState() {
  if (local) return local.readState();
  const result = await get(statePath, options);
  if (!result) return { data: initialState(), etag: null };
  // Private HTTP downloads may prefix the same storage ETag with W/ for compression.
  // Conditional writes compare the strong storage tag, not that HTTP prefix.
  return { data: JSON.parse(await new Response(result.stream).text()), etag: result.blob.etag.replace(/^W\//, '') };
}
export async function transact(update) {
  if (local) return local.transact(update);
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, etag } = await readState();
    const result = update(data);
    try {
      await put(statePath, JSON.stringify(data), { ...credentials, access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: !!etag, ...(etag ? { ifMatch: etag } : {}), cacheControlMaxAge: 60 });
      return { data, result };
    } catch (error) {
      if (!/precondition|already exists|etag/i.test(`${error.name} ${error.message}`) || attempt === 7) throw error;
      await new Promise(resolve => setTimeout(resolve, 30 * (attempt + 1)));
    }
  }
}
export async function saveMedia(id, bytes, type) {
  if (local) return local.saveMedia(id, bytes, type);
  await put(`opy-v2/media/${id}`, bytes, { ...credentials, access: 'private', contentType: type, addRandomSuffix: false });
}
export async function readMedia(id) { return local ? local.readMedia(id) : get(`opy-v2/media/${id}`, options); }
export async function deleteMedia(id) { if (local) return local.deleteMedia(id); await del(`opy-v2/media/${id}`, credentials); }
