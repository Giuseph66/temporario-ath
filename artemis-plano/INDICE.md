# Artemis Bot — Índice de Passos de Desenvolvimento

Execute os passos **exatamente nesta ordem**. Cada arquivo é auto-contido: contexto, código exato, verificação. Dê um arquivo por vez para a IA executar.

---

## Fase 1 — Estabilização do Bot Atual (Sprints 1–5)

Fazer **antes** de qualquer coisa. Sistema instável não vira SaaS.

### Sprint 1 — Estabilização

| Passo | Arquivo | O que faz |
|-------|---------|-----------|
| 01 | [01_prisma_singleton.md](passos/01_prisma_singleton.md) | Remove instâncias diretas de PrismaClient de 3 arquivos |
| 02 | [02_historico_correto.md](passos/02_historico_correto.md) | Corrige busca do histórico — retorna as 20 mais recentes |
| 03 | [03_graceful_shutdown.md](passos/03_graceful_shutdown.md) | Handlers SIGTERM/SIGINT para encerrar servidor com segurança |
| 04 | [04_env_example.md](passos/04_env_example.md) | Cria `.env.example` com todas as variáveis documentadas |
| 05 | [05_readme_atualizado.md](passos/05_readme_atualizado.md) | Reescreve README com stack e arquitetura reais |

### Sprint 2 — Segurança

| Passo | Arquivo | O que faz |
|-------|---------|-----------|
| 06 | [06_validar_webhook_asaas.md](passos/06_validar_webhook_asaas.md) | Valida token no webhook Asaas — impede pagamentos falsos |
| 07 | [07_idempotencia_asaas.md](passos/07_idempotencia_asaas.md) | Tabela ProcessedEvent — evita mensagem duplicada |
| 08 | [08_calendar_id_env.md](passos/08_calendar_id_env.md) | Move Calendar ID hardcoded para variável de ambiente |
| 09 | [09_remover_logs_sensiveis.md](passos/09_remover_logs_sensiveis.md) | Remove logs que expõem CPF, email e endereço |

### Sprint 3 — Testes

| Passo | Arquivo | O que faz |
|-------|---------|-----------|
| 10 | [10_configurar_vitest.md](passos/10_configurar_vitest.md) | Instala e configura Vitest |
| 11 | [11_testes_phone_normalizer.md](passos/11_testes_phone_normalizer.md) | Testes de normalização de telefone |
| 12 | [12_testes_state_resolver.md](passos/12_testes_state_resolver.md) | Testes da FSM e gatilhos de transferência |
| 13 | [13_testes_prompt_builder.md](passos/13_testes_prompt_builder.md) | Testes de montagem do prompt por estado FSM |
| 14 | [14_testes_calculo_asaas.md](passos/14_testes_calculo_asaas.md) | Testes dos cálculos semestral/anual |
| 15 | [15_testes_respondi_controller.md](passos/15_testes_respondi_controller.md) | Testes do webhook de formulários |

### Sprint 4 — Produto

| Passo | Arquivo | O que faz |
|-------|---------|-----------|
| 16 | [16_resposta_midia.md](passos/16_resposta_midia.md) | Bot responde ao receber imagem/áudio em vez de ignorar |
| 17 | [17_padronizar_teen.md](passos/17_padronizar_teen.md) | Padroniza faixa teen 14-16 em todo o código |
| 18 | [18_salvar_current_program_id.md](passos/18_salvar_current_program_id.md) | Salva programa do aluno no banco de forma determinística |
| 19 | [19_status_matricula.md](passos/19_status_matricula.md) | Campo enrollmentStatus — rastreia quem pagou |
| 20 | [20_remover_codigo_morto.md](passos/20_remover_codigo_morto.md) | Remove variáveis não usadas e logs de debug |
| 21 | [21_remover_any.md](passos/21_remover_any.md) | Substitui `any` por tipos corretos no TypeScript |

### Sprint 5 — Banco de Dados

| Passo | Arquivo | O que faz |
|-------|---------|-----------|
| 22 | [22_migrations_prisma.md](passos/22_migrations_prisma.md) | Cria migrations versionadas (rodar após 07 e 19) |
| 23 | [23_enum_estado_fsm.md](passos/23_enum_estado_fsm.md) | Enum tipado para conversationState no banco |

---

## Fase 2 — Transformação SaaS (Sprints A–F)

Frontend aparece cedo — cada tela nasce junto da API que ela consome.
Resultado visual ao fim de cada sprint indicado com 🖥.

### Sprint A — Multi-tenant: Banco de Dados
*Fundação. Sem visual. Pré-requisito para tudo mais.*

| Passo | Arquivo | O que faz |
|-------|---------|-----------|
| A1 | [A1_tenant_schema.md](passos/A1_tenant_schema.md) | Modelo Tenant no schema Prisma |
| A2 | [A2_tenant_user_schema.md](passos/A2_tenant_user_schema.md) | Modelo TenantUser (admins do painel) |
| A3 | [A3_user_add_tenant_id.md](passos/A3_user_add_tenant_id.md) | Adiciona tenantId ao User e corrige unicidade |
| A4 | [A4_agent_schema.md](passos/A4_agent_schema.md) | Modelo Agent com configs JSON por tenant |
| A5 | [A5_migration_seed.md](passos/A5_migration_seed.md) | Migration + seed do Tenant inicial (Confluence) |

