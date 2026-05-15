import fs from 'fs';
import path from 'path';
import { Config, PersonaConfig, ProgramsConfig, SystemSettings } from '../types/config';

// Defaults em memória — usados quando os arquivos config/ não existem
// Todo dado real vem do banco via agentToConfig()
const EMPTY_CONFIG: Config = {
    persona: {
        name: 'Artemis',
        role: '',
        language: 'Português (BR)',
        tone: {},
        protocols: {
            human_contact_link: '',
            human_handoff_consent: 'Posso te conectar com um humano. Deseja continuar?',
            human_handoff_hostile: 'Aqui está o contato direto: {LINK}',
            human_handoff_confirmed: 'Aqui está o contato: {LINK}',
            registration_link: '',
            respondi_form_link: '',
            prm_trigger: '',
        },
        absolute_restrictions: [],
        qualification: [],
        objection_handling: {},
        knowledge_base_contracts: {},
    } as unknown as PersonaConfig,
    programs: { programs: [] } as ProgramsConfig,
    settings: {
        human_support_number: '',
        human_handoff_message: '',
        human_notification_number: '',
    } as unknown as SystemSettings,
};

export class ConfigLoader {
    private configPath: string;
    private config: Config | null = null;

    constructor(configDir: string) {
        this.configPath = configDir;
    }

    public loadConfig(): Config {
        try {
            const personaPath  = path.join(this.configPath, 'persona.json');
            const programsPath = path.join(this.configPath, 'programs.json');
            const settingsPath = path.join(this.configPath, 'settings.json');

            if (!fs.existsSync(personaPath)) {
                // Arquivos migrados para o banco — usa defaults em memória
                this.config = EMPTY_CONFIG;
                return this.config;
            }

            const persona: PersonaConfig  = JSON.parse(fs.readFileSync(personaPath, 'utf-8'));
            const programs: ProgramsConfig = JSON.parse(fs.readFileSync(programsPath, 'utf-8'));
            const settings: SystemSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            this.config = { persona, programs, settings };
            return this.config;
        } catch (error) {
            console.warn('[ConfigLoader] Arquivos config/ ausentes ou inválidos — usando defaults em memória. Dados reais vêm do banco.');
            this.config = EMPTY_CONFIG;
            return this.config;
        }
    }

    public getConfig(): Config {
        if (!this.config) {
            return this.loadConfig();
        }
        return this.config;
    }

    public reloadConfig(): Config {
        this.config = null;
        return this.loadConfig();
    }
}

export const configLoader = new ConfigLoader(path.join(process.cwd(), 'config'));
