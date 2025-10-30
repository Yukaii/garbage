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
              description: 'If duplicate, the issue number being duplicated'
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
          required: ['city_name', 'is_supported', 'is_duplicate', 'comment', 'labels'],
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
- "待評估" - 需要進一步評估的請求`;

  const userPrompt = `請分析以下 Issue：

標題：${issue.title}
內容：${issue.body || '(無內容)'}

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
 * Apply triage actions to the issue
 */
async function applyTriageActions(
  issueNumber: number,
  actions: FunctionCallArguments
): Promise<void> {
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

    console.log(`Processing issue #${issueNumber}: ${issueTitle}`);

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
