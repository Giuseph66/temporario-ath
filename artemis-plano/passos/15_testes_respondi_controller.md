# Passo 15 — Testes do RespondiController

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. O `src/controllers/RespondiController.ts` recebe webhooks da plataforma Respondi (formulários de matrícula). Quando um aluno preenche o formulário, os dados chegam aqui e são inseridos ou atualizados no banco. Se a lógica de upsert estiver errada, dados de alunos podem ser duplicados ou perdidos.

**Este passo deve ser executado depois do Passo 10** (configuração do Vitest).

## O que Fazer

**1. Leia os arquivos necessários**
Abra e leia completamente:
- `src/controllers/RespondiController.ts`
- `src/utils/phoneNormalizer.ts`

Entenda: como o token é validado, como o telefone é extraído e normalizado, como o upsert funciona, quais campos são esperados.

**2. Instale o supertest para simular requisições HTTP**
```bash
npm install --save-dev supertest @types/supertest
```

**3. Crie o arquivo de teste**
Crie `src/__tests__/RespondiController.test.ts`.

**4. Configure os mocks necessários**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../index'; // ajuste o export se necessário

vi.mock('../utils/prisma', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));
```

**Observação:** Se o `app` não é exportado em `src/index.ts`, você precisará exportá-lo. Adicione `export { app }` antes do `app.listen(...)`.

**5. Escreva os testes**

```typescript
// Payload de exemplo baseado no formato real do Respondi
const payloadValido = {
  respondent: {
    answers: {
      'WhatsApp': { country: '55', phone: '66999998888' },
      'Nome completo': 'João Silva',
      'CPF': '12345678900',
      'Email': 'joao@email.com',
      'Data de nascimento': '15/05/1995',
      'Consentimento LGPD': 'sim',
    },
    raw_answers: [],
  },
};

const SECRET = 'test-secret';

// Configure a variável de ambiente de teste
process.env.RESPONDI_WEBHOOK_SECRET = SECRET;

describe('RespondiController', () => {

  it('deve retornar 401 sem token na URL', async () => {
    const res = await request(app)
      .post('/webhook/respondi')
      .send(payloadValido);
    expect(res.status).toBe(401);
  });

  it('deve retornar 401 com token inválido', async () => {
    const res = await request(app)
      .post('/webhook/respondi?token=token_errado')
      .send(payloadValido);
    expect(res.status).toBe(401);
  });

  it('deve retornar 200 com token válido e payload correto', async () => {
    const { prisma } = await import('../utils/prisma');
    (prisma.user.findFirst as any).mockResolvedValue(null);
    (prisma.user.upsert as any).mockResolvedValue({});

    const res = await request(app)
      .post(`/webhook/respondi?token=${SECRET}`)
      .send(payloadValido);
    expect(res.status).toBe(200);
  });

  it('lgpdConsent deve ser true apenas quando resposta for "sim"', async () => {
    const { prisma } = await import('../utils/prisma');
    (prisma.user.findFirst as any).mockResolvedValue(null);
    (prisma.user.upsert as any).mockImplementation(async (args: any) => {
      expect(args.create.lgpdConsent).toBe(true);
      return {};
    });

    await request(app)
      .post(`/webhook/respondi?token=${SECRET}`)
      .send(payloadValido);
  });

  it('lgpdConsent deve ser false quando resposta for diferente de "sim"', async () => {
    const payloadSemConsentimento = {
      ...payloadValido,
      respondent: {
        ...payloadValido.respondent,
        answers: {
          ...payloadValido.respondent.answers,
          'Consentimento LGPD': 'não',
        },
      },
    };

    const { prisma } = await import('../utils/prisma');
    (prisma.user.findFirst as any).mockResolvedValue(null);
    (prisma.user.upsert as any).mockImplementation(async (args: any) => {
      expect(args.create.lgpdConsent).toBe(false);
      return {};
    });

    await request(app)
      .post(`/webhook/respondi?token=${SECRET}`)
      .send(payloadSemConsentimento);
  });

});
```

**Adapte** os nomes dos campos, paths e assinaturas de acordo com o código real encontrado no arquivo.

## Verificação
```bash
npm test
```
Todos os testes devem passar. Qualquer falha indica um problema real na lógica de autenticação ou upsert do controller.
