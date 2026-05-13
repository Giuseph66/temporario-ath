# Passo 03 — Adicionar Graceful Shutdown

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. O ponto de entrada é `src/index.ts`. O servidor Express sobe com `app.listen(...)`. Quando o PM2 reinicia o processo ou o servidor é derrubado, o Prisma não fecha as conexões com o banco corretamente porque não há handlers para os sinais de encerramento.

## Problema
Não existem handlers para `SIGTERM` (sinal enviado pelo PM2 ao reiniciar) nem `SIGINT` (Ctrl+C). O `prisma.$disconnect()` nunca é chamado, deixando conexões abertas no PostgreSQL.

## O que Fazer

**1. Leia o arquivo**
Abra e leia `src/index.ts` na íntegra.

**2. Garanta que o servidor é salvo numa variável**
Localize a linha do `app.listen`. Ela deve estar assim ou similar:
```typescript
app.listen(port, () => {
  console.log(`...`);
});
```
Se o retorno do `app.listen` não está sendo guardado numa variável, corrija para:
```typescript
const server = app.listen(port, () => {
  console.log(`Artemis rodando na porta ${port}`);
});
```

**3. Adicione a função de shutdown e os handlers**
Logo após a linha do `server = app.listen(...)`, adicione:
```typescript
async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} recebido. Encerrando Artemis...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

**4. Confirme que `prisma` está importado**
Certifique-se que o `prisma` referenciado na função `shutdown` é o mesmo singleton importado de `src/utils/prisma.ts`. Após o Passo 01 deste plano, ele já deve estar importado no arquivo.

## Verificação
Rode o servidor em desenvolvimento:
```bash
npm run dev
```
Pressione `Ctrl+C`. O processo deve encerrar imprimindo `SIGINT recebido. Encerrando Artemis...` sem nenhum erro de conexão com banco de dados.

```bash
npm run build
```
Deve compilar sem erros.
