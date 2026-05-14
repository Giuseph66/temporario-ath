import fs from 'fs';
import path from 'path';
import { Config, PersonaConfig, ProgramsConfig, SystemSettings } from '../types/config';

export class ConfigLoader {
    private configPath: string;
    private config: Config | null = null;

    constructor(configDir: string) {
        this.configPath = configDir;
    }

    public loadConfig(): Config {
        try {
            const personaRaw = fs.readFileSync(path.join(this.configPath, 'persona.json'), 'utf-8');
            const programsRaw = fs.readFileSync(path.join(this.configPath, 'programs.json'), 'utf-8');
            const settingsRaw = fs.readFileSync(path.join(this.configPath, 'settings.json'), 'utf-8');

            const persona: PersonaConfig = JSON.parse(personaRaw);
            const programs: ProgramsConfig = JSON.parse(programsRaw);
            const settings: SystemSettings = JSON.parse(settingsRaw);

            this.config = {
                persona,
                programs,
                settings
            };

            return this.config;
        } catch (error) {
            console.error('Error loading configuration:', error);
            throw new Error('Failed to load configuration files.');
        }
    }

    public getConfig(): Config {
        if (!this.config) {
            return this.loadConfig();
        }
        return this.config;
    }

    public reloadConfig(): Config {
        return this.loadConfig();
    }
}

// Singleton instance for easy access
export const configLoader = new ConfigLoader(path.join(process.cwd(), 'config'));
