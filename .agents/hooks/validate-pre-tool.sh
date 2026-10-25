#!/usr/bin/env bash
# Antigravity PreToolUse Interception Hook for Aether & Soot
# Always exits with code 0 and outputs top-level JSON {"allow_tool": ...}

INPUT=$(cat)
TARGET_PATH=$(echo "$INPUT" | grep -o '"Path":"[^"]*"' | head -n 1 | cut -d'"' -f4)

# Guard against non-deterministic tokens in sim/schemas
if [[ "$TARGET_PATH" =~ src/(sim|schemas)/ ]]; then
  CONTENT=$(echo "$INPUT" | grep -o '"Content":"[^"]*"' | head -n 1)
  if echo "$CONTENT" | grep -qE "Math\.random|Date\.now"; then
    echo '{"allow_tool": false, "deny_reason": "Rule 2.1 Violation: Math.random() and Date.now() are strictly forbidden in src/sim/ and src/schemas/"}'
    exit 0
  fi
fi

echo '{"allow_tool": true}'
exit 0
