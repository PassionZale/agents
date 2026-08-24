import { createOpenAI } from '@ai-sdk/openai';
import { MastraModelGateway, type ProviderConfig } from '@mastra/core/llm';

const NEWAPI_MODELS = ['deepseek-v4-pro', 'deepseek-v4-flash', 'glm-5.3', 'MiniMax-M3'];

export class NewApiGateway extends MastraModelGateway {
  readonly id = 'newapi';
  readonly name = 'NewAPI';

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      newapi: {
        name: this.name,
        models: NEWAPI_MODELS,
        apiKeyEnvVar: 'NEWAPI_API_KEY',
        gateway: this.id,
      },
    };
  }

  buildUrl(): string {
    const baseURL = process.env.NEWAPI_BASE_URL;
    if (!baseURL) throw new Error('NEWAPI_BASE_URL not set');
    return baseURL;
  }

  async getApiKey(): Promise<string> {
    const apiKey = process.env.NEWAPI_API_KEY;
    if (!apiKey) throw new Error('NEWAPI_API_KEY not set');
    return apiKey;
  }

  async resolveLanguageModel({
    modelId,
    apiKey,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<ReturnType<ReturnType<typeof createOpenAI>['chat']>> {
    return createOpenAI({
      // AI SDK 的 provider 实例名（用于匹配 providerOptions 的键、标注 telemetry），
      // 与 gateway 的路由 id 是两个概念，这里复用 this.id 只为保持两个标识一致。
      name: this.id,
      apiKey,
      baseURL: this.buildUrl(),
    }).chat(modelId);
  }
}
