#!/bin/bash

# Script to create necessary labels for issue triage
# Run this once to set up the labels in your repository

REPO="${GITHUB_REPOSITORY:-yukaii/garbage}"
TOKEN="${GITHUB_TOKEN}"

if [ -z "$TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable is required"
  echo "Usage: GITHUB_TOKEN=your_token ./scripts/setup-labels.sh"
  exit 1
fi

BASE_URL="https://api.github.com/repos/${REPO}/labels"

# Function to create or update a label
create_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  echo "Creating label: $name"

  curl -X POST "$BASE_URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -H "Accept: application/vnd.github.v3+json" \
    -d "{
      \"name\": \"$name\",
      \"color\": \"$color\",
      \"description\": \"$description\"
    }" \
    2>&1 | grep -q "already_exists" && echo "  Label already exists, updating..." && \
    curl -X PATCH "$BASE_URL/$name" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -H "Accept: application/vnd.github.v3+json" \
      -d "{
        \"color\": \"$color\",
        \"description\": \"$description\"
      }"

  echo ""
}

echo "Setting up labels for $REPO..."
echo ""

# Create labels
create_label "已支援" "0E8A16" "This city is already supported in the app"
create_label "待評估" "FBCA04" "City request needs evaluation"
create_label "城市請求" "1D76DB" "Request to add a new city"

echo "Label setup complete!"
