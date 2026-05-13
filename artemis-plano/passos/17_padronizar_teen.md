# Passo 17 — Padronizar Protocolo Teen (Faixa Etária 14-16 Anos)

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. A Confluence Treinamento oferece dois programas para jovens e adultos: **Inglês Personalizado** (para 17+ anos) e **Tech Lab** (para adolescentes). A faixa etária do Tech Lab está inconsistente em diferentes partes do código.

## Problema
O PDF do projeto define o Tech Lab para alunos de **14 a 16 anos**. Porém, diferentes partes do código usam faixas diferentes (12-17, 14-16, 14-17), criando comportamentos inconsistentes. A Artemis pode apresentar o programa errado dependendo do estado FSM em que está.

## O que Fazer

**1. Auditoria — encontre todas as ocorrências**
Execute no terminal dentro de `/home/jesus/Neurelix/Artemis-Bot`:
```bash
grep -rn "14\|15\|16\|17\|teen\|Teen\|TEEN\|adolescente" src/
grep -rn "14\|15\|16\|17" config/persona.json
```

**2. Leia todos os arquivos com ocorrências**
Leia cada arquivo encontrado para entender o contexto exato de cada uso.

**3. Defina e aplique a regra única**
A regra oficial é:
- **14 a 16 anos** (inclusive) → Tech Lab obrigatório. Recusar Inglês Personalizado com gentileza.
- **17 anos ou mais** → Inglês Personalizado (ou Tech Lab se quiser e houver vaga — mas o padrão é Inglês Personalizado)
- **Menor de 14 anos** → Nenhum programa disponível no momento. Responder com clareza e gentileza.

**4. Atualize `config/persona.json`**
Na seção `qualification`, garanta que o texto reflita exatamente:
```json
"qualification": [
  "Sempre descubra 1) Nome do aluno, 2) Idade do aluno e 3) Objetivo com o inglês.",
  "Faça perguntas pontuais, LIMITE DE UMA PERGUNTA POR VEZ.",
  "Tech Lab: Apenas para alunos entre 14 e 16 anos. Para 17 anos ou mais, ofereça Inglês Personalizado. Para menores de 14, informe que não há programa disponível no momento.",
  "Se menor de 17 pedir Inglês Personalizado, recuse com clareza e ofereça o Tech Lab."
]
```

**5. Atualize `src/flow/StateResolver.ts` ou `src/services/PromptBuilder.ts`**
Localize qualquer comparação numérica de idade e padronize:
```typescript
// Definições centralizadas — usar estas constantes em todo o código
const TECH_LAB_AGE_MIN = 14;
const TECH_LAB_AGE_MAX = 16;
const INGLES_PERSONALIZADO_AGE_MIN = 17;

// Lógica de roteamento
if (age >= TECH_LAB_AGE_MIN && age <= TECH_LAB_AGE_MAX) {
  // Tech Lab
} else if (age >= INGLES_PERSONALIZADO_AGE_MIN) {
  // Inglês Personalizado
} else {
  // Menor de 14 — sem programa disponível
}
```

## Verificação
```bash
grep -rn "12\|13\b" src/flow/ src/services/PromptBuilder.ts
```
Não deve haver comparações de idade com 12 ou 13 anos em contexto de programa.

```bash
grep -rn "teen\|Teen\|TEEN" src/
```
Todas as ocorrências devem usar a faixa 14-16.

```bash
npm run build
```
Deve compilar sem erros.
