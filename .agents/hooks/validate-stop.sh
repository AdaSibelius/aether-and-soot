#!/usr/bin/env bash
# Antigravity Stop Gate Hook for Aether & Soot
# Always exits with code 0 and outputs top-level JSON {"allow_tool": ...}

cd /Users/emmett/Desktop/Game || exit 0

OUTPUT=$(npm run typecheck 2>&1)
if [ $? -ne 0 ]; then
  CLEAN_OUT=$(echo "$OUTPUT" | tr '\n' ' ' | sed 's/"/\\"/g' | head -c 200)
  echo "{\"allow_tool\": false, \"deny_reason\": \"Stop Gate Rejected: TypeScript compilation failed: $CLEAN_OUT\"}"
  exit 0
fi

OUTPUT=$(npm run check:boundaries 2>&1)
if [ $? -ne 0 ]; then
  CLEAN_OUT=$(echo "$OUTPUT" | tr '\n' ' ' | sed 's/"/\\"/g' | head -c 200)
  echo "{\"allow_tool\": false, \"deny_reason\": \"Stop Gate Rejected: Architectural boundary check failed: $CLEAN_OUT\"}"
  exit 0
fi

OUTPUT=$(npm run hermes:vision:mock 2>&1)
if [ $? -ne 0 ]; then
  CLEAN_OUT=$(echo "$OUTPUT" | tr '\n' ' ' | sed 's/"/\\"/g' | head -c 200)
  echo "{\"allow_tool\": false, \"deny_reason\": \"Stop Gate Rejected: UI layout & vision audit failed: $CLEAN_OUT\"}"
  exit 0
fi

echo '{"allow_tool": true}'
exit 0
