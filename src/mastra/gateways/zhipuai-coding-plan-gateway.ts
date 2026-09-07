import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { MastraModelGateway, PROVIDER_REGISTRY, type ProviderConfig } from '@mastra/core/llm';

const PROVIDER_ID = 'zhipuai-coding-plan';

export class ZhipuCodingPlanGateway extends MastraModelGateway {
  readonly id = PROVIDER_ID;
  readonly name = PROVIDER_REGISTRY[PROVIDER_ID].name;

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      [PROVIDER_ID]: {
        ...PROVIDER_REGISTRY[PROVIDER_ID],
        gateway: this.id,
      },
    };
  }

  buildUrl(): string | undefined {
    return PROVIDER_REGISTRY[PROVIDER_ID].url;
  }

  async getApiKey(): Promise<string> {
    const apiKey = process.env.ZHIPU_API_KEY;
    if (!apiKey) throw new Error('ZHIPU_API_KEY not set');
    return apiKey;
  }

  async resolveLanguageModel({
    modelId,
    apiKey,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<ReturnType<ReturnType<typeof createOpenAICompatible>['chatModel']>> {
    const baseURL = this.buildUrl();
    if (!baseURL) throw new Error(`No API URL found for ${PROVIDER_ID}/${modelId}`);
    return createOpenAICompatible({
      name: this.id,
      apiKey,
      baseURL,
      supportsStructuredOutputs: true,
    }).chatModel(modelId);
  }
}
