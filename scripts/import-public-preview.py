#!/usr/bin/env python3
"""Import only the public personal posts explicitly authorized for the published preview."""
from pathlib import Path
import hashlib
import html
import json
import re
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
public = "p.postPrivacy='0' AND p.active=1 AND u.active='1' AND u.banned=0 AND p.group_id=0 AND p.page_id=0 AND p.event_id=0 AND p.recipient_id=0 AND p.parent_id=0 AND p.postShare=0 AND p.shared_from=0 AND CHAR_LENGTH(p.postText) BETWEEN 10 AND 5000 AND p.postType NOT IN ('profile_picture','profile_cover')"
query = "SELECT JSON_OBJECT('id',p.id,'text',p.postText,'author',COALESCE(NULLIF(TRIM(CONCAT(u.first_name,' ',u.last_name)),''),u.username),'avatar',u.avatar,'time',p.time,'file',p.postFile,'photo',p.postPhoto) FROM Wo_Posts p JOIN Wo_Users u ON u.user_id=p.user_id WHERE " + public + " ORDER BY p.time DESC LIMIT 1000"
def rows(sql):
    result = subprocess.run(['docker','compose','-f',str(root/'deploy/compose.yaml'),'exec','-T','db','sh','-c','MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot --batch --raw --skip-column-names etnias -e "$1"','sh',sql],check=True,capture_output=True,text=True)
    return [json.loads(line) for line in result.stdout.splitlines()]

candidates = rows(query)
assert candidates, 'No authorized public posts found'
# Resolve the legacy public hashtag encoding rather than showing internal IDs.
hash_ids = sorted({int(v) for row in candidates for v in re.findall(r'#\[(\d+)\]', row['text'])})
hashtags = {row['id']: row['tag'] for row in rows("SELECT JSON_OBJECT('id',id,'tag',tag) FROM Wo_Hashtags WHERE id IN (" + ','.join(map(str,hash_ids)) + ")")} if hash_ids else {}

ids = ','.join(str(int(p['id'])) for p in candidates)
media = rows("SELECT JSON_OBJECT('post',post_id,'image',image) FROM Wo_Albums_Media WHERE post_id IN (" + ids + ") ORDER BY id")
by_post = {}
for item in media:
    by_post.setdefault(item['post'], []).append(item['image'])
source_root = (root/'public_html').resolve()
target = root/'preview/archive'
target.mkdir(exist_ok=True)
posts = []
for row in candidates:
    text = re.sub('<[^>]+>', '', html.unescape(row['text'])).strip()
    text = re.sub(r'#\[(\d+)\]', lambda match: '#'+hashtags[int(match[1])] if int(match[1]) in hashtags else '', text)
    if not text:
        continue
    post = {'id':'legacy-'+str(row['id']),'text':text,'author':row['author'],'createdAt':int(row['time'])*1000,'origin':'legacy','image':'','attachmentMissing':False,'audience':'public','comments':[],'reactions':{},'saves':[]}
    references = [row['file'], row['photo']] + by_post.get(row['id'], [])
    for value in references:
        if not value or not value.startswith('upload/'):
            continue
        image = (source_root/value).resolve()
        if source_root not in image.parents or image.suffix.lower() not in ['.jpg','.jpeg','.png','.webp','.gif']:
            continue
        if not image.is_file() or image.stat().st_size > 2000000:
            post['attachmentMissing'] = True
            continue
        name = hashlib.sha256(value.encode()).hexdigest()[:20] + image.suffix.lower()
        post['image'] = '/assets/archive/' + name
        post['_source_image'] = str(image)
        post['attachmentMissing'] = False
        break
    posts.append(post)
# A small cross-section of authors and formats is more useful than repeated posts
# from a single account. Keep each original text intact and preserve chronology.
selected = []
authors = {}
texts = set()
def choose(post):
    key = post['text'].strip().casefold()
    if post['id'] in {p['id'] for p in selected} or key in texts or authors.get(post['author'], 0) >= 2:
        return
    selected.append(post)
    texts.add(key)
    authors[post['author']] = authors.get(post['author'], 0) + 1
for post in [p for p in posts if p['image']]:
    if sum(bool(p['image']) for p in selected) >= 8: break
    choose(post)
for post in posts:
    if len(selected) >= 24: break
    choose(post)
selected.sort(key=lambda p:p['createdAt'], reverse=True)
avatars = { 'legacy-'+str(row['id']): row.get('avatar','') for row in candidates }
for post in selected:
    post['avatar'] = ''
    value = avatars.get(post['id'], '')
    if value.startswith('upload/'):
        avatar = (source_root/value).resolve()
        if source_root in avatar.parents and avatar.suffix.lower() in ['.jpg','.jpeg','.png','.webp','.gif'] and avatar.is_file() and avatar.stat().st_size <= 2000000 and avatar.stem not in ['d-avatar','f-avatar','default-avatar']:
            name = 'avatar-' + hashlib.sha256(value.encode()).hexdigest()[:20] + avatar.suffix.lower()
            shutil.copyfile(avatar, target/name)
            post['avatar'] = '/assets/archive/' + name
    source = post.pop('_source_image', None)
    if source:
        shutil.copyfile(source, target/Path(post['image']).name)
(root/'preview/public-posts.json').write_text(json.dumps(selected,ensure_ascii=False,indent=2))
print('Acervo autorizado:',len(selected),'postagens públicas;',sum(bool(p['image']) for p in selected),'imagens disponíveis. Autoria/data preservadas; sem mensagens privadas ou grupos.')

print('Fotos de perfil recuperadas para',sum(bool(p['avatar']) for p in selected),'publicações de',len({p['author'] for p in selected if p['avatar']}),'autores públicos.')
