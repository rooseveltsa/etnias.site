#!/usr/bin/env node
// Mescla preview/legacy/legacy-import.json (gerado por scripts/import-legacy.py) no community.json da Casa Opy.
// Idempotente: ids determinísticos a partir do legacyId; nunca remove nada; não toca em contas que não vieram do legado.
// Uso: node scripts/opy-import-legacy.mjs --state <OPY_LOCAL_DATA_DIR> --input preview/legacy/legacy-import.json [--dry-run]
import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CATEGORY = 'Projeto & Rede'; // 'Legado Etnias' não existe em communityCategories (preview/server/communities.mjs)
const TONES = ['terracotta', 'forest', 'slate', 'ochre'];
const RULES = 'Regras herdadas do grupo original do Etnias; a moderação pode atualizá-las.';

export function uuidFrom(seed) {
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${'89ab'[parseInt(h[16], 16) % 4]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export const accountIdOf = legacyId => uuidFrom('legacy-account-' + legacyId);

function initialState() {
  // Mesma forma de initialState() em preview/server/store.mjs, sem o acervo público nem @vercel/blob.
  return { version: 2, posts: [], messages: [], interests: {}, limits: {}, saberes: {}, musicLikes: {}, submissions: [], accounts: [], etnia: {} };
}
const union = (list, items) => [...new Set([...(Array.isArray(list) ? list : []), ...items])];

export function mergeLegacy(state, input) {
  const report = { accounts: { created: 0, updated: 0, skipped: 0 }, posts: { created: 0, updated: 0, skipped: 0 }, communities: { created: 0, updated: 0 }, follows: 0, friends: 0, conflicts: [] };
  state.accounts ||= []; state.posts ||= []; state.communities ||= []; state.follows ||= {}; state.friends ||= {};
  const byId = new Map(state.accounts.map(a => [a.id, a]));
  const byUsername = new Map(state.accounts.map(a => [a.username, a]));
  const imported = new Map(); // legacyId → conta no estado

  for (const a of input.accounts) {
    const id = accountIdOf(a.legacyId);
    const existing = byId.get(id);
    const clash = byUsername.get(a.username);
    if (!existing && clash) { report.conflicts.push({ type: 'username', legacyId: a.legacyId, username: a.username, existingId: clash.id }); report.accounts.skipped++; continue; }
    const fields = { username: a.username, name: a.name, bio: a.bio, googleKey: a.googleKey, phone: a.phone, avatarUrl: a.avatarUrl, coverUrl: a.coverUrl, createdAt: a.createdAt, lastSeenAt: a.lastSeenAt, verified: a.verified, legacyId: a.legacyId, legacyPassword: a.legacyPassword };
    if (existing) {
      let changed = false;
      for (const [k, v] of Object.entries(fields)) {
        if (k === 'username' || k === 'legacyPassword') continue;
        if ((existing[k] === undefined || existing[k] === '' || existing[k] === 0 || existing[k] === null) && v !== '' && v !== 0 && v !== undefined) { existing[k] = v; changed = true; }
      }
      // legacyPassword só enquanto a conta ainda não tem senha própria nem bcrypt.
      if (!existing.password && !existing.legacyPassword && a.legacyPassword) { existing.legacyPassword = a.legacyPassword; changed = true; }
      if (changed) report.accounts.updated++; else report.accounts.skipped++;
      imported.set(a.legacyId, existing);
    } else {
      const account = { id, ...fields };
      state.accounts.push(account); byId.set(id, account); byUsername.set(a.username, account);
      imported.set(a.legacyId, account); report.accounts.created++;
    }
  }

  const communityIds = new Map(); // legacyId → id no estado
  const existingCommunities = new Map(state.communities.map(c => [c.id, c]));
  const byLegacy = new Map(state.communities.filter(c => c.legacyId).map(c => [c.legacyId, c]));
  let tone = 0;
  for (const c of input.communities) {
    const members = c.memberLegacyIds.filter(l => imported.has(l)).map(l => 'id:' + imported.get(l).id);
    let community = byLegacy.get(c.legacyId);
    if (community) {
      const before = community.members.length;
      community.members = union(community.members, members);
      if (community.members.length !== before) report.communities.updated++;
    } else {
      let id = 'legado-' + c.slug;
      if (existingCommunities.has(id)) id += '-' + c.legacyId;
      const owner = imported.get(c.ownerLegacyId);
      community = {
        id, slug: id, name: c.name, category: CATEGORY, visibility: c.visibility, coverTone: TONES[tone++ % TONES.length],
        description: c.description, rules: RULES, governanceNote: RULES, createdAt: c.createdAt,
        members, admins: owner ? ['id:' + owner.id] : [], moderators: [], pendingRequests: [], invited: [],
        legacyId: c.legacyId, avatarUrl: c.avatarUrl, coverUrl: c.coverUrl
      };
      state.communities.push(community); existingCommunities.set(id, community); byLegacy.set(c.legacyId, community);
      report.communities.created++;
    }
    communityIds.set(c.legacyId, community);
  }

  const postsById = new Map(state.posts.map(p => [p.id, p]));
  for (const p of input.posts) {
    const author = imported.get(p.authorLegacyId);
    if (!author) { report.posts.skipped++; continue; }
    const community = p.communityLegacyId ? communityIds.get(p.communityLegacyId) : null;
    const fields = { authorId: author.id, author: author.name, text: p.text, createdAt: p.createdAt, image: p.image, images: p.images, attachmentMissing: p.attachmentMissing, communityId: community?.id || '', communityName: community?.name || '' };
    if (p.media) fields.media = p.media;
    if (p.link) fields.link = p.link;
    const reactions = Object.fromEntries(p.reactions.filter(r => imported.has(r.authorLegacyId)).map(r => [imported.get(r.authorLegacyId).id, r.reaction]));
    const comments = p.comments.filter(c => imported.has(c.authorLegacyId)).map(c => ({ id: uuidFrom('legacy-comment-' + c.legacyId), author: imported.get(c.authorLegacyId).name, authorKey: 'id:' + imported.get(c.authorLegacyId).id, text: c.text, createdAt: c.createdAt, likes: [] }));
    const id = 'legacy-' + p.legacyId;
    const existing = postsById.get(id);
    if (existing) {
      const snapshot = JSON.stringify(existing);
      Object.assign(existing, fields);
      existing.reactions ||= {}; existing.comments ||= []; existing.saves ||= []; existing.shares ||= 0;
      for (const [accountId, reaction] of Object.entries(reactions)) if (!(accountId in existing.reactions)) existing.reactions[accountId] = reaction;
      const known = new Set(existing.comments.map(c => c.id));
      for (const c of comments) if (!known.has(c.id)) existing.comments.push(c);
      existing.comments.sort((x, y) => x.createdAt - y.createdAt);
      if (JSON.stringify(existing) !== snapshot) report.posts.updated++; else report.posts.skipped++;
    } else {
      const post = { id, ...fields, origin: 'legacy', audience: 'public', reactions, comments, saves: [], shares: 0 };
      state.posts.push(post); postsById.set(id, post); report.posts.created++;
    }
  }
  state.posts.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));

  const mutual = new Set();
  const pairs = new Set(input.follows.map(([a, b]) => a + '>' + b));
  for (const [followerLegacy, followingLegacy] of input.follows) {
    const follower = imported.get(followerLegacy), following = imported.get(followingLegacy);
    if (!follower || !following) continue;
    const list = Array.isArray(state.follows[follower.id]) ? state.follows[follower.id] : [];
    if (!list.includes('id:' + following.id)) { state.follows[follower.id] = [...list, 'id:' + following.id]; report.follows++; }
    if (pairs.has(followingLegacy + '>' + followerLegacy)) mutual.add([follower.id, following.id].sort().join('|'));
  }
  for (const pair of mutual) {
    const [a, b] = pair.split('|').map(id => 'id:' + id);
    const la = state.friends[a] = Array.isArray(state.friends[a]) ? state.friends[a] : [];
    const lb = state.friends[b] = Array.isArray(state.friends[b]) ? state.friends[b] : [];
    if (!la.includes(b)) { la.push(b); report.friends++; }
    if (!lb.includes(a)) lb.push(a);
  }
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const dir = opt('--state'), inputPath = opt('--input') || 'preview/legacy/legacy-import.json', dryRun = args.includes('--dry-run');
  if (!dir) throw new Error('Informe --state <diretório do OPY_LOCAL_DATA_DIR>.');
  const started = Date.now();
  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  const statePath = join(dir, 'community.json');
  let state, exists = true;
  try { state = JSON.parse(await readFile(statePath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; state = initialState(); exists = false; }
  const report = mergeLegacy(state, input);
  console.log(JSON.stringify({ ...report, conflicts: report.conflicts.length, elapsedMs: Date.now() - started }, null, 2));
  for (const c of report.conflicts.slice(0, 50)) console.log('conflito:', JSON.stringify(c));
  if (report.conflicts.length > 50) console.log(`... e mais ${report.conflicts.length - 50} conflitos`);
  if (dryRun) { console.log('dry-run: nada gravado.'); return; }
  await mkdir(dir, { recursive: true, mode: 0o700 });
  if (exists) await copyFile(statePath, `${statePath}.antes-importacao-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const temporary = `${statePath}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
  await rename(temporary, statePath);
  console.log(`Gravado em ${statePath}: ${state.accounts.length} contas, ${state.posts.length} publicações, ${state.communities.length} comunidades.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exit(1); });
