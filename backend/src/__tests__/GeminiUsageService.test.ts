import { describe, it, expect } from 'vitest';
import { extractUsageMetadata } from '../services/GeminiUsageService';

describe('GeminiUsageService.extractUsageMetadata', () => {
  it('extrai usage de resposta SDK completa', () => {
    const data = extractUsageMetadata({
      response: {
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 40,
          totalTokenCount: 140,
          cachedContentTokenCount: 10,
          thoughtsTokenCount: 5,
          toolUsePromptTokenCount: 3,
        },
      },
    });
    expect(data.inputTokens).toBe(100);
    expect(data.outputTokens).toBe(40);
    expect(data.totalTokens).toBe(140);
    expect(data.cachedTokens).toBe(10);
    expect(data.thinkingTokens).toBe(5);
    expect(data.toolUsePromptTokens).toBe(3);
    expect(data.usageMissing).toBe(false);
  });

  it('extrai usage de payload REST parseado', () => {
    const data = extractUsageMetadata({
      usageMetadata: {
        promptTokenCount: 50,
        candidatesTokenCount: 25,
        totalTokenCount: 75,
      },
    });
    expect(data.inputTokens).toBe(50);
    expect(data.outputTokens).toBe(25);
    expect(data.totalTokens).toBe(75);
  });

  it('sem usage retorna zeros e usageMissing=true', () => {
    const data = extractUsageMetadata({ response: { candidates: [] } });
    expect(data.inputTokens).toBe(0);
    expect(data.outputTokens).toBe(0);
    expect(data.totalTokens).toBe(0);
    expect(data.usageMissing).toBe(true);
  });

  it('promptTokensDetails preenche modalidades', () => {
    const data = extractUsageMetadata({
      usageMetadata: {
        promptTokenCount: 100,
        totalTokenCount: 100,
        promptTokensDetails: [
          { modality: 'TEXT', tokenCount: 20 },
          { modality: 'AUDIO', tokenCount: 10 },
          { modality: 'IMAGE', tokenCount: 5 },
          { modality: 'VIDEO', tokenCount: 7 },
          { modality: 'DOCUMENT', tokenCount: 8 },
          { modality: 'EMBEDDING', tokenCount: 9 },
        ],
      },
    });
    expect(data.inputTextTokens).toBe(20);
    expect(data.inputAudioTokens).toBe(10);
    expect(data.inputImageTokens).toBe(5);
    expect(data.inputVideoTokens).toBe(7);
    expect(data.inputDocumentTokens).toBe(8);
    expect(data.inputEmbeddingTokens).toBe(9);
  });
});
