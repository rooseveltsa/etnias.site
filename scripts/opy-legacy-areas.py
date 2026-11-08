#!/usr/bin/env python3
"""Áreas do menu OPY com o conteúdo público do Etnias 1.0 (Blogs, Páginas, Mercado, Eventos, Filmes, Empregos e Coletas).
Lê o banco recuperado (somente SELECT, como scripts/import-legacy.py) e gera:
  preview/server/legado-areas.json         conteúdo para leitura (fora do Git; vai para a VPS no rsync de preview/server)
  preview/legacy/areas-media-manifest.txt  fotos referenciadas que existem no disco (para o rsync de mídia)
Sem e-mail, telefone ou endereço de pessoas; autores só pelo id do 1.0 (o servidor liga à conta da 2.0)."""
from pathlib import Path
import html
import json
import re
import subprocess
import time

root = Path(__file__).resolve().parents[1]
upload_root = root / 'public_html'
IMAGE = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
CURRENCIES = ["USD", "EUR", "JPY", "TRY", "GBP", "RUB", "PLN", "ILS", "BRL", "INR"]
manifest = set()


def rows(sql):
    result = subprocess.run(['docker', 'compose', '-f', str(root / 'deploy/compose.yaml'), 'exec', '-T', 'db', 'sh', '-c',
                             'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -uroot --batch --raw --skip-column-names etnias -e "$1"', 'sh', sql],
                            check=True, capture_output=True, text=True)
    return [json.loads(line) for line in result.stdout.splitlines()]


def obj(**cols):
    return 'JSON_OBJECT(' + ','.join(f"'{k}',{v}" for k, v in cols.items()) + ')'


