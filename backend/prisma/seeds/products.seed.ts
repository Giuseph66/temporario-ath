import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Iniciando seed de produtos (Softwares, Aplicações e Automações)...');

    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
        console.error('❌ Nenhum tenant encontrado. Rode o seed principal primeiro.');
        return;
    }

    const agent = await prisma.agent.findFirst({ where: { tenantId: tenant.id } });
    if (!agent) {
        console.error('❌ Nenhum agent encontrado. Rode o seed principal primeiro.');
        return;
    }

    const products = [
        // ─── SOFTWARES ─────────────────────────────────────────────────────────────
        {
            programKey: 'software_erp_custom',
            name: 'ERP Customizado para PMEs',
            priceValue: 5000,
            priceType: 'one_time',
            installments: 3,
            durationWeeks: 12,
            verbatimIntro: 'Um sistema ERP completo e customizado para a gestão da sua empresa.',
            fullText: 'Desenvolvimento de ERP sob medida com módulos de controle financeiro, estoque, faturamento e gestão de clientes. Arquitetura em nuvem segura e escalável, com suporte a múltiplos usuários e níveis de acesso.',
            sortOrder: 10,
        },
        {
            programKey: 'software_crm_vendas',
            name: 'Plataforma CRM de Vendas Inteligente',
            priceValue: 3500,
            priceType: 'one_time',
            installments: 2,
            durationWeeks: 8,
            verbatimIntro: 'Aumente suas vendas com um CRM focado em inteligência de dados.',
            fullText: 'CRM focado em acompanhamento de leads, pipeline de vendas e automação de follow-ups. Inclui dashboards interativos, relatórios detalhados e alertas automáticos de estagnação de leads.',
            sortOrder: 20,
        },

        // ─── APLICAÇÕES ────────────────────────────────────────────────────────────
        {
            programKey: 'app_mobile_ecommerce',
            name: 'Aplicativo Mobile de E-commerce',
            priceValue: 8000,
            priceType: 'one_time',
            installments: 4,
            durationWeeks: 16,
            verbatimIntro: 'Leve sua loja para o bolso dos seus clientes com um App Mobile nativo.',
            fullText: 'Desenvolvimento de aplicativo móvel para iOS e Android para vendas online. Integração com gateways de pagamento, notificações push, carrinho de compras avançado e programa de fidelidade embutido.',
            sortOrder: 30,
        },
        {
            programKey: 'app_web_dashboard',
            name: 'Dashboard Web Analítico',
            priceValue: 2500,
            priceType: 'one_time',
            installments: 1,
            durationWeeks: 4,
            verbatimIntro: 'Visualize seus dados mais importantes em um painel interativo e bonito.',
            fullText: 'Criação de um painel web com gráficos, KPIs e relatórios exportáveis. Integra-se com suas bases de dados atuais para consolidar informações estratégicas em uma única tela.',
            sortOrder: 40,
        },

        // ─── AUTOMAÇÕES ────────────────────────────────────────────────────────────
        {
            programKey: 'automacao_whatsapp_bot',
            name: 'Automação de Atendimento via WhatsApp',
            priceValue: 1200,
            priceType: 'one_time',
            installments: 1,
            durationWeeks: 2,
            verbatimIntro: 'Automatize seu atendimento 24/7 com um chatbot inteligente para WhatsApp.',
            fullText: 'Bot para WhatsApp capaz de qualificar leads, tirar dúvidas frequentes e agendar reuniões de forma totalmente automatizada. Reduz tempo de espera e aumenta a conversão.',
            sortOrder: 50,
        },
        {
            programKey: 'automacao_fluxo_zapier',
            name: 'Automação de Processos (Zapier/Make)',
            priceValue: 900,
            priceType: 'one_time',
            installments: 1,
            durationWeeks: 1,
            verbatimIntro: 'Elimine tarefas repetitivas integrando as ferramentas que você já usa.',
            fullText: 'Mapeamento e automação de processos internos utilizando Zapier ou Make. Conecta seu e-mail, CRM, planilhas e Slack para que a informação flua sem intervenção humana.',
            sortOrder: 60,
        }
    ];

    console.log(`📌 Inserindo/Atualizando ${products.length} produtos para o agente: ${agent.name} (${agent.id})`);

    let createdCount = 0;
    let updatedCount = 0;

    for (const product of products) {
        const existing = await prisma.agentProgram.findUnique({
            where: {
                agentId_programKey: {
                    agentId: agent.id,
                    programKey: product.programKey,
                }
            }
        });

        if (!existing) {
            await prisma.agentProgram.create({
                data: {
                    ...product,
                    agentId: agent.id,
                }
            });
            createdCount++;
            console.log(`✅ Produto criado: ${product.name}`);
        } else {
            await prisma.agentProgram.update({
                where: { id: existing.id },
                data: product
            });
            updatedCount++;
            console.log(`🔄 Produto atualizado: ${product.name}`);
        }
    }

    console.log(`\n🎉 Seed de produtos concluído com sucesso. (${createdCount} criados, ${updatedCount} atualizados)`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