### Sprint B — Auth JWT + Frontend Shell
🖥 *Resultado: painel com login funcionando, sidebar navegável.*

| Passo | Arquivo | O que faz |
|-------|---------|-----------|
| B1 | [B1_auth_jwt_backend.md](passos/B1_auth_jwt_backend.md) | Endpoints /auth/login, /auth/refresh + middleware requireAuth |
| B2 | [B2_frontend_setup.md](passos/B2_frontend_setup.md) | Projeto React + Vite + TypeScript + fontes + tokens CSS |
| B3 | [B3_design_system_components.md](passos/B3_design_system_components.md) | Componentes Button, Toggle, Badge, Input |
| B4 | [B4_login_page.md](passos/B4_login_page.md) | Tela de login (background escuro, formulário) |
| B5 | [B5_auth_context_layout.md](passos/B5_auth_context_layout.md) | AuthContext + AppLayout com sidebar + rotas protegidas |

### Sprint C — Evolution API + Tela de Integrações
🖥 *Resultado: conectar WhatsApp pelo painel via QR Code.*

| Passo | Arquivo | O que faz |
|-------|---------|-----------|
| C1 | [C1_evolution_service.md](passos/C1_evolution_service.md) | EvolutionService: sendText, getQRCode, getStatus, createInstance |
| C2 | [C2_messaging_provider.md](passos/C2_messaging_provider.md) | Abstração MessagingProvider (Evolution + Meta plugáveis) |
| C3 | [C3_evolution_webhook.md](passos/C3_evolution_webhook.md) | Webhook POST /webhook/evolution — resolve tenant por instância |
| C4 | [C4_instance_endpoints.md](passos/C4_instance_endpoints.md) | Endpoints REST: criar instância, QR Code, status, desconectar |
| C5 | [C5_integrations_screen.md](passos/C5_integrations_screen.md) | Tela de Integrações com QR Code ao vivo e polling de status |

### Sprint D — API de Dados + Conversas + Leads
🖥 *Resultado: ver conversas ao vivo e tabela de leads no painel.*

| Passo | Arquivo | O que faz |
|-------|---------|-----------|
| D1 | [D1_leads_api.md](passos/D1_leads_api.md) | Endpoints: listar leads, detalhe, conversas, forçar estado, excluir |
| D2 | [D2_conversations_screen.md](passos/D2_conversations_screen.md) | Tela Conversas: split view lista + chat com polling 5s |
| D3 | [D3_leads_screen.md](passos/D3_leads_screen.md) | Tela Leads: tabela com filtro + sidebar de detalhe e ações |

### Sprint E — Dashboard + Config do Agente + Settings
🖥 *Resultado: métricas reais e editar persona pelo painel sem rebuild.*

| Passo | Arquivo | O que faz |
|-------|---------|-----------|
| E1 | [E1_metrics_api.md](passos/E1_metrics_api.md) | Endpoint GET /api/metrics com conversas, conversão, FSM |
| E2 | [E2_dashboard_screen.md](passos/E2_dashboard_screen.md) | Dashboard: hero do agente, 5 stats, grid FSM, matrículas |
| E3 | [E3_agent_config_api.md](passos/E3_agent_config_api.md) | Endpoints GET/PATCH /api/agent para persona, programas, settings |
| E4 | [E4_agent_config_screen.md](passos/E4_agent_config_screen.md) | Tela Agente: PowerCards expansíveis estilo V3 Composer |
| E5 | [E5_settings_screen.md](passos/E5_settings_screen.md) | Tela Configurações: conta, senha, exportar LGPD, sair |

### Sprint F — Onboarding SaaS
🖥 *Resultado: segundo cliente se registra e configura sozinho.*

| Passo | Arquivo | O que faz |
|-------|---------|-----------|
| F1 | [F1_register_endpoint.md](passos/F1_register_endpoint.md) | POST /auth/register — cria Tenant + TenantUser + Agent em transação |
| F2 | [F2_register_screen.md](passos/F2_register_screen.md) | Tela de registro pública (background escuro) |
| F3 | [F3_onboarding_wizard.md](passos/F3_onboarding_wizard.md) | Wizard 3 passos: Persona → WhatsApp → Integrações |
| F4 | [F4_webhook_isolation.md](passos/F4_webhook_isolation.md) | Isolamento total de webhook por tenant + logs estruturados |

---

## Resumo visual da sequência

```
Sprints 1–5   →   Sprint A   →   Sprint B 🖥   →   Sprint C 🖥
(bot estável)     (banco)        (login+shell)      (QR Code)

   ↓
Sprint D 🖥   →   Sprint E 🖥   →   Sprint F 🖥
(conversas)       (dashboard)       (SaaS público)
```

**Total: 46 passos. 2 fases. Frontend entra no Sprint B e cresce a cada sprint.**
