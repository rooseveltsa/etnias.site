#!/usr/bin/env python3
"""Lê o banco WoWonder recuperado (MariaDB em deploy/compose.yaml) e gera
preview/legacy/legacy-import.json + preview/legacy/media-manifest.txt para a Casa Opy.
Somente leitura no banco; a mesclagem no estado fica em scripts/opy-import-legacy.mjs."""
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
import html
import json
import os
import re
import subprocess
import time
from urllib.parse import unquote

root = Path(__file__).resolve().parents[1]
upload_root = root / 'public_html'
out_dir = root / 'preview/legacy'
IMAGE = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
VIDEO = {'.mp4', '.mov', '.webm'}
AUDIO = {'.mp3', '.wav', '.ogg', '.m4a'}
MAX_FILE = 200 * 1024 * 1024
DEFAULTS = {'d-avatar', 'd-cover', 'f-avatar', 'default-avatar'}
REACTIONS = {'1': 'like', '2': 'heart', '3': 'laugh', '4': 'wow', '5': 'sad'}


def rows(sql):
    result = subprocess.run(['docker', 'compose', '-f', str(root / 'deploy/compose.yaml'), 'exec', '-T', 'db', 'sh', '-c',
                             'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot --batch --raw --skip-column-names etnias -e "$1"', 'sh', sql],
                            check=True, capture_output=True, text=True)
    return [json.loads(line) for line in result.stdout.splitlines()]


def obj(**cols):
    return 'JSON_OBJECT(' + ','.join(f"'{k}',{v}" for k, v in cols.items()) + ')'


# Inventário do disco uma vez só: caminho relativo → bytes. Evita stat por referência e `..`.
files = {}
for base, _, names in os.walk(upload_root / 'upload'):
    for name in names:
        full = Path(base) / name
        files[full.relative_to(upload_root).as_posix()] = full.stat().st_size


def existing(path, kinds, limit=None):
    """Caminho relativo existente dentro de upload/ com extensão permitida, senão None."""
    if not path or not path.startswith('upload/') or '..' in path.split('/'):
        return None
    if Path(path).suffix.lower() not in kinds or path not in files:
        return None
    if limit and files[path] > limit:
        return None
    return path


