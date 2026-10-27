"""Troca assets/www de um APK pelo conteúdo de www/ (sem assinar).

Uso: python3 -I repack.py ORIGINAL.apk WWW_DIR SAIDA.apk
Mantém o método de compressão de cada entrada (resources.arsc precisa continuar sem compressão)
e descarta assinaturas v1 antigas; a assinatura nova é feita por SignApk.java.
"""
import os
import sys
import zipfile

src, www, out = sys.argv[1:4]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, 'w') as zout:
    for info in zin.infolist():
        name = info.filename
        if name.startswith('assets/www/'):
            continue
        if name.startswith('META-INF/') and name.rsplit('.', 1)[-1] in ('SF', 'RSA', 'DSA', 'EC', 'MF'):
            continue
        zout.writestr(info, zin.read(name))
    for dirpath, _, files in os.walk(www):
        for f in sorted(files):
            path = os.path.join(dirpath, f)
            rel = os.path.relpath(path, www).replace(os.sep, '/')
            info = zipfile.ZipInfo('assets/www/' + rel, date_time=(1981, 1, 1, 1, 1, 2))
            info.compress_type = zipfile.ZIP_DEFLATED
            with open(path, 'rb') as fh:
                zout.writestr(info, fh.read())