def clean(value, limit):
    text = re.sub(r'<\s*(br|/p|/div|/h\d|/li)\s*/?>', '\n', str(value or ''), flags=re.I)
    text = html.unescape(re.sub(r'<[^>]+>', '', text))
    text = html.unescape(text)
    text = re.sub(r'[ \t\r\f\v ]+', ' ', text)
    text = re.sub(r' *\n *', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    return text[:limit].strip()


def image(path):
    """URL /legado/ só para foto que existe no disco; entra no manifesto da mídia."""
    if not path or not path.startswith('upload/') or '..' in path.split('/') or Path(path).suffix.lower() not in IMAGE:
        return ''
    if not (upload_root / path).is_file():
        return ''
    manifest.add(path)
    return '/legado/' + path


def safe_url(url):
    url = (url or '').strip()
    return url if re.match(r'^https?://[^\s<>"]+$', url) else ''


def categories(table):
    return {r['id']: html.unescape(r['name'] or '') for r in rows("SELECT " + obj(id='c.id', name='l.portuguese') + f" FROM {table} c LEFT JOIN Wo_Langs l ON l.lang_key COLLATE utf8mb3_general_ci = c.lang_key COLLATE utf8mb3_general_ci")}


def ts(value):
    try:
        return int(value or 0) * 1000
    except ValueError:
        return 0


def currency(index):
    return CURRENCIES[int(index)] if str(index).isdigit() and int(index) < len(CURRENCIES) else 'BRL'


blog_cat, page_cat, product_cat = categories('Wo_Blogs_Categories'), categories('Wo_Pages_Categories'), categories('Wo_Products_Categories')

blogs = [{
    'id': b['id'], 'title': clean(b['title'], 200), 'summary': clean(b['description'], 400), 'content': clean(b['content'], 30000),
    'category': blog_cat.get(b['category'], '') or '', 'cover': image(b['thumbnail']), 'createdAt': ts(b['posted']), 'authorLegacyId': b['user'], 'views': int(b['view'] or 0)
} for b in rows("SELECT " + obj(id='id', user='user', title='title', content='content', description='description', posted='posted', category='category', thumbnail='thumbnail', view='view') + " FROM Wo_Blog WHERE active='1' ORDER BY posted DESC")]

pages = [{
    'id': p['id'], 'slug': p['slug'], 'title': clean(p['title'], 120), 'description': clean(p['description'], 3000), 'category': page_cat.get(p['category'], '') or '',
    'avatar': image(p['avatar']), 'cover': image(p['cover']), 'website': safe_url(p['website']), 'instagram': safe_url(p['instagram']), 'youtube': safe_url(p['youtube']),
    'verified': str(p['verified']) == '1', 'ownerLegacyId': p['owner'], 'createdAt': ts(p['time'])
} for p in rows("SELECT " + obj(id='page_id', slug='page_name', title='page_title', description='page_description', category='page_category', avatar='avatar', cover='cover',
                                 website='website', instagram='instgram', youtube='youtube', verified='verified', owner='user_id', time='time') + " FROM Wo_Pages WHERE active='1' ORDER BY time DESC")]

events = [{
    'id': e['id'], 'title': clean(e['name'], 160), 'location': clean(e['location'], 200), 'description': clean(e['description'], 5000),
    'start': f"{e['sd'] or ''} {e['st'] or ''}".strip(), 'end': f"{e['ed'] or ''} {e['et'] or ''}".strip(), 'cover': image(e['cover']), 'authorLegacyId': e['poster']
} for e in rows("SELECT " + obj(id='id', name='name', location='location', description='description', sd='start_date', st='start_time', ed='end_date', et='end_time', poster='poster_id', cover='cover') + " FROM Wo_Events ORDER BY start_date DESC")]

media = {}
for m in rows("SELECT " + obj(product='product_id', image='image') + " FROM Wo_Products_Media ORDER BY id"):
    url = image(m['image'])
    if url:
        media.setdefault(m['product'], []).append(url)
products = [{
    'id': p['id'], 'title': clean(p['name'], 160), 'description': clean(p['description'], 5000), 'price': float(p['price'] or 0), 'currency': currency(p['currency']),
    'category': product_cat.get(p['category'], '') or '', 'location': clean(p['location'], 120), 'condition': 'usado' if str(p['type']) == '1' else 'novo',
    'sold': str(p['status']) == '1', 'images': media.get(p['id'], [])[:8], 'sellerLegacyId': p['user'], 'createdAt': ts(p['time'])
} for p in rows("SELECT " + obj(id='id', user='user_id', name='name', description='description', category='category', price='price', location='location', status='status', type='type', currency='currency', time='time') + " FROM Wo_Products WHERE active='1' ORDER BY time DESC")]

jobs = [{
    'id': j['id'], 'title': clean(j['title'], 160), 'location': clean(j['location'], 160), 'description': clean(j['description'], 5000), 'type': clean(j['type'], 40),
    'minimum': j['min'], 'maximum': j['max'], 'salaryPer': clean(j['per'], 20), 'currency': currency(j['cur']),
    'image': image(j['image']), 'open': str(j['status']) == '1', 'authorLegacyId': j['user'], 'createdAt': ts(j['time'])
} for j in rows("SELECT " + obj(id='id', user='user_id', title='title', location='location', min='minimum', max='maximum', per='salary_date', type='job_type', description='description', image='image', cur='currency', status='status', time='time') + " FROM Wo_Job ORDER BY time DESC")]

raised = {r['f']: float(r['total'] or 0) for r in rows("SELECT " + obj(f='funding_id', total='SUM(amount)') + " FROM Wo_Funding_Raise GROUP BY funding_id")}
funding = [{
    'id': f['id'], 'title': clean(f['title'], 160), 'description': clean(f['description'], 5000), 'goal': float(f['amount'] or 0), 'raised': raised.get(f['id'], 0.0),
    'image': image(f['image']), 'authorLegacyId': f['user'], 'createdAt': ts(f['time'])
} for f in rows("SELECT " + obj(id='id', title='title', description='description', amount='amount', user='user_id', image='image', time='time') + " FROM Wo_Funding ORDER BY time DESC")]


def youtube_id(url):
    m = re.search(r'(?:youtube(?:-nocookie)?\.com/(?:embed/|watch\?v=|shorts/)|youtu\.be/)([A-Za-z0-9_-]{11})', url or '')
    return m[1] if m else ''


movies = [{
    'id': m['id'], 'title': clean(m['name'], 160), 'genre': clean(m['genre'], 60), 'stars': clean(m['stars'], 200), 'producer': clean(m['producer'], 120), 'country': clean(m['country'], 60),
    'release': clean(m['release'], 10), 'duration': clean(m['duration'], 20), 'description': clean(m['description'], 5000), 'cover': image(m['cover']),
    'youtube': youtube_id(m['iframe']) or youtube_id(m['source'])
} for m in rows("SELECT " + obj(id='id', name='name', genre='genre', stars='stars', producer='producer', country='country', release='`release`', duration='duration', description='description', cover='cover', source='source', iframe='iframe') + " FROM Wo_Movies ORDER BY id DESC")]

out = {'geradoEm': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'origem': 'Banco recuperado do Etnias 1.0 (somente leitura)',
       'blogs': blogs, 'paginas': pages, 'eventos': events, 'mercado': products, 'empregos': jobs, 'coletas': funding, 'filmes': movies}
(root / 'preview/server/legado-areas.json').write_text(json.dumps(out, ensure_ascii=False) + '\n')
(root / 'preview/legacy').mkdir(exist_ok=True)
(root / 'preview/legacy/areas-media-manifest.txt').write_text(''.join(p + '\n' for p in sorted(manifest)))
print(', '.join(f'{k}: {len(v)}' for k, v in out.items() if isinstance(v, list)) + f' · {len(manifest)} fotos no manifesto')
