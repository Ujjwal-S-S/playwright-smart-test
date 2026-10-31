import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { SmartRegressionConfig, SmartRegressionConfigSchema } from './schema.js';

dotenv.config();

export * from './schema.js';

export function loadConfig(cwd: string = process.cwd(), customConfigPath?: string): SmartRegressionConfig {
  let loadedConfig: unknown = {};

  const possiblePaths = customConfigPath
    ? [path.resolve(cwd, customConfigPath)]
    : [
        path.resolve(cwd, 'smart-regression.config.json'),
        path.resolve(cwd, '.smart-regressionrc.json'),
        path.resolve(cwd, 'smart-regression.json'),
      ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        loadedConfig = JSON.parse(raw);
        break;
      } catch (err) {
        console.warn(`[smart-test] Warning: Failed to parse config file at ${configPath}:`, err);
      }
    }
  }

  const parsed = SmartRegressionConfigSchema.parse(loadedConfig);

  // Allow environment variables to override AI config
  const envApiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (envApiKey && !parsed.ai.apiKey) {
    parsed.ai.apiKey = envApiKey;
    if (process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
      parsed.ai.provider = 'openai';
    }
  }

  return parsed;
}