def clean(value, limit):
    text = re.sub(r'<\s*(br|/p|/div)\s*/?>', '\n', value or '', flags=re.I)
    text = html.unescape(re.sub(r'<[^>]+>', '', text))
    text = html.unescape(text)  # entidades duplamente codificadas (&amp;lt;)
    text = re.sub(r'[ \t\r\f\v ]+', ' ', text)
    text = re.sub(r' *\n *', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    return text[:limit].strip()


hashtags = {row['id']: row['tag'] for row in rows("SELECT " + obj(id='id', tag='tag') + " FROM Wo_Hashtags")}


def post_text(value):
    text = re.sub(r'#\[(\d+)\]', lambda m: '#' + hashtags[int(m[1])] if int(m[1]) in hashtags else '', value or '')
    text = re.sub(r'@\[\d+\]', '', text)
    text = re.sub(r'\[a\](.*?)\[/a\]', lambda m: unquote(m[1]), text, flags=re.S)  # links no formato do WoWonder
    return clean(text, 5000)


def username_of(raw, legacy_id, taken):
    name = re.sub(r'[^a-z0-9._]', '', (raw or '').lower())
    if name[:1] in ('.', '_'):
        name = 'u' + name
    name = name[:24]
    if len(name) < 3:
        name = (name + str(legacy_id))[:24]
    if name in taken:
        suffix = str(legacy_id)
        name = name[:24 - len(suffix)] + suffix
    assert re.fullmatch(r'[a-z0-9][a-z0-9._]{2,23}', name) and name not in taken, (raw, name)
    taken.add(name)
    return name


def phone_of(raw):
    digits = re.sub(r'\D', '', raw or '')
    local = digits[2:] if digits.startswith('55') and len(digits) > 11 else digits
    return local if re.fullmatch(r'[1-9][0-9]9?[0-9]{8}', local) else ''


def created_of(joined, registered):
    if int(joined or 0) > 0:
        return int(joined) * 1000
    m = re.fullmatch(r'(\d{4})/(\d{1,2})', (registered or '').strip())
    return int(datetime(int(m[1]), int(m[2]), 1, tzinfo=timezone.utc).timestamp() * 1000) if m else 0


def media_url(path):
    return '/legado/' + path if path else ''


started = time.time()
manifest = {'image': {}, 'video': {}, 'audio': {}, 'file': {}}


def use(path, kind):
    if path:
        manifest[kind][path] = files[path]
    return media_url(path)


# ---- contas
accounts, taken = [], set()
user_sql = "SELECT " + obj(id='user_id', username='username', email='email', password='password', first='first_name', last='last_name',
                           avatar='avatar', cover='cover', about='about', verified='verified', lastseen='lastseen', joined='joined',
                           registered='registered', phone='phone_number') + " FROM Wo_Users WHERE active='1' AND banned=0 ORDER BY user_id"
for u in rows(user_sql):
    username = username_of(u['username'], u['id'], taken)
    name = clean(f"{u['first'] or ''} {u['last'] or ''}", 40) or username
    if len(name) < 2:
        name = username
    avatar = existing(u['avatar'], IMAGE)
    cover = existing(u['cover'], IMAGE)
    if avatar and Path(avatar).stem in DEFAULTS:
        avatar = None
    if cover and Path(cover).stem in DEFAULTS:
        cover = None
    accounts.append({
        'legacyId': int(u['id']), 'username': username, 'name': name, 'bio': clean(u['about'], 280),
        'googleKey': (u['email'] or '').strip().lower(), 'phone': phone_of(u['phone']),
        'avatarUrl': use(avatar, 'image'), 'coverUrl': use(cover, 'image'),
        'createdAt': created_of(u['joined'], u['registered']), 'lastSeenAt': int(u['lastseen'] or 0) * 1000,
        'verified': str(u['verified']) == '1',
        'legacyPassword': u['password'] if len(u['password'] or '') == 60 else ''
    })
known = {a['legacyId'] for a in accounts}

# ---- comunidades (grupos)
communities, slugs = [], set()
group_sql = "SELECT " + obj(id='id', owner='user_id', slug='group_name', title='group_title', avatar='avatar', cover='cover', about='about',
                            privacy='privacy', time='time') + " FROM Wo_Groups WHERE active='1' ORDER BY id"
members = {}
for m in rows("SELECT " + obj(g='group_id', u='user_id') + " FROM Wo_Group_Members WHERE active='1'"):
    members.setdefault(int(m['g']), set()).add(int(m['u']))
for g in rows(group_sql):
    slug = re.sub(r'-+', '-', re.sub(r'[^a-z0-9-]', '-', (g['slug'] or '').lower())).strip('-')[:48] or 'grupo'
    if slug in slugs:
        slug = f"{slug}-{g['id']}"
    slugs.add(slug)
    owner = int(g['owner'])
    group_members = {u for u in members.get(int(g['id']), set()) | {owner} if u in known}
    avatar, cover = existing(g['avatar'], IMAGE), existing(g['cover'], IMAGE)
    communities.append({
        'legacyId': int(g['id']), 'slug': slug, 'name': clean(g['title'], 60) or g['slug'], 'description': clean(g['about'], 600),
        'visibility': 'private' if str(g['privacy']) == '2' else 'public',
        'avatarUrl': use(None if avatar and Path(avatar).stem in DEFAULTS else avatar, 'image'),
        'coverUrl': use(None if cover and Path(cover).stem in DEFAULTS else cover, 'image'),
        'ownerLegacyId': owner if owner in known else 0, 'createdAt': int(g['time'] or 0) * 1000,
        'memberLegacyIds': sorted(group_members)
    })
community_ids = {c['legacyId'] for c in communities}

# ---- publicações
post_filter = ("p.active=1 AND p.postPrivacy='0' AND p.postType IN ('post','') AND p.page_id=0 AND p.event_id=0 AND p.recipient_id=0 "
               "AND p.parent_id=0 AND p.postShare=0 AND p.shared_from=0")
post_sql = "SELECT " + obj(id='p.id', author='p.user_id', text='p.postText', group_id='p.group_id', file='p.postFile', fileName='p.postFileName',
                           time='p.time', link='p.postLink', linkTitle='p.postLinkTitle', linkImage='p.postLinkImage', youtube='p.postYoutube') + \
           " FROM Wo_Posts p WHERE " + post_filter + " ORDER BY p.time DESC"
album = {}
for a in rows("SELECT " + obj(post='post_id', image='image') + " FROM Wo_Albums_Media ORDER BY id"):
    album.setdefault(int(a['post']), []).append(a['image'])
comments = {}
for c in rows("SELECT " + obj(id='id', post='post_id', author='user_id', text='text', time='time') + " FROM Wo_Comments WHERE page_id=0 ORDER BY id"):
    if int(c['author']) in known:
        text = clean(c['text'], 1000)
        if text:
            comments.setdefault(int(c['post']), []).append({'legacyId': int(c['id']), 'authorLegacyId': int(c['author']), 'text': text, 'createdAt': int(c['time'] or 0) * 1000})
reactions = {}
for r in rows("SELECT " + obj(post='post_id', author='user_id', reaction='reaction') + " FROM Wo_Reactions WHERE post_id>0 AND comment_id=0 ORDER BY id"):
    if int(r['author']) in known:
        reactions.setdefault(int(r['post']), {})[int(r['author'])] = REACTIONS.get(str(r['reaction']), 'like')

posts, dropped = [], Counter()
for p in rows(post_sql):
    pid, author = int(p['id']), int(p['author'])
    if author not in known:
        dropped['autor ausente'] += 1
        continue
    refs = [p['file']] + album.get(pid, [])
    images, media, missing = [], None, False
    for ref in refs:
        if not ref:
            continue
        ext = Path(ref).suffix.lower()
        if ext in IMAGE:
            found = existing(ref, IMAGE)
            if found:
                if found not in images:
                    images.append(found)
            else:
                missing = True
        elif ext in VIDEO or ext in AUDIO or ext == '.pdf':
            kind = 'video' if ext in VIDEO else 'audio' if ext in AUDIO else 'file'
            found = existing(ref, {ext}, MAX_FILE)
            if found and not media:
                media = {'kind': kind, 'url': use(found, kind), 'name': p['fileName'] or Path(found).name}
            elif not found:
                missing = True
        else:
            missing = True
    link = None
    if p['youtube']:
        link = {'url': 'https://www.youtube.com/watch?v=' + p['youtube'].strip()}
    elif p['link']:
        link = {'url': p['link'].strip(), 'title': clean(p['linkTitle'], 200), 'image': (p['linkImage'] or '').strip()}
    text = post_text(p['text'])
    if not text and not images and not media and not link:
        dropped['sem texto nem mídia'] += 1
        continue
    group_id = int(p['group_id'] or 0)
    posts.append({
        'legacyId': pid, 'authorLegacyId': author, 'text': text, 'createdAt': int(p['time'] or 0) * 1000,
        'image': use(images[0], 'image') if images else '', 'images': [use(i, 'image') for i in images], 'media': media,
        'attachmentMissing': missing, 'communityLegacyId': group_id if group_id in community_ids else 0, 'link': link,
        'comments': sorted(comments.get(pid, []), key=lambda c: c['createdAt']),
        'reactions': [{'authorLegacyId': a, 'reaction': r} for a, r in reactions.get(pid, {}).items()]
    })

# ---- seguir
follows = [[int(f['follower']), int(f['following'])] for f in rows("SELECT " + obj(follower='follower_id', following='following_id') + " FROM Wo_Followers WHERE active='1'")
           if int(f['follower']) in known and int(f['following']) in known and int(f['follower']) != int(f['following'])]
follows = sorted({tuple(f) for f in follows})

# ---- saída
out_dir.mkdir(exist_ok=True)
(out_dir / 'legacy-import.json').write_text(json.dumps({
    'generatedAt': int(time.time() * 1000), 'accounts': accounts, 'posts': posts, 'communities': communities, 'follows': [list(f) for f in follows]
}, ensure_ascii=False))
ordered = [*manifest['image']] + [*manifest['video']] + [*manifest['audio']] + [*manifest['file']]
(out_dir / 'media-manifest.txt').write_text('\n'.join(ordered) + '\n')

pairs = set(follows)
mutual = sum(1 for a, b in follows if a < b and (b, a) in pairs)
print(f"Contas: {len(accounts)} ({sum(bool(a['avatarUrl']) for a in accounts)} com avatar, {sum(bool(a['coverUrl']) for a in accounts)} com capa, {sum(bool(a['phone']) for a in accounts)} com telefone)")
print(f"Publicações: {len(posts)} ({sum(bool(p['image']) for p in posts)} com imagem, {sum(bool(p['media']) for p in posts)} com vídeo/áudio/arquivo, "
      f"{sum(p['attachmentMissing'] for p in posts)} com anexo perdido, {sum(bool(p['communityLegacyId']) for p in posts)} em comunidade); descartadas: {dict(dropped)}")
print(f"Comentários: {sum(len(p['comments']) for p in posts)}; reações: {sum(len(p['reactions']) for p in posts)}")
print(f"Comunidades: {len(communities)} ({sum(len(c['memberLegacyIds']) for c in communities)} participações); follows: {len(follows)} ({mutual} mútuos)")
for kind, items in manifest.items():
    print(f"Manifesto {kind}: {len(items)} arquivos, {sum(items.values()) / 1e6:.1f} MB")
print(f"Total: {len(ordered)} arquivos, {sum(files[p] for p in ordered) / 1e9:.2f} GB em {time.time() - started:.1f}s → {out_dir}")
