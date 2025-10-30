/**
 * GitHub Action script to automatically triage city request issues
 *
 * Uses GitHub Models (OpenAI API) with function calling to:
 * 1. Extract the requested city from the issue
 * 2. Check if it's already supported or a duplicate
 * 3. Label and comment on the issue appropriately
 */

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  labels: Array<{ name: string }>;
}

interface FunctionCallArguments {
  city_name?: string;
  is_duplicate?: boolean;
  duplicate_issue_number?: number;
  is_supported?: boolean;
  comment?: string;
  labels?: string[];
}

// Currently supported cities
const SUPPORTED_CITIES = [
  '台北市', '臺北市', 'Taipei', 'taipei',
  '新北市', 'New Taipei', 'new-taipei',
  '台中市', '臺中市', 'Taichung', 'taichung',
  '高雄市', 'Kaohsiung', 'kaohsiung'
];

/**
 * Sanitize user input to prevent prompt injection
 */
function sanitizeInput(input: string): string {
  // Remove potential prompt injection patterns
  return input
    // Remove control characters and zero-width characters
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '')
    // Limit length to prevent token exhaustion
    .slice(0, 2000)
    // Trim whitespace
    .trim();
}

/**
 * Call OpenAI API via GitHub Models
 */
async function analyzeIssue(issue: GitHubIssue): Promise<any> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN is required');
  }

  const endpoint = 'https://models.github.ai/inference';

  // Define the function schema for triage actions
  const tools = [
    {
      type: 'function',
      function: {
        name: 'triage_city_request',
        description: 'Analyze a city request issue and determine appropriate labels and actions',
        parameters: {
          type: 'object',
          properties: {
            city_name: {
              type: 'string',
              description: 'The name of the city being requested (in Traditional Chinese if possible)'
            },
            is_supported: {
              type: 'boolean',
              description: 'Whether this city is already supported in the app'
            },
            is_duplicate: {
              type: 'boolean',
              description: 'Whether this request duplicates an existing open issue'
            },
            duplicate_issue_number: {
              type: ['number', 'null'],
              description: 'If duplicate, the issue number being duplicated. Set to null if not a duplicate.'
            },
            comment: {
              type: 'string',
              description: 'A friendly comment in Traditional Chinese to post on the issue'
            },
            labels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Labels to add to the issue (e.g., "enhancement", "duplicate", "已支援")'
            }
          },
          required: ['city_name', 'is_supported', 'is_duplicate', 'duplicate_issue_number', 'comment', 'labels'],
          additionalProperties: false
        },
        strict: true
      }
    }
  ];

  const systemPrompt = `你是一個 GitHub Issue 自動分類助手。你的任務是分析城市垃圾車資料的功能請求。

目前支援的城市：${SUPPORTED_CITIES.join('、')}

請分析 issue 並：
1. 識別用戶請求的城市名稱
2. 檢查該城市是否已經支援
3. 判斷是否為重複的請求
4. 提供友善的繁體中文回覆
5. 建議適當的標籤

標籤選項：
- "enhancement" - 新功能請求
- "duplicate" - 重複的請求
- "已支援" - 該城市已經支援
- "待評估" - 需要進一步評估的請求

重要說明：
- 如果是重複的請求，請在回覆中引用原始 issue 編號（使用 #編號 格式），並請用戶到原始 issue 留言或按讚（👍）來表達支持，這樣我們可以更好地評估需求的優先級。
- 回覆要有禮貌、友善，並感謝用戶的建議。`;

  // Sanitize inputs to prevent prompt injection
  const sanitizedTitle = sanitizeInput(issue.title);
  const sanitizedBody = issue.body ? sanitizeInput(issue.body) : '(無內容)';

  const userPrompt = `請分析以下 Issue：

標題：${sanitizedTitle}
內容：${sanitizedBody}

請使用 triage_city_request 函數來分類這個 issue。`;

  console.log('Calling GitHub Models API...');

  const model = 'openai/gpt-5-mini';

  const response = await fetch(`${endpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      tools,
      tool_choice: { type: 'function', function: { name: 'triage_city_request' } }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub Models API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log('API Response:', JSON.stringify(data, null, 2));

  return data;
}

/**
 * Validate and sanitize triage actions to prevent malicious outputs
 */
function validateTriageActions(actions: FunctionCallArguments): boolean {
  // Validate city_name
  if (!actions.city_name || typeof actions.city_name !== 'string' || actions.city_name.length > 100) {
    console.error('Invalid city_name');
    return false;
  }

  // Validate booleans
  if (typeof actions.is_supported !== 'boolean' || typeof actions.is_duplicate !== 'boolean') {
    console.error('Invalid boolean fields');
    return false;
  }

  // Validate duplicate_issue_number
  if (actions.duplicate_issue_number !== null &&
      (typeof actions.duplicate_issue_number !== 'number' ||
       actions.duplicate_issue_number < 1 ||
       actions.duplicate_issue_number > 999999)) {
    console.error('Invalid duplicate_issue_number');
    return false;
  }

  // Validate comment length and content
  if (!actions.comment || typeof actions.comment !== 'string' ||
      actions.comment.length > 5000 || actions.comment.length < 10) {
    console.error('Invalid comment');
    return false;
  }

  // Validate labels
  if (!Array.isArray(actions.labels) || actions.labels.length > 10) {
    console.error('Invalid labels array');
    return false;
  }

  // Whitelist allowed labels
  const allowedLabels = [
    'enhancement', 'duplicate', '已支援', '待評估', '城市請求',
    'bug', 'documentation', 'question', 'help wanted', 'good first issue'
  ];

  for (const label of actions.labels) {
    if (typeof label !== 'string' ||
        label.length > 50 ||
        !allowedLabels.includes(label)) {
      console.error(`Invalid label: ${label}`);
      return false;
    }
  }

  return true;
}

/**
 * Apply triage actions to the issue
 */
async function applyTriageActions(
  issueNumber: number,
  actions: FunctionCallArguments
): Promise<void> {
  // Validate actions before applying
  if (!validateTriageActions(actions)) {
    throw new Error('Triage actions failed validation');
  }
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;

  if (!token || !repo) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required');
  }

  const [owner, repoName] = repo.split('/');
  const baseUrl = `https://api.github.com/repos/${owner}/${repoName}/issues/${issueNumber}`;

  console.log(`Applying triage actions to issue #${issueNumber}...`);
  console.log('Actions:', JSON.stringify(actions, null, 2));

  // Add comment
  if (actions.comment) {
    console.log('Adding comment...');
    const commentResponse = await fetch(`${baseUrl}/comments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({ body: actions.comment })
    });

    if (!commentResponse.ok) {
      const errorText = await commentResponse.text();
      console.error(`Failed to add comment: ${commentResponse.status} ${errorText}`);
    } else {
      console.log('Comment added successfully');
    }
  }

  // Add labels
  if (actions.labels && actions.labels.length > 0) {
    console.log('Adding labels:', actions.labels);
    const labelsResponse = await fetch(`${baseUrl}/labels`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({ labels: actions.labels })
    });

    if (!labelsResponse.ok) {
      const errorText = await labelsResponse.text();
      console.error(`Failed to add labels: ${labelsResponse.status} ${errorText}`);
    } else {
      console.log('Labels added successfully');
    }
  }

  // Close if duplicate or already supported
  if (actions.is_duplicate || actions.is_supported) {
    console.log('Closing issue...');
    const closeResponse = await fetch(baseUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify({
        state: 'closed',
        state_reason: actions.is_duplicate ? 'not_planned' : 'completed'
      })
    });

    if (!closeResponse.ok) {
      const errorText = await closeResponse.text();
      console.error(`Failed to close issue: ${closeResponse.status} ${errorText}`);
    } else {
      console.log('Issue closed successfully');
    }
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    // Get issue data from environment
    const issueNumber = parseInt(process.env.ISSUE_NUMBER || '0');
    const issueTitle = process.env.ISSUE_TITLE || '';
    const issueBody = process.env.ISSUE_BODY || null;

    if (!issueNumber || !issueTitle) {
      throw new Error('Issue number and title are required');
    }

    console.log(`Processing issue #${issueNumber}`);
    console.log(`Title length: ${issueTitle.length} chars`);
    console.log(`Body length: ${issueBody?.length || 0} chars`);

    const issue: GitHubIssue = {
      number: issueNumber,
      title: issueTitle,
      body: issueBody,
      labels: []
    };

    // Analyze the issue using GitHub Models
    const analysis = await analyzeIssue(issue);

    // Extract function call from response
    const toolCalls = analysis.choices?.[0]?.message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      console.log('No tool calls in response');
      return;
    }

    const functionCall = toolCalls[0];
    if (functionCall.function.name !== 'triage_city_request') {
      console.log('Unexpected function call:', functionCall.function.name);
      return;
    }

    const actions: FunctionCallArguments = JSON.parse(functionCall.function.arguments);
    console.log('Parsed actions:', actions);

    // Apply the triage actions
    await applyTriageActions(issueNumber, actions);

    console.log('Triage completed successfully!');
  } catch (error) {
    console.error('Error during triage:', error);
    process.exit(1);
  }
}

main();
