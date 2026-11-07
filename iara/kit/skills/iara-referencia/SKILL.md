---
name: iara-referencia-por-caminho
description: Como a IAra resolve uma skill (skill_view) ou o caminho absoluto de um script SEM copiar nada para o proprio profile. Traz o mapa de onde cada coisa mora no Hermes, a receita de resolucao por caminho absoluto e a regra referencia-vs-copia. Usar antes de apontar qualquer fluxo de destino.
---

# IAra — Referencia por Caminho

Regra de ouro: a IAra APONTA, nao COPIA. Nenhum script, skill ou
ferramenta de outro profile entra em `~/.hermes/profiles/iara/`.
Referencia = nome da skill + caminho absoluto do arquivo/script.

## 1. Onde cada coisa mora

- Skill ativa deste profile: `$HERMES_HOME/skills/<nome>/SKILL.md`
  (para a IAra: `/home/anaobranca/.hermes/profiles/iara/skills/`).
- Skills do profile default: `/home/anaobranca/.hermes/skills/<categoria>/<nome>/SKILL.md`
  (categorias: creative, integrations, hermes, documentos, platform,
  peca-a-peca, arara-pexinxavel, pluma-pexinxavel, ...).
- Skills de outro profile: `/home/anaobranca/.hermes/profiles/<profile>/skills/`.
- Scripts do Hermes: `/home/anaobranca/.hermes/scripts/<nome>.py|.sh`.
- CLIs instaladas: `/home/anaobranca/.local/bin/<nome>`.
- Projetos e negocio: `/home/anaobranca/Hermes/<Area>/`.
- Skill com scripts embutidos: `<skill_dir>/scripts/<arquivo>`.
- Motor do Hermes: `/home/anaobranca/hermes-agent` — NUNCA modificar.

## 2. Receita A — resolver uma skill

1. `skills_list` mostra o nome e a descricao de tudo que o profile ve.
2. `skill_view(name="<nome>")` carrega o SKILL.md (a busca aceita o nome
   do frontmatter mesmo quando a pasta e menor).
3. Se a skill estiver em outro profile/caminho, devolver no ticket o
   caminho absoluto do SKILL.md, nao uma copia:
   `/home/anaobranca/.hermes/skills/<categoria>/<nome>/SKILL.md`.
4. Se nao existir: pendencia `{"item": "<nome>", "motivo": "skill nao
   encontrada"}`. Nunca inventar caminho.

## 3. Receita B — resolver um script

1. Localizar sem abrir: `ls -la /home/anaobranca/.hermes/scripts/` e
   `test -e <caminho>`.
2. Devolver o caminho absoluto no ticket (`referencia.caminho`).
3. Executar por caminho, quando for o caso, sem copiar:
   `python3 /home/anaobranca/.hermes/scripts/<nome>.py`.
4. Se o script estiver dentro de uma skill, o caminho e
   `<skill_dir>/scripts/<arquivo>`.

## 4. Receita C — validar a referencia antes de devolver

- `test -e "<caminho>"` -> exit 0 = referencia valida.
- `test -d "<skill_dir>"` para pasta de skill.
- Referencia invalida nao entra no ticket como sucesso: vira pendencia.

## 5. Proibido

- `cp` de script/skill de outro profile para o profile da IAra.
- Symlink para dentro de outro profile.
- Reescrever ferramenta existente "para caber" no profile.
- Apontar caminho que nao existe.
- Executar o trabalho do setor: a IAra so entrega a referencia.

## 6. Formato da referencia no ticket

"referencia": {
  "skill_de_destino": "<nome-da-skill>",
  "caminho": "/caminho/absoluto/SKILL.md ou /caminho/absoluto/script.py"
}

Se o destino for uma skill do proprio profile, o caminho fica sob
`/home/anaobranca/.hermes/profiles/iara/skills/`. Se for do acervo
geral, sob `/home/anaobranca/.hermes/skills/`. Em nenhum caso copiar.
