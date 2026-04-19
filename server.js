require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

// 1. 先开静态资源，优先读本地html文件
app.use(express.static(path.join(__dirname)));

// 2. 解析json
app.use(express.json());

// 3. 首页兜底，强制返回index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 4. 你的AI聊天后端接口
app.post('/api/chat', async (req, res) => {
    const { messages, mode } = req.body;

    const systemPrompt = mode === 'elegant'
        ? `你是一位精通保定历史文化的古风先生，全程使用文言雅言回答，语气儒雅，只解答保定相关风物、古迹、历史问题。`
        : `你是保定本地向导，说话接地气，亲切介绍保定景点、美食、历史故事。`;

    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
    ];

    try {
        if (!DEEPSEEK_API_KEY) {
            return res.status(500).json({error: "缺少环境变量DEEPSEEK_API_KEY"});
        }

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: apiMessages,
                stream: true,
                temperature: 0.7
            })
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    res.write(`data: ${data}\n\n`);
                }
            }
        }
        res.end();

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// 本地启动用，Vercel会自动接管
app.listen(port, () => {
  console.log(`本地运行在 http://localhost:${port}`);
});

module.exports = app;