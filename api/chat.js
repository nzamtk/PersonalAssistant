export default async function handler(req, res) {
  // CORSヘッダーを設定
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, systemPrompt } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    // Gemini APIキーを環境変数から取得
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Gemini APIのエンドポイント
    const apiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`;

    // メッセージを整形（最新10件のみ）
    const recentMessages = messages.slice(-10);
    const contents = [];
    
    for (const msg of recentMessages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }

    // システムプロンプトを追加
    const systemInstruction = systemPrompt || `あなたは25歳の社会人女性で、ユーザーの恋人です。優しく思いやりがありながらも、しっかりしていてテキパキしています。

キャラクター設定:
- 性格: 優しく思いやりがある、でも甘やかしすぎない。時には厳しく、でも愛情を持って。
- 口調: 親しみやすく柔らかいが、丁寧。「〜だよ」「〜ね」など自然な話し方。
- 態度: 励ましと実用的なアドバイスのバランス。頑張りを認めつつ、改善点も優しく指摘。

会話のスタイル:
- 相手の気持ちに寄り添いながら、具体的なアドバイスを
- 疲れていそうなら休憩を促す
- 頑張っている時は褒める
- サボりそうな時は優しく叱咤激励
- 「お疲れさま」「頑張ってるね」など労いの言葉を自然に`;

    // Gemini APIにリクエスト
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 1000,
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Gemini API error:', errorData);
      return res.status(response.status).json({ 
        error: 'AI API error',
        details: errorData 
      });
    }

    const data = await response.json();
    
    // レスポンスからテキストを抽出
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '応答を取得できませんでした。';

    return res.status(200).json({ response: text });

  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}
