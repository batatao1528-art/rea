#!/usr/bin/env bash
# Gera um APK novo a partir do APK original, trocando só a parte web (www/) e assinando de novo.
# Uso: tools/build-apk.sh ORIGINAL.apk [SAIDA.apk]
# Chave: $KEYSTORE (PKCS12, padrão ~/.android/assistente.p12), senha $KEYSTORE_PASS, alias "assistente".
# Use sempre a mesma chave: o Android só aceita atualizar o app se a assinatura for a mesma.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
root="$(dirname "$here")"
src="$1"
out="${2:-$root/build/assistente-poker.apk}"
keystore="${KEYSTORE:-$HOME/.android/assistente.p12}"
pass="${KEYSTORE_PASS:-android}"
apksig_ver=8.7.3
cache="$root/build/cache"
mkdir -p "$cache" "$(dirname "$out")"

jar="$cache/apksig-$apksig_ver.jar"
if [ ! -f "$jar" ]; then
  curl -fsSL -o "$jar" "https://dl.google.com/dl/android/maven2/com/android/tools/build/apksig/$apksig_ver/apksig-$apksig_ver.jar"
fi

if [ ! -f "$keystore" ]; then
  echo "Criando chave nova em $keystore (guarde esse arquivo para as próximas versões)"
  mkdir -p "$(dirname "$keystore")"
  keytool -genkeypair -keystore "$keystore" -storetype PKCS12 -storepass "$pass" -alias assistente \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Assistente de Poker" >/dev/null
fi

node "$root/tests/blackjack.test.js"
python3 -I "$here/repack.py" "$src" "$root/www" "$cache/unsigned.apk"
java -cp "$jar" "$here/SignApk.java" "$cache/unsigned.apk" "$out" "$keystore" "$pass" assistente
echo "APK gerado: $out"
