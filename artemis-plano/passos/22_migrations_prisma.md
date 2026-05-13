# Passo 22 — Criar Migrations Prisma Versionadas

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. O banco de dados é PostgreSQL gerenciado pelo Prisma. Atualmente só existe `prisma/schema.prisma` — não há migrations. Sem migrations, não há registro histórico de como o banco evoluiu e não é seguro atualizar o banco em produção.

**Este passo deve ser executado depois dos Passos 07, 19** (que alteram o schema com novas tabelas/campos).

## O que Fazer

**1. Confirme que o banco local está rodando**
Verifique se o PostgreSQL está acessível e se a `DATABASE_URL` no `.env` local está correta.

**2. Crie a migration inicial**
Este comando vai comparar o `schema.prisma` com o estado atual do banco e criar um arquivo SQL com as diferenças:
```bash
npx prisma migrate dev --name initial_schema
```

Se o banco já tiver as tabelas (de um `db push` anterior), o Prisma vai detectar que não há diferença e criar uma migration vazia — isso é normal.

**3. Verifique o que foi criado**
Após o comando, deve existir o diretório:
```
prisma/migrations/
  20260513000000_initial_schema/
    migration.sql
```
Abra o arquivo `migration.sql` e confirme que ele contém as criações das tabelas `User`, `ChatHistory`, `ProcessedEvent` (do Passo 07) e os campos `enrollmentStatus`/`enrollmentDate` (do Passo 19).

**4. Se os campos novos não aparecerem na migration**
Execute uma migration separada para cada alteração de schema que ainda não foi migrada:
```bash
npx prisma migrate dev --name add_processed_events
npx prisma migrate dev --name add_enrollment_status
```

**5. Confirme as migrations aplicadas**
```bash
npx prisma migrate status
```
Todas as migrations devem aparecer como `Applied`.

**6. Confirme que o `prisma/migrations/` será commitado**
Verifique se o `.gitignore` **não** inclui `prisma/migrations/`. As migrations **devem ser versionadas** no repositório.

## Regras de Uso (Importante)

**Ambiente local (desenvolvimento):**
```bash
npx prisma migrate dev --name nome_da_mudanca
```
Cria e aplica a migration imediatamente.

**Produção:**
```bash
npx prisma migrate deploy
```
Aplica somente as migrations pendentes sem criar novas. **Nunca usar `db push` em produção.**

## Verificação
```bash
npx prisma migrate status
```
Deve mostrar todas as migrations como `Applied` sem nenhuma pendente.

```bash
ls prisma/migrations/
```
Deve listar pelo menos uma pasta de migration com um arquivo `migration.sql` dentro.

```bash
npm run build
```
Deve compilar sem erros.
