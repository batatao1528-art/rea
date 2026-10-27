#!/usr/bin/env bash
# Gera um APK novo a partir do APK original: troca a parte web (www/), acrescenta o código nativo
# de android/ (redimensionar a janela flutuante) e assina de novo.
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
cache="$root/build/cache"
work="$root/build/work"
rm -rf "$work"
mkdir -p "$cache" "$work" "$(dirname "$out")"

GOOGLE=https://dl.google.com/dl/android/maven2
CENTRAL=https://repo1.maven.org/maven2
fetch() { [ -f "$cache/$1" ] || curl -fsSL -o "$cache/$1" "$2"; }
fetch apksig.jar "$GOOGLE/com/android/tools/build/apksig/8.7.3/apksig-8.7.3.jar"
fetch r8.jar "$GOOGLE/com/android/tools/r8/8.7.18/r8-8.7.18.jar"
fetch baksmali.jar "$GOOGLE/com/android/tools/smali/smali-baksmali/3.0.9/smali-baksmali-3.0.9.jar"
fetch smali.jar "$GOOGLE/com/android/tools/smali/smali/3.0.9/smali-3.0.9.jar"
fetch dexlib2.jar "$GOOGLE/com/android/tools/smali/smali-dexlib2/3.0.9/smali-dexlib2-3.0.9.jar"
fetch smali-util.jar "$GOOGLE/com/android/tools/smali/smali-util/3.0.9/smali-util-3.0.9.jar"
fetch guava.jar "$CENTRAL/com/google/guava/guava/31.1-android/guava-31.1-android.jar"
fetch jcommander.jar "$CENTRAL/com/beust/jcommander/1.64/jcommander-1.64.jar"
fetch antlr.jar "$CENTRAL/org/antlr/antlr/3.5.2/antlr-3.5.2.jar"
fetch antlr-runtime.jar "$CENTRAL/org/antlr/antlr-runtime/3.5.2/antlr-runtime-3.5.2.jar"
fetch stringtemplate.jar "$CENTRAL/org/antlr/stringtemplate/3.2.1/stringtemplate-3.2.1.jar"
if [ ! -f "$cache/android.jar" ]; then
  curl -fsSL -o "$cache/platform.zip" https://dl.google.com/android/repository/platform-34-ext7_r02.zip
  unzip -q -o -j "$cache/platform.zip" '*/android.jar' -d "$cache"
  rm "$cache/platform.zip"
fi
smali_cp="$cache/dexlib2.jar:$cache/smali-util.jar:$cache/guava.jar:$cache/jcommander.jar"

if [ ! -f "$keystore" ]; then
  echo "Criando chave nova em $keystore (guarde esse arquivo para as próximas versões)"
  mkdir -p "$(dirname "$keystore")"
  keytool -genkeypair -keystore "$keystore" -storetype PKCS12 -storepass "$pass" -alias assistente \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Assistente de Poker" >/dev/null
fi

node "$root/tests/blackjack.test.js"

# Código nativo: smali do APK original + chamada ao OverlayResize, mais as classes de android/src.
unzip -q -o "$src" classes.dex -d "$work/orig"
java -cp "$cache/baksmali.jar:$smali_cp" com.android.tools.smali.baksmali.Main d "$work/orig/classes.dex" -o "$work/smali"
python3 -I "$root/android/patch_overlay.py" "$work/smali/br/poker/assistente/OverlayService.smali"
java -cp "$cache/smali.jar:$smali_cp:$cache/antlr.jar:$cache/antlr-runtime.jar:$cache/stringtemplate.jar" \
  com.android.tools.smali.smali.Main a "$work/smali" -o "$work/patched.dex" --api 26
mkdir -p "$work/classes" "$work/dex"
javac -source 8 -target 8 -nowarn -classpath "$cache/android.jar" -d "$work/classes" \
  $(find "$root/android/src" -name '*.java') 2>&1 | grep -v 'obsolete\|^warning\|^[0-9] warning' || true
java -cp "$cache/r8.jar" com.android.tools.r8.D8 --release --min-api 26 --lib "$cache/android.jar" \
  --output "$work/dex" "$work/patched.dex" $(find "$work/classes" -name '*.class')

python3 -I "$here/repack.py" "$src" "$root/www" "$work/unsigned.apk" "$work/dex/classes.dex"
java -cp "$cache/apksig.jar" "$here/SignApk.java" "$work/unsigned.apk" "$out" "$keystore" "$pass" assistente
echo "APK gerado: $out"
