#!/usr/bin/env bash
# Monta o pacote de entrega do Etnias para o novo responsável, neste Mac.
# Uso, na raiz do repositório:  bash scripts/entrega-projeto.sh
#
# Gera em ~/Desktop/etnias-entrega-AAAAMMDD/:
#   etnias-codigo.bundle   código com todo o histórico (git clone etnias-codigo.bundle etnias)
#   ENTREGA.md             o que existe, onde fica e como transferir cada acesso
#   segredos.tar.enc       chave Android (.jks), senha dela e chave do backup, criptografados (AES-256)
#
# Os segredos nunca aparecem na tela: saem do Keychain direto para uma pasta temporária,
# são criptografados com uma frase que VOCÊ digita, e a pasta temporária é apagada.
# Mande a frase por outro canal (ligação ou pessoalmente), nunca junto com o arquivo.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="$HOME/Desktop/etnias-entrega-$(date +%Y%m%d)"
mkdir -p "$OUT"

echo "1/3 Código com histórico completo…"
git bundle create "$OUT/etnias-codigo.bundle" --all
git bundle verify "$OUT/etnias-codigo.bundle" >/dev/null
cp docs/ENTREGA.md "$OUT/ENTREGA.md"

echo "2/3 Segredos (Keychain → arquivo criptografado)…"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir "$TMP/segredos"
missing=()
if [ -f "$HOME/.config/etnias/etnias-release.jks" ]; then cp "$HOME/.config/etnias/etnias-release.jks" "$TMP/segredos/"; else missing+=("etnias-release.jks"); fi
security find-generic-password -s etnias-android-keystore -w > "$TMP/segredos/senha-keystore-android.txt" 2>/dev/null || { rm -f "$TMP/segredos/senha-keystore-android.txt"; missing+=("senha do keystore (Keychain: etnias-android-keystore)"); }
security find-generic-password -l "Casa Opy - chave do backup" -w > "$TMP/segredos/chave-backup.txt" 2>/dev/null || { rm -f "$TMP/segredos/chave-backup.txt"; missing+=("chave do backup (Keychain: Casa Opy - chave do backup)"); }
printf 'Alias da chave Android: etnias\nAbrir um backup diário: openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in opy-AAAA-MM-DD.tgz.enc -out opy.tgz -pass file:chave-backup.txt\n' > "$TMP/segredos/LEIA.txt"
echo "   Digite uma frase forte (duas vezes). Ela NÃO fica salva em lugar nenhum."
tar -C "$TMP" -cf - segredos | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -out "$OUT/segredos.tar.enc"
# Para abrir:  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in segredos.tar.enc | tar -xf -

echo "3/3 Conferência…"
(cd "$OUT" && shasum -a 256 etnias-codigo.bundle segredos.tar.enc > SHA256SUMS)
ls -lh "$OUT"
if [ ${#missing[@]} -gt 0 ]; then echo "ATENÇÃO, não encontrado neste Mac:"; printf '  - %s\n' "${missing[@]}"; fi
echo "Pronto: $OUT"
echo "Falta à parte: mídia do legado (40 GB em public_html/upload) — copie para um HD externo (veja ENTREGA.md)."
