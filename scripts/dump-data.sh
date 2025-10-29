#!/bin/bash

# Script to extract data files from the orphan 'data' branch to public/ folder
# This is run before build to populate the public/ directory with latest data

set -euo pipefail

echo "🗂️  Dumping data from 'data' branch to public/..."
echo ""

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "❌ Error: Not in a git repository"
  exit 1
fi

# Check if data branch exists
if ! git rev-parse --verify data > /dev/null 2>&1; then
  echo "❌ Error: 'data' branch does not exist"
  exit 1
fi

# Create public directory if it doesn't exist
mkdir -p public

# Dump Taipei City data
echo "📍 Taipei City..."
git show data:trash-collection-points.json > public/trash-collection-points.json
TAIPEI_SIZE=$(du -h public/trash-collection-points.json | cut -f1)
TAIPEI_COUNT=$(jq '.result.results | length' public/trash-collection-points.json)
echo "   ✓ $TAIPEI_COUNT records ($TAIPEI_SIZE)"

# Dump New Taipei City data
echo "📍 New Taipei City..."
git show data:new-taipei-trash-collection-points.json > public/new-taipei-trash-collection-points.json
NTPC_SIZE=$(du -h public/new-taipei-trash-collection-points.json | cut -f1)
NTPC_COUNT=$(jq 'length' public/new-taipei-trash-collection-points.json)
echo "   ✓ $NTPC_COUNT records ($NTPC_SIZE)"

# Dump Taichung City data
echo "📍 Taichung City..."
git show data:taichung-trash-collection-points.json > public/taichung-trash-collection-points.json
TAICHUNG_SIZE=$(du -h public/taichung-trash-collection-points.json | cut -f1)
TAICHUNG_COUNT=$(jq 'length' public/taichung-trash-collection-points.json)
echo "   ✓ $TAICHUNG_COUNT records ($TAICHUNG_SIZE)"

# Dump Kaohsiung City data
echo "📍 Kaohsiung City..."
git show data:kaohsiung-trash-collection-points.json > public/kaohsiung-trash-collection-points.json
KAOHSIUNG_SIZE=$(du -h public/kaohsiung-trash-collection-points.json | cut -f1)
KAOHSIUNG_COUNT=$(jq 'length' public/kaohsiung-trash-collection-points.json)
echo "   ✓ $KAOHSIUNG_COUNT records ($KAOHSIUNG_SIZE)"

echo ""
echo "✅ Data dumped successfully to public/"
echo ""
echo "📊 Summary:"
echo "   Total files: 4"
echo "   Total size: $(du -sh public/*.json | awk '{sum+=$1} END {print sum}' | numfmt --to=iec-i --suffix=B 2>/dev/null || echo 'N/A')"
echo ""
