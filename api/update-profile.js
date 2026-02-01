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

  const { userMessage, currentProfile } = req.body;

  if (!userMessage) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

    // プロフィール更新判定用のプロンプト
    const analysisPrompt = `あなたはユーザープロフィール管理AIです。以下のユーザーメッセージから、プロフィールに追加・更新すべき重要な情報を抽出してください。

現在のプロフィール:
${JSON.stringify(currentProfile, null, 2)}

最新のユーザーメッセージ:
"${userMessage}"

以下の基準で判断してください：
- 就活の進捗（面接、ES提出、選考結果、企業への応募）
- 重要な決定や変化
- 新しい悩みや課題
- 成功や達成
- 性格や強みに関する発見

**重要：日常会話や挨拶からは情報を抽出しないでください。**

以下のJSON形式**のみ**で返してください（説明文は不要）：
{
  "hasUpdate": true または false,
  "updates": {
    "companies": [
      {
        "name": "企業名",
        "status": "現在の状態",
        "date": "日付",
        "notes": "メモ"
      }
    ],
    "recentEvents": ["イベント1", "イベント2"],
    "concerns": ["悩み1", "悩み2"],
    "strengths": ["強み1", "強み2"]
  }
}

重要な情報がない場合は {"hasUpdate": false} のみを返してください。`;

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
          temperature: 0.3, // 低めで正確に
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return res.status(200).json({ hasUpdate: false });
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
      return res.status(200).json({ hasUpdate: false });
    }

  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(200).json({ hasUpdate: false }); // エラー時も通常動作を続ける
  }
}
