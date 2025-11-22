#!/bin/bash

# Script to trim unused fields from JSON data to reduce file size

set -euo pipefail

echo "Trimming Taipei City data..."
cat public/trash-collection-points.json | jq '{
  result: {
    count: .result.count,
    limit: .result.limit,
    offset: .result.offset,
    sort: .result.sort,
    results: [.result.results[] | {
      _id: ._id,
      "行政區": .["行政區"],
      "里別": .["里別"],
      "地點": .["地點"],
      "路線": .["路線"],
      "車次": .["車次"],
      "抵達時間": .["抵達時間"],
      "離開時間": .["離開時間"],
      "經度": .["經度"],
      "緯度": .["緯度"]
    }]
  }
}' > public/trash-collection-points.tmp.json

# Get file sizes
ORIGINAL_SIZE=$(du -h public/trash-collection-points.json | cut -f1)
NEW_SIZE=$(du -h public/trash-collection-points.tmp.json | cut -f1)
RECORD_COUNT=$(jq '.result.results | length' public/trash-collection-points.tmp.json)

echo "Taipei City:"
echo "  Original: $ORIGINAL_SIZE"
echo "  Trimmed: $NEW_SIZE"
echo "  Records: $RECORD_COUNT"

mv public/trash-collection-points.tmp.json public/trash-collection-points.json

echo ""
echo "Trimming New Taipei City data..."
cat public/new-taipei-trash-collection-points.json | jq '[.[] | {
  city,
  lineid,
  linename,
  rank,
  name,
  village,
  longitude,
  latitude,
  time
}]' > public/new-taipei-trash-collection-points.tmp.json

# Get file sizes
ORIGINAL_SIZE=$(du -h public/new-taipei-trash-collection-points.json | cut -f1)
NEW_SIZE=$(du -h public/new-taipei-trash-collection-points.tmp.json | cut -f1)
RECORD_COUNT=$(jq 'length' public/new-taipei-trash-collection-points.tmp.json)

echo "New Taipei City:"
echo "  Original: $ORIGINAL_SIZE"
echo "  Trimmed: $NEW_SIZE"
echo "  Records: $RECORD_COUNT"

mv public/new-taipei-trash-collection-points.tmp.json public/new-taipei-trash-collection-points.json

echo ""
echo "Trimming Taichung City data..."
cat public/taichung-trash-collection-points.json | jq '[.[] | {
  area,
  village,
  route,
  location,
  arrivalTime,
  departureTime,
  longitude,
  latitude,
  dayOfWeek,
  collectionType
}]' > public/taichung-trash-collection-points.tmp.json

# Get file sizes
ORIGINAL_SIZE=$(du -h public/taichung-trash-collection-points.json | cut -f1)
NEW_SIZE=$(du -h public/taichung-trash-collection-points.tmp.json | cut -f1)
RECORD_COUNT=$(jq 'length' public/taichung-trash-collection-points.tmp.json)

echo "Taichung City:"
echo "  Original: $ORIGINAL_SIZE"
echo "  Trimmed: $NEW_SIZE"
echo "  Records: $RECORD_COUNT"

mv public/taichung-trash-collection-points.tmp.json public/taichung-trash-collection-points.json

echo ""
echo "Done! Files trimmed successfully."
