#!/usr/bin/env bash
set -euo pipefail

# Zubo Installer
# Usage: curl -fsSL https://zubo.bot/install.sh | bash

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
CYAN='\033[36m'
RESET='\033[0m'

info()  { echo -e "${CYAN}${BOLD}→${RESET} $1"; }
ok()    { echo -e "${GREEN}${BOLD}✓${RESET} $1"; }
warn()  { echo -e "${YELLOW}${BOLD}!${RESET} $1"; }
fail()  { echo -e "${RED}${BOLD}✗${RESET} $1"; exit 1; }

echo ""
echo -e "${BOLD}  zubo installer${RESET}"
echo -e "${DIM}  The AI agent that never forgets${RESET}"
echo ""

# --- OS detection ---
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux*)  PLATFORM="linux" ;;
  Darwin*) PLATFORM="darwin" ;;
  *)       fail "Unsupported OS: $OS. Zubo supports macOS and Linux." ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="aarch64" ;;
  *)             fail "Unsupported architecture: $ARCH" ;;
esac

info "Detected ${PLATFORM}/${ARCH}"

# --- Install Bun if missing ---
if command -v bun &>/dev/null; then
  BUN_VERSION=$(bun --version 2>/dev/null || echo "unknown")
  ok "Bun already installed (v${BUN_VERSION})"
else
  info "Installing Bun runtime..."
  curl -fsSL https://bun.sh/install | bash

  # Source the updated profile so bun is on PATH
  export BUN_INSTALL="${HOME}/.bun"
  export PATH="${BUN_INSTALL}/bin:${PATH}"

  if command -v bun &>/dev/null; then
    ok "Bun installed (v$(bun --version))"
  else
    fail "Bun installation failed. Install manually: https://bun.sh"
  fi
fi

# --- Install Zubo ---
info "Installing Zubo..."

if bun add -g zubo 2>/dev/null; then
  ok "Zubo installed globally"
else
  warn "Global install failed, trying with sudo..."
  sudo bun add -g zubo || fail "Installation failed. Try: bun add -g zubo"
  ok "Zubo installed globally (with sudo)"
fi

# --- Verify ---
if command -v zubo &>/dev/null; then
  ZUBO_VERSION=$(zubo --version 2>/dev/null || echo "installed")
  ok "Zubo is ready (${ZUBO_VERSION})"
else
  # Bun global bin might not be on PATH yet
  ZUBO_BIN="${HOME}/.bun/bin/zubo"
  if [ -f "$ZUBO_BIN" ]; then
    warn "Zubo installed but not on PATH. Add this to your shell profile:"
    echo ""
    echo -e "  ${DIM}export PATH=\"\$HOME/.bun/bin:\$PATH\"${RESET}"
    echo ""
  else
    fail "Zubo binary not found after install"
  fi
fi

echo ""
echo -e "${BOLD}  Next steps:${RESET}"
echo ""
echo -e "  ${CYAN}1.${RESET} Run the setup wizard:    ${BOLD}zubo setup${RESET}"
echo -e "  ${CYAN}2.${RESET} Start your agent:        ${BOLD}zubo start${RESET}"
echo -e "  ${CYAN}3.${RESET} Open the dashboard:      ${BOLD}zubo dashboard${RESET}"
echo ""
echo -e "  ${DIM}Docs: https://zubo.bot/docs${RESET}"
echo ""
