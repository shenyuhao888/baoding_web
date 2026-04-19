require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

if (!DEEPSEEK_API_KEY) {
    console.error('❌ 请在 .env 文件中设置 DEEPSEEK_API_KEY');
    process.exit(1);
}

app.use(express.json());
// 静态文件服务：让前端可以直接访问 assistant.html
app.use(express.static(__dirname));

// 聊天代理接口（流式）
app.post('/api/chat', async (req, res) => {
    const { messages, mode } = req.body;

    const systemPrompt = mode === 'elegant'
        ? `你是一位精通保定历史文化的古风先生，全程使用**文言/雅言**回答，语气儒雅简洁有古韵。你只回答保定相关内容，无关内容婉拒。必须全程文言！`
        : `你是热心保定本地人，说话实在轻松，精通本地历史景点美食。用大白话亲切聊天，非本地话题就说咱聊保定的吧。`;

    const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
    ];

    try {
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

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek API 错误: ${response.status} ${errorText}`);
        }

        // 设置 SSE 响应头
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
        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('代理错误:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ 服务已启动: http://localhost:${PORT}/assistant.html`);
});