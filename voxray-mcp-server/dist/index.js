#!/usr/bin/env node
/**
 * voxray-mcp-server
 * MCP server for Voxray — call intelligence for Ultravox voice agents.
 *
 * Provides AI agents read access to call error data, error leaderboards,
 * fix suggestions, transcripts, and the ability to trigger analysis/sync.
 *
 * Usage (stdio):
 *   npx tsx src/index.ts
 *   TRANSPORT=http node dist/index.js   (HTTP on PORT, default 3001)
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VOXRAY_URL  (for sync tool — https://voxray.vercel.app or http://localhost:3000)
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { registerStatsTools } from './tools/stats.js';
import { registerErrorTools } from './tools/errors.js';
import { registerCallTools } from './tools/calls.js';
// Load .env.local from the voxray project root (one level up from this package)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env.local') });
// ── Validate required env vars ───────────────────────────────────────────────
const REQUIRED_ENV = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = REQUIRED_ENV.filter((v) => !process.env[v]);
if (missing.length > 0) {
    console.error(`ERROR: Missing required env vars: ${missing.join(', ')}`);
    console.error('Create a .env.local in the voxray project root with these variables.');
    process.exit(1);
}
// ── Build server ─────────────────────────────────────────────────────────────
const server = new McpServer({
    name: 'voxray-mcp-server',
    version: '1.0.0',
});
registerStatsTools(server);
registerErrorTools(server);
registerCallTools(server);
// ── Start ────────────────────────────────────────────────────────────────────
const transport = process.env.TRANSPORT ?? 'stdio';
if (transport === 'http') {
    const port = parseInt(process.env.PORT ?? '3001', 10);
    const httpServer = createServer(async (req, res) => {
        if (req.method !== 'POST' || req.url !== '/mcp') {
            res.writeHead(404).end('Not found');
            return;
        }
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', async () => {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const t = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
                enableJsonResponse: true,
            });
            res.on('close', () => t.close());
            await server.connect(t);
            await t.handleRequest(req, res, body);
        });
    });
    httpServer.listen(port, () => {
        console.error(`voxray-mcp-server running on http://localhost:${port}/mcp`);
    });
}
else {
    const t = new StdioServerTransport();
    await server.connect(t);
    console.error('voxray-mcp-server running via stdio');
}
//# sourceMappingURL=index.js.map