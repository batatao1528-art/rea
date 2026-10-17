# Assinar o AAB do NavegaDor (Play Store)

O GitHub gera o pacote `.aab` **assinado** sozinho. Você só precisa, **uma vez**,
criar a chave de assinatura e colar 4 segredos no repositório.

> ⚠️ **Guarde a chave (`navegador.jks`) e as senhas em lugar seguro.** Se perder,
> você **não consegue mais atualizar** o app na Play Store com a mesma identidade.
> Faça uma cópia de backup (nuvem privada, gerenciador de senhas).

## 1. Criar a chave de assinatura

No seu computador (precisa ter o Java instalado — vem com o Android Studio):

```bash
keytool -genkeypair -v \
  -keystore navegador.jks \
  -alias navegador \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```

Ele vai pedir uma **senha** (anote) e alguns dados (nome, organização, cidade…).
No fim, você terá o arquivo **`navegador.jks`**.

Guarde:
- a **senha do keystore** (store password)
- o **alias**: `navegador`
- a **senha da chave** (key password) — se você só apertou Enter, é a mesma do keystore

## 2. Transformar a chave em texto (base64)

A GitHub guarda segredos como texto, então converta o arquivo:

- **Linux/macOS:**
  ```bash
  base64 -w0 navegador.jks > navegador.b64   # Linux
  base64 navegador.jks | tr -d '\n' > navegador.b64   # macOS
  ```
- **Windows (PowerShell):**
  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes("navegador.jks")) > navegador.b64
  ```

Abra o `navegador.b64` e copie todo o conteúdo.

## 3. Colar os 4 segredos no GitHub

No repositório: **Settings → Secrets and variables → Actions → New repository secret**.
Crie estes quatro:

| Nome do segredo       | Valor                                      |
|-----------------------|--------------------------------------------|
| `KEYSTORE_BASE64`     | todo o conteúdo do `navegador.b64`         |
| `KEYSTORE_PASSWORD`   | a senha do keystore                        |
| `KEY_ALIAS`           | `navegador`                                |
| `KEY_PASSWORD`        | a senha da chave (igual à do keystore se você deu Enter) |

Link direto: `https://github.com/batatao1528-art/rea/settings/secrets/actions`

## 4. Gerar o AAB

Em **Actions → "Gerar AAB assinado NavegaDor" → Run workflow**.
Quando ficar verde, baixe o artefato **`navegador-aab`** → é o `app-release.aab`
que você envia na Play Console.

- O **versionCode** sobe sozinho a cada execução (número da run).
- O **versionName** ("1.0") pode ser mudado com o segredo/variável `VERSION_NAME`,
  ou me peça pra ajustar no `build.gradle`.

## Depois, na Play Console
1. Criar o app (nome **NavegaDor**, idioma pt-BR, app gratuito).
2. Enviar o `app-release.aab` em **Produção** (ou **Teste fechado** primeiro).
3. Preencher ficha: ícone (`app/play/icon-512.png`), descrição, prints,
   **política de privacidade** (posso gerar), classificação de conteúdo e
   formulário de segurança de dados (uso de localização).
