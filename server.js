require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';

app.use(express.json());

// 优先加载静态网页文件
app.use(express.static(__dirname));

// 首页兜底
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 聊天接口
app.post('/api/chat', async (req, res) => {
    const { messages, mode } = req.body;

    const systemPrompt = mode === 'elegant'
        ? `你是一位精通保定历史文化的古风先生，全程文言回答，只聊保定相关。`
        : `你是保定本地人，亲切聊本地景点美食。`;

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

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while(true) {
            const {done, value} = await reader.read();
            if(done) break;
            const chunk = decoder.decode(value, {stream:true});
            const lines = chunk.split('\n');
            for(let line of lines) {
                if(line.startsWith('data: ')) {
                    let d = line.slice(6);
                    if(d === '[DONE]') continue;
                    res.write(`data: ${d}\n\n`);
                }
            }
        }
        res.end();
    } catch (err) {
        res.status(500).json({error: err.message});
    }
});

module.exports = app;