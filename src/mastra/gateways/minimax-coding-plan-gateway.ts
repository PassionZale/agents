import { createAnthropic } from '@ai-sdk/anthropic';
import { MastraModelGateway, PROVIDER_REGISTRY, type ProviderConfig } from '@mastra/core/llm';

const PROVIDER_ID = 'minimax-cn-coding-plan';

export class MiniMaxCodingPlanGateway extends MastraModelGateway {
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
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) throw new Error('MINIMAX_API_KEY not set');
    return apiKey;
  }

  async resolveLanguageModel({
    modelId,
    apiKey,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<ReturnType<ReturnType<typeof createAnthropic>>> {
    const baseURL = this.buildUrl();
    if (!baseURL) throw new Error(`No API URL found for ${PROVIDER_ID}/${modelId}`);
    return createAnthropic({
      apiKey,
      baseURL,
      // registry 标注该端点用 Authorization 鉴权,而 createAnthropic 默认发 x-api-key;
      // 两个头都带,兼容端点的任一校验方式。
      headers: { Authorization: `Bearer ${apiKey}` },
    })(modelId);
  }
}
