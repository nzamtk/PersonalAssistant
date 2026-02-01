export default async function handler(req, res) {
  // CORSヘッダー
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userMessage, currentTasks } = req.body;

  if (!userMessage) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

    // 現在の日付を取得
    const currentDate = new Date();
    const currentDateStr = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const currentYear = currentDate.getFullYear();

    // タスク抽出用のプロンプト
    const analysisPrompt = `あなたはタスク管理AIです。以下のユーザーメッセージから、やるべきタスクを抽出してください。

**重要：現在の日付は ${currentDateStr} です。年は ${currentYear} 年です。**

現在のタスク:
${JSON.stringify(currentTasks, null, 2)}

最新のユーザーメッセージ:
"${userMessage}"

以下の基準で判断してください：
- 明確な行動（「〜する」「〜を提出」「〜に行く」など）
- 期限がある、または期限が推測できるもの
- 具体的なタスク（曖昧な意図は除外）
- ES提出、面接、レポート提出、勉強、準備など

**期限の判断：**
- 「金曜日」「来週火曜日」などの相対的な日付は、現在の日付 (${currentDateStr}) から計算してください
- 年が指定されていない場合は ${currentYear} 年として扱ってください
- 過去の日付にならないように注意してください

**重要：既に同じタスクが存在する場合は追加しないでください。**
**重要：日常会話や挨拶からはタスクを抽出しないでください。**

以下のJSON形式**のみ**で返してください（説明文は不要）：
{
  "hasTasks": true または false,
  "tasks": [
    {
      "title": "タスクの内容",
      "dueDate": "期限（YYYY-MM-DD形式、不明な場合はnull）",
      "priority": "high" または "medium" または "low",
      "projectId": null
    }
  ]
}

タスクがない場合は {"hasTasks": false} のみを返してください。`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: analysisPrompt }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return res.status(200).json({ hasTasks: false });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSONを抽出（マークダウンのコードブロックを除去）
    let cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      const result = JSON.parse(cleanText);
      return res.status(200).json(result);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Raw text:', text);
      return res.status(200).json({ hasTasks: false });
    }

  } catch (error) {
    console.error('Task extraction error:', error);
    return res.status(200).json({ hasTasks: false });
  }
}
