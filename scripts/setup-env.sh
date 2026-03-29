#!/usr/bin/env bash
#
# Appends run-adventure environment variables to your shell profile.
# Usage: bash scripts/setup-env.sh
#
# You will be prompted for each API key. Leave blank to skip.

set -euo pipefail

# Detect shell profile
if [[ -n "${ZSH_VERSION:-}" ]] || [[ "$SHELL" == */zsh ]]; then
  PROFILE="${HOME}/.zshrc"
elif [[ -f "${HOME}/.bashrc" ]]; then
  PROFILE="${HOME}/.bashrc"
elif [[ -f "${HOME}/.bash_profile" ]]; then
  PROFILE="${HOME}/.bash_profile"
else
  PROFILE="${HOME}/.profile"
fi

echo "Detected shell profile: $PROFILE"
echo ""

add_var() {
  local var_name="$1"
  local prompt_text="$2"

  if grep -q "export ${var_name}=" "$PROFILE" 2>/dev/null; then
    echo "  $var_name already set in $PROFILE — skipping"
    return
  fi

  read -rp "$prompt_text" value
  if [[ -z "$value" ]]; then
    echo "  Skipped $var_name"
    return
  fi

  echo "" >> "$PROFILE"
  echo "# run-adventure" >> "$PROFILE"
  echo "export ${var_name}=\"${value}\"" >> "$PROFILE"
  echo "  Added $var_name to $PROFILE"
}

echo "Enter your API keys (leave blank to skip):"
echo ""
add_var "NEXT_PUBLIC_GOOGLE_MAPS_KEY" "Google Maps key (client-side, for map display): "
add_var "GOOGLE_MAPS_API_KEY"         "Google Maps key (server-side, for Places API): "
add_var "OPENAI_API_KEY"              "OpenAI API key (for quest generation):         "
echo ""
echo "Done. Run 'source $PROFILE' or open a new terminal to apply."
