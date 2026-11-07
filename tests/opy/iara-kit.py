#!/usr/bin/env python3
"""Check isolated installation, publication gates and upstream CLI contracts."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from datetime import datetime, timedelta, timezone

sys.dont_write_bytecode = True
project = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('iara_installer', project / 'scripts/iara.py')
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)

with tempfile.TemporaryDirectory(prefix='etnias-iara-test-') as temporary:
    root = Path(temporary) / 'hermes'
    result = installer.install(root)
    assert result['storage'] == 'local'
    assert len(list((root / 'profiles/iara/skills').iterdir())) == 19
    assert len(list((root / 'skills').iterdir())) == 26
    for skill in (root / 'skills').iterdir():
        assert 'name: ' + skill.name + '\n' in (skill / 'SKILL.md').read_text()
    assert '/home/anaobranca' not in (root / 'scripts/kit-design-etnias.py').read_text()
    assert 'Path.home()' not in (root / 'scripts/kit-design-etnias.py').read_text()
    assert len(list((root / 'iara-data').glob('*.json'))) == 17
    assert (root / 'profiles/iara/design-kit/etnias/DESIGN.md').is_file()
    assert (root / 'iara-data/config.json').stat().st_mode & 0o777 == 0o600
    sys.path.insert(0, str(root / 'skills/iara-adapter/scripts'))
    import iara_adapter as adapter

    def refused(function, exception=adapter.ErroDeValidacao):
        try:
            function()
        except exception:
            return
        raise AssertionError('A operação deveria ter sido recusada')

    digest = 'a' * 64
    refused(lambda: adapter.registrar_aprovacao('pedido-1', 'Revisor', digest))
    approval = adapter.registrar_aprovacao('pedido-1', 'Revisor', digest, canal='instagram', peca_id='card-1', solicitante='Criador')
    assert approval['aprovado'] is False
    assert approval['registro']['peca_id'] == 'card-1'
    refused(lambda: adapter.transicionar_aprovacao('pedido-1', 'Criador', peca_id='card-1'))
    refused(lambda: adapter.transicionar_aprovacao('pedido-1', 'Revisor', peca_id='card-outra'))
    assert adapter.transicionar_aprovacao('pedido-1', 'Revisor', peca_id='card-1')['aprovado'] is True

    def publish(**changes):
        values = dict(peca_id='card-1', aprovador='Revisor', canal='instagram', url='https://example.org/post/1', solicitacao_id='pedido-1', peca_hash=digest)
        values.update(changes)
        return adapter.registrar_publicacao(**values)

    refused(lambda: publish(solicitacao_id=None))
    refused(lambda: publish(peca_hash=None))
    refused(lambda: publish(peca_hash='b' * 64), adapter.IntegridadePublicacao)
    refused(lambda: publish(peca_id='card-outra'))
    refused(lambda: publish(canal='linkedin'))
    refused(lambda: publish(aprovador='Outro revisor'))
    assert publish()['registro']['hash_conferido'] is True
    refused(lambda: adapter.registrar_calendario('pauta-pii', 'Contato pessoa@example.com', 'site', '2026-12-01', anonimizado=True), adapter.PiiNaoAnonimizada)
    assert adapter.verificar_pii('Contato: (11) 91234-5678')['tem_pii']
    approvals = root / 'iara-data/aprovacoes.json'
    rows = json.loads(approvals.read_text())
    rows[0]['aprovado_em'] = (datetime.now(timezone.utc) - timedelta(days=8)).isoformat()
    approvals.write_text(json.dumps(rows))
    assert adapter.consultar_aprovacao('pedido-1')['aprovado'] is False
    refused(publish, adapter.IntegridadePublicacao)
    institutional = root / 'iara-data/institucional.json'
    institutional.write_text(json.dumps([{'tipo_registro': 'autorizacao', 'peca_id': 'card-1', 'bloqueado': True}]))
    refused(publish, adapter.BloqueioInstitucional)
    institutional.write_text(json.dumps([{'tipo_registro': 'autorizacao', 'peca_id': 'card-1', 'restritas': [{'item_id': 'foto-1'}]}]))
    refused(publish, adapter.BloqueioInstitucional)
    institutional.write_text('{corrompido')
    refused(publish, adapter.BloqueioInstitucional)
    institutional.write_text('[]')

    def cli(skill, script, *arguments):
        return subprocess.run([sys.executable, str(root / 'skills' / skill / 'scripts' / script), *arguments], capture_output=True, text=True, env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'})

    calendar = cli('iara-calendario', 'calendario.py', '--solicitacao-id', 'pii-1', '--titulo', 'Contato pessoa@example.com', '--data-prevista', '2026-12-01')
    assert calendar.returncode == 4, calendar.stderr
    assert json.loads(calendar.stdout)['motivo'] == 'pii_nao_anonimizada'
    intake = cli('iara-solicitacao', 'solicitar.py', 'criar', '--solicitante', 'Equipe', '--setor', 'design', '--tipo', 'arte', '--descricao', 'Contato pessoa@example.com')
    assert intake.returncode == 4, intake.stderr
    assert json.loads(intake.stdout)['motivo'] == 'pii_nao_anonimizada'
    report = cli('iara-relatorio', 'relatar.py', '--periodo', '2026-11')
    assert report.returncode == 0, report.stderr
    assert json.loads(report.stdout)['relatorio']['texto'].isascii()
    revision = importlib.util.spec_from_file_location('iara_revision', root / 'skills/iara-revisao/scripts/revisar.py')
    reviewer = importlib.util.module_from_spec(revision)
    revision.loader.exec_module(reviewer)
    assert reviewer.eixo_fonte('Texto da notícia. Fonte: Agência de exemplo', 'noticia')['status'] == 'ok'
    intake = cli('iara-solicitacao', 'solicitar.py', 'criar', '--solicitante', 'Equipe', '--setor', 'design', '--tipo', 'arte', '--descricao', 'Card de apresentação do projeto')
    assert intake.returncode == 0, intake.stderr
    created = json.loads(intake.stdout)['solicitacao']
    assert cli('iara-solicitacao', 'solicitar.py', 'aceitar', '--id', created['id']).returncode == 0
    writers = [subprocess.Popen([sys.executable, str(root / 'skills/iara-calendario/scripts/calendario.py'), '--solicitacao-id', 'pauta-' + str(n), '--titulo', 'Pauta de teste', '--data-prevista', '2026-12-01'], stdout=subprocess.PIPE, stderr=subprocess.PIPE) for n in range(8)]
    for writer in writers:
        output, errors = writer.communicate()
        assert writer.returncode == 0, errors
    assert len(json.loads((root / 'iara-data/calendario.json').read_text())) == 9, 'Escritas concorrentes devem ser preservadas'
    saved = (root / 'iara-data/solicitacoes.json').read_bytes()
    installer.install(root)
    assert (root / 'iara-data/solicitacoes.json').read_bytes() == saved
    assert json.loads((root / 'iara-data/calendario.json').read_text()), 'Aceitar deve gerar pauta'
    assert cli('iara-adapter', 'iara_adapter.py', '--test-connection').returncode == 0
    config = root / 'iara-data/config.json'
    config.write_text('{"storage":"supabase"}')
    connection = cli('iara-adapter', 'iara_adapter.py', '--test-connection')
    assert connection.returncode == 5
    assert json.loads(connection.stdout)['connected'] is False
    config.write_text('{corrompido')
    refused(adapter.ler_config)
    assert installer.verify() == 129, 'O kit original deve permanecer intacto'

print('PASS IAra: 129 checksums, 19 + 7 skills, 17 JSONs, instalação isolada, reinstalação preservada, aprovação por peça/canal/hash, separação nominal, expiração, bloqueio institucional, PII, calendário e relatório ASCII.')
