#!/usr/bin/env node
// ============================================
// MCP-DOCA-V2 - Webhook Server Runner
// Execute: npm run webhook
// ============================================
import 'dotenv/config';
import { logger } from './utils/logger.js';
import { webhookServer } from './services/webhook.server.js';
logger.separator('MCP-DOCA-V2 Webhook Server');
async function main() {
    try {
        await webhookServer.start();
        logger.info('Webhook server is ready to receive messages!');
        logger.info('Configure WAHA to send webhooks to: POST /webhook/waha');
    }
    catch (error) {
        logger.error('Failed to start webhook server', error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await webhookServer.stop();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await webhookServer.stop();
    process.exit(0);
});
process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason);
    process.exit(1);
});
main();
