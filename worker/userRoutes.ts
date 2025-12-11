import { Hono } from "hono";
import { API_RESPONSES } from './config';
import { Env, getSystemPrompt, setSystemPrompt, mockMessages, mockSessions } from "./core-utils";
import { ChatHandler } from './chat';
import type { Message, SessionInfo } from './types';
import { createEncoder, createStreamResponse } from './utils';
async function saveMessagesToChatlog(messages: Message[], sessionId: string, env: Env) {
    if (!env.DB) {
        const sessionMsgs = (mockMessages.get(sessionId) || []).concat(messages);
        if (sessionMsgs.length > 20) {
            mockMessages.set(sessionId, sessionMsgs.slice(sessionMsgs.length - 20));
        } else {
            mockMessages.set(sessionId, sessionMsgs);
        }
        return;
    }
    const stmts = messages.map(msg => env.DB.prepare(
        `INSERT INTO chatlog (id, session_id, role, content, timestamp, tool_calls, tool_call_id) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
        msg.id,
        sessionId,
        msg.role,
        msg.content,
        msg.timestamp,
        msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
        msg.tool_call_id || null
    ));
    await env.DB.batch(stmts);
    // Prune old messages, keeping the last 20
    await env.DB.prepare(`
        DELETE FROM chatlog WHERE id IN (
            SELECT id FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp DESC) as rn
                FROM chatlog WHERE session_id = ?
            ) WHERE rn > 20
        )
    `).bind(sessionId).run();
}
async function getLast20Messages(sessionId: string, env: Env): Promise<Message[]> {
    if (!env.DB) {
        return mockMessages.get(sessionId) || [];
    }
    const { results } = await env.DB.prepare(
        'SELECT * FROM chatlog WHERE session_id = ? ORDER BY timestamp DESC LIMIT 20'
    ).bind(sessionId).all<Message>();
    return results.reverse();
}
export function coreRoutes(app: Hono<{ Bindings: Env }>) {
    app.get('/api/chat/:sessionId/messages', async (c) => {
        const sessionId = c.req.param('sessionId');
        const messages = await getLast20Messages(sessionId, c.env);
        const model = 'google-ai-studio/gemini-2.5-flash'; // You might want to store this per session
        return c.json({ success: true, data: { messages, sessionId, model } });
    });
    app.post('/api/chat/:sessionId/chat', async (c) => {
        const sessionId = c.req.param('sessionId');
        const body = await c.req.json();
        const { message, model, stream } = body;
        if (!message?.trim()) {
            return c.json({ success: false, error: API_RESPONSES.MISSING_MESSAGE }, { status: 400 });
        }
        const history = await getLast20Messages(sessionId, c.env);
        const handler = new ChatHandler(c.env.CF_AI_BASE_URL, c.env.CF_AI_API_KEY, model, c.env);
        if (stream) {
            const { readable, writable } = new TransformStream();
            const writer = writable.getWriter();
            const encoder = createEncoder();
            (async () => {
                try {
                    const { userMessage, assistantMessage } = await handler.processMessage(message, history, (chunk) => {
                        writer.write(encoder.encode(chunk));
                    });
                    await saveMessagesToChatlog([userMessage, assistantMessage], sessionId, c.env);
                } catch (error) {
                    console.error('Streaming error:', error);
                    const errorMessage = 'Sorry, I encountered an error.';
                    writer.write(encoder.encode(errorMessage));
                } finally {
                    writer.close();
                }
            })();
            return createStreamResponse(readable);
        }
        const { userMessage, assistantMessage } = await handler.processMessage(message, history);
        await saveMessagesToChatlog([userMessage, assistantMessage], sessionId, c.env);
        return c.json({ success: true, data: { messages: [...history, userMessage, assistantMessage], sessionId, model } });
    });
}
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    // Session Management
    app.get('/api/sessions', async (c) => {
        if (!c.env.DB) {
            const sessions = Array.from(mockSessions.values()).sort((a, b) => b.lastActive - a.lastActive);
            return c.json({ success: true, data: sessions });
        }
        const { results } = await c.env.DB.prepare('SELECT * FROM sessions ORDER BY lastActive DESC').all<SessionInfo>();
        return c.json({ success: true, data: results });
    });
    app.post('/api/sessions', async (c) => {
        const { title, sessionId: providedSessionId, firstMessage } = await c.req.json();
        const sessionId = providedSessionId || crypto.randomUUID();
        const now = Date.now();
        const sessionTitle = title || (firstMessage ? (firstMessage.trim().substring(0, 40) + '...') : `Trò chuyện lúc ${new Date(now).toLocaleTimeString()}`);
        const session: SessionInfo = { id: sessionId, title: sessionTitle, createdAt: now, lastActive: now };
        if (!c.env.DB) {
            mockSessions.set(sessionId, session);
        } else {
            await c.env.DB.prepare('INSERT INTO sessions (id, title, createdAt, lastActive) VALUES (?, ?, ?, ?)')
                .bind(session.id, session.title, session.createdAt, session.lastActive).run();
        }
        return c.json({ success: true, data: { sessionId, title: sessionTitle } });
    });
    app.delete('/api/sessions/all', async (c) => {
        if (!c.env.DB) {
            mockSessions.clear();
            mockMessages.clear();
        } else {
            await c.env.DB.batch([
                c.env.DB.prepare('DELETE FROM sessions'),
                c.env.DB.prepare('DELETE FROM chatlog'),
            ]);
        }
        return c.json({ success: true });
    });
    app.delete('/api/sessions/:sessionId', async (c) => {
        const sessionId = c.req.param('sessionId');
        if (!c.env.DB) {
            mockSessions.delete(sessionId);
            mockMessages.delete(sessionId);
        } else {
            await c.env.DB.batch([
                c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId),
                c.env.DB.prepare('DELETE FROM chatlog WHERE session_id = ?').bind(sessionId),
            ]);
        }
        return c.json({ success: true, data: { deleted: true } });
    });
    // Admin: Products (D1)
    app.get('/api/admin/products', async (c) => {
        if (!c.env.DB) return c.json({ success: false, error: 'Database not configured' }, 500);
        const { results } = await c.env.DB.prepare('SELECT * FROM products_info ORDER BY name').all();
        return c.json({ success: true, data: results });
    });
    app.post('/api/admin/products', async (c) => {
        if (!c.env.DB) return c.json({ success: false, error: 'Database not configured' }, 500);
        const product = await c.req.json();
        const id = product.id || crypto.randomUUID();
        await c.env.DB.prepare(
            'INSERT INTO products_info (id, name, description, price, stock_quantity, category, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(id, product.name, product.description, product.price, product.stock_quantity, product.category, JSON.stringify(product.metadata || {})).run();
        return c.json({ success: true, data: { ...product, id } });
    });
    app.put('/api/admin/products/:id', async (c) => {
        if (!c.env.DB) return c.json({ success: false, error: 'Database not configured' }, 500);
        const id = c.req.param('id');
        const product = await c.req.json();
        await c.env.DB.prepare(
            'UPDATE products_info SET name=?, description=?, price=?, stock_quantity=?, category=?, metadata=? WHERE id=?'
        ).bind(product.name, product.description, product.price, product.stock_quantity, product.category, JSON.stringify(product.metadata || {}), id).run();
        return c.json({ success: true, data: product });
    });
    app.delete('/api/admin/products/:id', async (c) => {
        if (!c.env.DB) return c.json({ success: false, error: 'Database not configured' }, 500);
        const id = c.req.param('id');
        await c.env.DB.prepare('DELETE FROM products_info WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    });
    // Admin: Documents (R2)
    app.get('/api/admin/documents', async (c) => {
        if (!c.env.R2_DOCS) return c.json({ success: false, error: 'R2 Storage not configured' }, 500);
        const listed = await c.env.R2_DOCS.list();
        const documents = listed.objects.map(obj => ({
            name: obj.key,
            size: obj.size,
            uploaded: obj.uploaded.toISOString(),
        }));
        return c.json({ success: true, data: documents });
    });
    app.post('/api/admin/documents', async (c) => {
        if (!c.env.R2_DOCS) return c.json({ success: false, error: 'R2 Storage not configured' }, 500);
        const formData = await c.req.formData();
        const file = formData.get('file') as File;
        if (!file) return c.json({ success: false, error: 'File not provided' }, 400);
        await c.env.R2_DOCS.put(file.name, file.stream(), {
            httpMetadata: { contentType: file.type },
        });
        return c.json({ success: true, data: { name: file.name, size: file.size } });
    });
    app.delete('/api/admin/documents/:key', async (c) => {
        if (!c.env.R2_DOCS) return c.json({ success: false, error: 'R2 Storage not configured' }, 500);
        const key = decodeURIComponent(c.req.param('key'));
        await c.env.R2_DOCS.delete(key);
        return c.json({ success: true });
    });
    // Admin: System Prompt
    app.get('/api/admin/system-prompt', async (c) => {
        const prompt = await getSystemPrompt(c.env);
        return c.json({ success: true, data: { prompt } });
    });
    app.post('/api/admin/system-prompt', async (c) => {
        const { prompt } = await c.req.json();
        if (typeof prompt !== 'string') return c.json({ success: false, error: 'Prompt is required' }, 400);
        await setSystemPrompt(prompt, c.env);
        return c.json({ success: true });
    });
    // Messenger Webhook
    app.get('/api/messenger/webhook', async (c) => {
        const url = new URL(c.req.url);
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');
        if (mode === 'subscribe' && token === c.env.FB_VERIFY_TOKEN) {
            console.log('Webhook verified!');
            return new Response(challenge, { status: 200 });
        }
        console.warn('Webhook verification failed.');
        return c.text('Forbidden', 403);
    });
    app.post('/api/messenger/webhook', async (c) => {
        const body: any = await c.req.json();
        if (body.object !== 'page') return c.text('OK', 200);
        for (const entry of body.entry) {
            for (const event of entry.messaging) {
                if (event.message && event.sender) {
                    const senderId = event.sender.id;
                    const messageText = event.message.text;
                    const sessionId = `fb-${senderId}`;
                    const chatBody = {
                        message: messageText,
                        model: 'google-ai-studio/gemini-2.5-flash',
                        stream: true
                    };
                    const agentUrl = new URL(c.req.url);
                    agentUrl.pathname = `/api/chat/${sessionId}/chat`;
                    const agentRes = await fetch(agentUrl.toString(), {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(chatBody)
                    });
                    let streamText = await agentRes.text().then(text => text.trim()).catch(() => '');
                    if (streamText.length === 0) {
                        streamText = 'Xin lỗi, không thể xử lý tin nhắn lúc này.';
                    }
                    const reply = {
                        recipient: { id: senderId },
                        message: { text: streamText }
                    };
                    await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${c.env.FB_PAGE_TOKEN}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(reply)
                    });
                }
            }
        }
        return c.text('OK', 200);
    });
}