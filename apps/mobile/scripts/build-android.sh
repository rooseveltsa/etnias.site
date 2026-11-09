#!/usr/bin/env bash
# Gera o APK de produção assinado. A senha da chave vem das Senhas do Mac (item etnias-android-keystore) e não é impressa.
set -euo pipefail
cd "$(dirname "$0")/.."
export ETNIAS_KEYSTORE="$HOME/.config/etnias/etnias-release.jks"
[ -f "$ETNIAS_KEYSTORE" ] || { echo "Chave não encontrada em $ETNIAS_KEYSTORE. Restaure do item etnias-android-keystore-arquivo do Keychain."; exit 1; }
ETNIAS_KS_PASS="$(security find-generic-password -s etnias-android-keystore -w)"; export ETNIAS_KS_PASS
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
npx cap sync android
# --no-daemon: um daemon antigo do Gradle não enxerga as variáveis de ambiente desta execução.
(cd android && ./gradlew -q --no-daemon assembleRelease)
APK=android/app/build/outputs/apk/release/app-release.apk
"$HOME/Library/Android/sdk/build-tools/36.0.0/apksigner" verify --print-certs "$APK" | grep -i "SHA-256"
echo "Pronto: $APK"
