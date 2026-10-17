#!/bin/bash
# Registra o servidor MCP e a skill do REA (rea-agents) no Claude Code
# em sessões na nuvem. Idempotente: o setup do REA só atualiza o que falta.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if npx -y rea-agents@6.5.0 setup --client claude_code --yes >/dev/null 2>&1; then
  echo "REA configurado para o Claude Code (MCP 'rea' + skill reverse-engineer-anything)."
else
  echo "Aviso: falha ao executar 'rea-agents setup'; o REA pode não estar disponível nesta sessão." >&2
fi
