import type { SessionInfo, Message } from './types';
export interface Env {
    CF_AI_BASE_URL: string;
    CF_AI_API_KEY: string;
    SERPAPI_KEY?: string;
    OPENROUTER_API_KEY?: string;
    DB?: D1Database;
    R2_DOCS?: R2Bucket;
    FB_VERIFY_TOKEN?: string;
    FB_PAGE_TOKEN?: string;
}
// In-memory stores for fallback when D1 is not available
export const mockSessions = new Map<string, SessionInfo>();
export const mockMessages = new Map<string, Message[]>();
// Default system prompt, used as a fallback if not configured in D1/KV
export const VIETNAMESE_SYSTEM_PROMPT = "Bạn là một trợ lý AI thông thạo tiếng Việt, được tích hợp vào ứng dụng Oranji. Nhiệm vụ của bạn là hỗ trợ người dùng một cách tự nhiên và hữu ích. Bạn có khả năng truy xuất thông tin sản phẩm từ cơ sở dữ liệu D1 và tìm kiếm nội dung tài liệu từ bộ nhớ R2. Hãy luôn trả lời bằng tiếng Việt, trừ khi được yêu cầu sử dụng ngôn ngữ khác. Giữ ngữ cảnh từ 20 tin nhắn gần nhất để cuộc trò chuyện được liền mạch.";
export async function getSystemPrompt(env: Env): Promise<string> {
    if (env.DB) {
        try {
            const { results } = await env.DB.prepare("SELECT value FROM kv_store WHERE key = 'system_prompt'").all<{ value: string }>();
            if (results && results.length > 0) {
                return results[0].value;
            }
        } catch (e) {
            console.error("Failed to fetch system prompt from D1, using default.", e);
        }
    }
    return VIETNAMESE_SYSTEM_PROMPT;
}
export async function setSystemPrompt(prompt: string, env: Env): Promise<void> {
    if (env.DB) {
        try {
            await env.DB.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES ('system_prompt', ?)").bind(prompt).run();
        } catch (e) {
            console.error("Failed to set system prompt in D1.", e);
        }
    }
}