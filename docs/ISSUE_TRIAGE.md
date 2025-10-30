# Automated Issue Triage System

This document describes the automated issue triage system that uses GitHub Models (OpenAI API) to automatically process city request issues.

## Overview

When a user reports a city request through the feedback button or manually creates an issue, a GitHub Action automatically:

1. **Analyzes the issue** using GPT-4o via GitHub Models
2. **Extracts the city name** from the issue title and body
3. **Checks if the city is already supported** (Taipei, New Taipei, Taichung, Kaohsiung)
4. **Detects duplicate requests** by comparing with existing open issues
5. **Adds appropriate labels** to categorize the issue
6. **Posts a friendly comment** in Traditional Chinese
7. **Closes the issue** if it's a duplicate or already supported

## How It Works

### Workflow Trigger

The GitHub Action (`.github/workflows/triage-city-request.yml`) triggers when:
- An issue is **opened** or **reopened**
- The issue title contains keywords: "請求支援新城市", "支援", or "城市"

### Function Calling

The triage script (`scripts/triage-city-request.ts`) uses OpenAI's function calling feature to:

```typescript
{
  type: 'function',
  name: 'triage_city_request',
  parameters: {
    city_name: string,           // Requested city name
    is_supported: boolean,       // Already supported?
    is_duplicate: boolean,       // Duplicate request?
    duplicate_issue_number: number | null,
    comment: string,             // Friendly response in Chinese
    labels: string[]             // Labels to apply
  }
}
```

### Available Labels

- **已支援** (green) - City is already supported
- **待評估** (yellow) - Request needs evaluation
- **城市請求** (blue) - City request
- **duplicate** (gray) - Duplicate issue
- **enhancement** - Feature request

## Setup Instructions

### 1. Create Labels

Run the label setup script once:

```bash
GITHUB_TOKEN=your_token ./scripts/setup-labels.sh
```

Or create them manually in your repository settings.

### 2. Enable GitHub Models

GitHub Models is available in public preview. The workflow uses the built-in `GITHUB_TOKEN` with `models: read` permission to access the API.

No additional API keys or configuration needed!

### 3. Deploy the Workflow

The workflow is automatically active once merged to the main branch. It will:
- Use `GITHUB_TOKEN` for authentication (automatically available)
- Call the GitHub Models API at `https://models.github.ai/inference`
- Use the `gpt-4o` model for analysis

## Testing

### Manual Test

Create a test issue with the title:
```
請求支援新城市
```

And body:
```
希望支援的城市：桃園市
```

The workflow should:
1. Detect it's a city request
2. Extract "桃園市" as the city name
3. Determine it's not yet supported
4. Add labels: "城市請求", "待評估", "enhancement"
5. Post a friendly comment in Traditional Chinese

### Expected Behaviors

| Scenario | Expected Action |
|----------|----------------|
| Request for Taipei | Close with "已支援" label and comment explaining it's already supported |
| Request for unsupported city | Add "城市請求" and "待評估" labels, post acknowledgment comment |
| Duplicate request | Close with "duplicate" label and reference to original issue |
| Unclear request | Add "待評估" label and ask for clarification |

## Code Structure

```
scripts/
├── triage-city-request.ts     # Main triage logic with function calling
└── setup-labels.sh            # Label setup utility

.github/workflows/
└── triage-city-request.yml    # GitHub Action workflow definition
```

## Rate Limits

GitHub Models API has rate limits during public preview:
- Monitor your usage in the Actions logs
- Consider adding retry logic for production use
- The current implementation processes one issue per trigger

## Future Enhancements

Possible improvements:
- [ ] Search all open issues to detect duplicates more accurately
- [ ] Support batch processing of multiple issues
- [ ] Add data quality validation (check if city has open data API)
- [ ] Prioritize cities by population or number of requests
- [ ] Auto-assign issues to maintainers based on expertise
- [ ] Generate monthly summary reports of city requests

## Troubleshooting

### Issue: Workflow doesn't trigger

**Check:**
- Issue title contains trigger keywords
- Workflow file is in `main` branch
- Actions are enabled in repository settings

### Issue: API returns 401 Unauthorized

**Check:**
- `models: read` permission is set in workflow
- `GITHUB_TOKEN` has sufficient permissions
- GitHub Models is available in your region (currently US only)

### Issue: Function calling returns unexpected results

**Check:**
- Model response in Action logs
- Adjust system prompt in `triage-city-request.ts`
- Try different models (e.g., `gpt-4o-mini` for faster processing)

## Monitoring

View triage results in:
1. **Actions tab** - See workflow execution logs
2. **Issues tab** - Check applied labels and comments
3. **Insights** - Track automation success rate

## Related Documentation

- [GitHub Models Documentation](https://docs.github.com/en/github-models)
- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
