import OpenAI from 'openai';
import type { Message, ToolCall } from './types';
import { getToolDefinitions, executeTool } from './tools';
import { ChatCompletionMessageFunctionToolCall, ChatCompletionMessageToolCall } from 'openai/resources/index.mjs';
import type { Env } from './core-utils';
import { getSystemPrompt } from './core-utils';
export class ChatHandler {
  private client: OpenAI;
  private model: string;
  private env: Env;
  constructor(aiGatewayUrl: string, apiKey: string, model: string, env: Env) {
    this.client = new OpenAI({
      baseURL: aiGatewayUrl,
      apiKey: apiKey
    });
    this.model = model;
    this.env = env;
  }
  async processMessage(
    message: string,
    conversationHistory: Message[],
    onChunk?: (chunk: string) => void
  ): Promise<{
    content: string;
    toolCalls?: ToolCall[];
    userMessage: Message;
    assistantMessage: Message;
  }> {
    const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: Date.now()
    };
    const messages = await this.buildConversationMessages(userMessage, conversationHistory);
    const toolDefinitions = await getToolDefinitions();
    if (onChunk) {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: toolDefinitions,
        tool_choice: 'auto',
        stream: true,
      });
      const result = await this.handleStreamResponse(stream, messages, onChunk);
      return { ...result, userMessage };
    }
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto',
    });
    const result = await this.handleNonStreamResponse(completion, messages);
    return { ...result, userMessage };
  }
  private async handleStreamResponse(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    onChunk: (chunk: string) => void
  ) {
    let fullContent = '';
    const accumulatedToolCalls: ChatCompletionMessageFunctionToolCall[] = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        fullContent += delta.content;
        onChunk(delta.content);
      }
      if (delta?.tool_calls) {
        for (let i = 0; i < delta.tool_calls.length; i++) {
          const deltaToolCall = delta.tool_calls[i];
          if (!accumulatedToolCalls[i]) {
            accumulatedToolCalls[i] = { id: deltaToolCall.id || `tool_${Date.now()}_${i}`, type: 'function', function: { name: deltaToolCall.function?.name || '', arguments: deltaToolCall.function?.arguments || '' } };
          } else {
            if (deltaToolCall.function?.name) accumulatedToolCalls[i].function.name = deltaToolCall.function.name;
            if (deltaToolCall.function?.arguments) accumulatedToolCalls[i].function.arguments += deltaToolCall.function.arguments;
          }
        }
      }
    }
    const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', content: fullContent, timestamp: Date.now() };
    if (accumulatedToolCalls.length > 0) {
      const executedTools = await this.executeToolCalls(accumulatedToolCalls);
      const finalResponse = await this.generateToolResponse(conversation, accumulatedToolCalls, executedTools);
      assistantMessage.content = finalResponse;
      assistantMessage.toolCalls = executedTools;
      onChunk(finalResponse.substring(fullContent.length)); // Stream the final part
      return { content: finalResponse, toolCalls: executedTools, assistantMessage };
    }
    return { content: fullContent, assistantMessage };
  }
  private async handleNonStreamResponse(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
  ) {
    const responseMessage = completion.choices[0]?.message;
    if (!responseMessage) {
      const content = 'I apologize, but I encountered an issue processing your request.';
      const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant', content, timestamp: Date.now() };
      return { content, assistantMessage };
    }
    const assistantMessage: Message = { id: crypto.randomUUID(), role: 'assistant' as const, content: responseMessage.content || '', timestamp: Date.now() };
    if (!responseMessage.tool_calls) {
      return { content: responseMessage.content || 'I apologize, but I encountered an issue.', assistantMessage };
    }
    const toolCalls = await this.executeToolCalls(responseMessage.tool_calls as ChatCompletionMessageFunctionToolCall[]);
    const finalResponse = await this.generateToolResponse(conversation, responseMessage.tool_calls, toolCalls);
    assistantMessage.content = finalResponse;
    assistantMessage.toolCalls = toolCalls;
    return { content: finalResponse, toolCalls, assistantMessage };
  }
  private async executeToolCalls(openAiToolCalls: ChatCompletionMessageFunctionToolCall[]): Promise<ToolCall[]> {
    return Promise.all(
      openAiToolCalls.map(async (tc) => {
        try {
          const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
          const result = await executeTool(tc.function.name, args, this.env);
          return { id: tc.id, name: tc.function.name, arguments: args, result };
        } catch (error) {
          return { id: tc.id, name: tc.function.name, arguments: {}, result: { error: `Failed to execute ${tc.function.name}: ${error instanceof Error ? error.message : 'Unknown error'}` } };
        }
      })
    );
  }
  private async generateToolResponse(
    history: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    openAiToolCalls: ChatCompletionMessageToolCall[],
    toolResults: ToolCall[]
  ): Promise<string> {
    const followUpCompletion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        ...history,
        { role: 'assistant', content: null, tool_calls: openAiToolCalls },
        ...toolResults.map((result) => ({
          role: 'tool' as const,
          content: JSON.stringify(result.result),
          tool_call_id: result.id
        }))
      ],
    });
    return followUpCompletion.choices[0]?.message?.content || 'Tool results processed successfully.';
  }
  private async buildConversationMessages(userMessage: Message, history: Message[]): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam[]> {
    const systemPrompt = await getSystemPrompt(this.env);
    const validHistory = history
      .slice(-20)
      .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content !== null)
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content! }));
    return [
      { role: 'system', content: systemPrompt },
      ...validHistory,
      { role: 'user', content: userMessage.content! }
    ];
  }
  updateModel(newModel: string): void {
    this.model = newModel;
  }
}