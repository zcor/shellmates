import { NextRequest } from 'next/server';
import db, { Bot } from './db';

export interface AuthResult {
  success: boolean;
  bot?: Bot;
  error?: string;
}

export function authenticateBot(request: NextRequest): AuthResult {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader) {
    return { success: false, error: 'Missing Authorization header' };
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { success: false, error: 'Invalid Authorization format. Use: Bearer YOUR_API_KEY' };
  }

  const apiKey = parts[1];

  const bot = db.prepare('SELECT * FROM bots WHERE api_key = ?').get(apiKey) as Bot | undefined;

  if (!bot) {
    return { success: false, error: 'Invalid API key' };
  }

  return { success: true, bot };
}

export { generateApiKey } from './keys';
