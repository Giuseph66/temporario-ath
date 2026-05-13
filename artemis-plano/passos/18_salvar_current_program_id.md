# Passo 18 — Salvar `currentProgramId` de Forma Determinística

## Contexto do Projeto
O Artemis Bot está em `/home/jesus/Neurelix/Artemis-Bot`. O campo `currentProgramId` na tabela `User` define qual programa o aluno está sendo apresentado. Quando está vazio, o `PromptBuilder` tenta deduzir o programa pela idade — o que é frágil e pode mudar entre interações.

## Problema
A lógica que salva `currentProgramId` no banco é inconsistente. Na maioria das vezes o campo fica `null`, e o sistema deduz o programa pelo prompt sem persistir a decisão. Isso significa que a cada nova mensagem, o bot pode "esquecer" qual programa estava apresentando.

## O que Fazer

**1. Leia os arquivos necessários**
Abra e leia:
- `src/services/StateService.ts` — onde o perfil é atualizado
- `src/flow/StateResolver.ts` — onde o estado é decidido
- `src/services/AIService.ts` — onde a extração de perfil acontece

**2. Identifique o ponto onde a idade é confirmada**
Procure o método que processa o resultado da extração de perfil (`extractProfileData` ou similar). É lá que a `age` é salva no banco. Nesse mesmo ponto, adicione a lógica de atribuição de programa.

**3. Adicione a lógica de atribuição do programa**
No método que salva o perfil extraído, após salvar a idade, adicione:

```typescript
// Só atribui programa se ainda não foi definido
if (!user.currentProgramId && perfil.age != null) {
  let programId: string | null = null;

  if (perfil.age >= 14 && perfil.age <= 16) {
    programId = 'ingles_techlab';
  } else if (perfil.age >= 17) {
    programId = 'ingles_personalizado';
  }
  // Menor de 14: sem programa por enquanto, deixar null

  // Verificar também se o goal menciona psicologia/terapia
  if (perfil.goal && contemTermosDeTerapia(perfil.goal)) {
    programId = 'terapia_psicanalise';
  }

  if (programId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { currentProgramId: programId },
    });
  }
}
```

**4. Crie a função auxiliar de detecção de terapia**
```typescript
function contemTermosDeTerapia(goal: string): boolean {
  const termos = [
    'terapia', 'psicólogo', 'psicanálise', 'psicanalise',
    'ansiedade', 'depressão', 'autoconhecimento', 'saúde mental',
    'burnout', 'estresse', 'relacionamento', 'traumas'
  ];
  const goalLower = goal.toLowerCase();
  return termos.some(termo => goalLower.includes(termo));
}
```

**Atenção:** A função `contemTermosDeTerapia` usa termos do campo `goal`. O `StateService` já tem uma lista de termos bloqueados para o `goal` (Art. 11 LGPD). Verifique se há conflito e se os termos de detecção de terapia devem ser os mesmos ou diferentes dos termos bloqueados.

**5. Confirme que `currentProgramId` só é sobrescrito com permissão explícita**
O campo não deve ser sobrescrito se já tiver um valor. A condição `if (!user.currentProgramId)` no passo 3 garante isso.

## Verificação
No banco, após uma conversa onde o usuário confirma ter 15 anos, o campo `currentProgramId` deve ser `'ingles_techlab'`. Após confirmar ter 25 anos, deve ser `'ingles_personalizado'`.

```bash
npm run build
```
Deve compilar sem erros.
