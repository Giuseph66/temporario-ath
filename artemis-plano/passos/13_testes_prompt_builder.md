# Passo 13 — Testes do PromptBuilder

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. O arquivo `src/services/PromptBuilder.ts` monta dinamicamente o prompt XML que é enviado ao Gemini a cada interação. Cada estado FSM gera um prompt diferente com blocos específicos. Se o prompt incluir blocos errados (ex: mostrar preços no estado GREETING), a IA vai se comportar incorretamente.

**Este passo deve ser executado depois do Passo 10** (configuração do Vitest).

## O que Fazer

**1. Leia os arquivos necessários**
Abra e leia completamente:
- `src/services/PromptBuilder.ts`
- `config/persona.json`
- `config/programs.json`
- `config/settings.json`

Entenda quais blocos são adicionados em cada estado e quais são explicitamente excluídos.

**2. Crie o arquivo de teste**
Crie `src/__tests__/PromptBuilder.test.ts`.

**3. Mock do ConfigLoader**
O `PromptBuilder` provavelmente usa o `ConfigLoader`. Em vez de mockar, você pode instanciar o `PromptBuilder` com os JSONs reais de configuração, já que eles são dados estáticos:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Opção 1: Importar os JSONs reais
import persona from '../../config/persona.json';
import programs from '../../config/programs.json';
import settings from '../../config/settings.json';

// Opção 2: Mock do ConfigLoader se necessário
vi.mock('../services/ConfigLoader', () => ({
  ConfigLoader: {
    getInstance: () => ({
      getPersona: () => persona,
      getPrograms: () => programs.programs,
      getSettings: () => settings.settings,
    }),
  },
}));
```

Escolha a abordagem que melhor se encaixa com como o `PromptBuilder` real importa suas dependências.

**4. Escreva os testes por estado**

```typescript
describe('PromptBuilder', () => {

  describe('Estado GREETING', () => {
    it('deve conter instrução de consentimento LGPD', () => {
      const prompt = buildPrompt('GREETING', userProfile, history); // adapte a assinatura real
      expect(prompt).toContain('LGPD'); // ou a string exata do bloco de consentimento
    });

    it('NÃO deve conter preços ou valores monetários', () => {
      const prompt = buildPrompt('GREETING', userProfile, history);
      expect(prompt).not.toContain('R$');
    });

    it('NÃO deve conter link de formulário de matrícula', () => {
      const prompt = buildPrompt('GREETING', userProfile, history);
      expect(prompt).not.toContain('respondi.app');
    });
  });

  describe('Estado QUALIFICATION', () => {
    it('deve conter instrução de coleta de nome', () => {
      const prompt = buildPrompt('QUALIFICATION', userProfile, history);
      expect(prompt.toLowerCase()).toContain('nome');
    });

    it('deve conter instrução de coleta de idade', () => {
      const prompt = buildPrompt('QUALIFICATION', userProfile, history);
      expect(prompt.toLowerCase()).toContain('idade');
    });
  });

  describe('Estado PROGRAM_PRESENTATION', () => {
    it('deve conter o texto completo (verbatim) do programa selecionado', () => {
      const userComPrograma = { ...userProfile, currentProgramId: 'ingles_personalizado' };
      const prompt = buildPrompt('PROGRAM_PRESENTATION', userComPrograma, history);
      expect(prompt).toContain('Inglês Personalizado 2026');
    });
  });

  describe('Estado CLOSING', () => {
    it('deve conter instrução de coleta de CPF', () => {
      const prompt = buildPrompt('CLOSING', userProfile, history);
      expect(prompt.toLowerCase()).toContain('cpf');
    });

    it('deve conter o link do formulário Respondi', () => {
      const prompt = buildPrompt('CLOSING', userProfile, history);
      expect(prompt).toContain('respondi.app');
    });
  });

});
```

**Adapte os parâmetros das chamadas** de acordo com a assinatura real da função/método no `PromptBuilder.ts`.

## Verificação
```bash
npm test
```
Todos os testes devem passar. Se algum falhar porque um bloco esperado não está no prompt, verifique se o `PromptBuilder` realmente inclui aquele bloco para aquele estado.
