import axios from 'axios';
import prisma from '../db';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || process.env.HELIUS_RPC_URL?.split('api-key=')[1];
const HELIUS_WEBHOOK_URL = process.env.HELIUS_WEBHOOK_URL;
const HELIUS_BASE_URL = 'https://api.helius.xyz/v0';

interface WebhookResponse {
    webhookID: string;
    walletAddress?: string;
}

/**
 * Get existing Helius webhooks
 */
export async function getHeliusWebhooks(): Promise<any[]> {
    try {
        if (!HELIUS_API_KEY) {
            console.warn('[Helius] API key not configured');
            return [];
        }

        const response = await axios.get(
            `${HELIUS_BASE_URL}/webhooks?api-key=${HELIUS_API_KEY}`,
            { timeout: 10000 }
        );

        return response.data || [];
    } catch (error) {
        console.error('[Helius] Failed to get webhooks:', error);
        return [];
    }
}

/**
 * Create a new Helius webhook for a trader address
 */
export async function createTraderWebhook(traderAddress: string): Promise<WebhookResponse | null> {
    try {
        if (!HELIUS_API_KEY || !HELIUS_WEBHOOK_URL) {
            console.warn('[Helius] Missing API key or webhook URL');
            return null;
        }

        // Check if webhook already exists for this trader
        const existing = await prisma.traderWebhook.findUnique({
            where: { traderAddress }
        });

        if (existing) {
            console.log(`[Helius] Webhook already exists for ${traderAddress}`);
            return { webhookID: existing.webhookId, walletAddress: traderAddress };
        }

        // Create webhook via Helius API
        const response = await axios.post(
            `${HELIUS_BASE_URL}/webhooks?api-key=${HELIUS_API_KEY}`,
            {
                webhookURL: HELIUS_WEBHOOK_URL,
                accountAddresses: [traderAddress],
                transactionTypes: ['TRANSFER', 'SWAP'],
                webhookType: 'enhanced',
                authHeader: process.env.HELIUS_AUTH_HEADER
            },
            { timeout: 15000 }
        );

        const webhookId = response.data.webhookID;
        if (!webhookId) {
            console.error('[Helius] No webhook ID in response:', response.data);
            return null;
        }

        // Persist webhook ID in database
        await prisma.traderWebhook.create({
            data: {
                traderAddress,
                webhookId,
                isActive: true
            }
        });

        console.log(`[Helius] Created webhook ${webhookId} for trader ${traderAddress}`);
        return { webhookID: webhookId, walletAddress: traderAddress };
    } catch (error: any) {
        console.error('[Helius] Failed to create webhook:', error?.response?.data || error.message);
        return null;
    }
}

/**
 * Delete a Helius webhook for a trader address
 * Only deletes if no other users are following this trader
 */
export async function deleteTraderWebhook(traderAddress: string): Promise<boolean> {
    try {
        if (!HELIUS_API_KEY) {
            console.warn('[Helius] API key not configured');
            return false;
        }

        // Check if other users are still following this trader
        const followerCount = await prisma.copyTradingConfig.count({
            where: {
                traderAddress,
                isActive: true
            }
        });

        if (followerCount > 0) {
            console.log(`[Helius] Trader ${traderAddress} still has ${followerCount} followers, keeping webhook`);
            return true;
        }

        // Get the webhook record
        const webhook = await prisma.traderWebhook.findUnique({
            where: { traderAddress }
        });

        if (!webhook) {
            console.log(`[Helius] No webhook found for trader ${traderAddress}`);
            return true;
        }

        // Delete from Helius API
        await axios.delete(
            `${HELIUS_BASE_URL}/webhooks/${webhook.webhookId}?api-key=${HELIUS_API_KEY}`,
            { timeout: 10000 }
        );

        // Delete from database
        await prisma.traderWebhook.delete({
            where: { traderAddress }
        });

        console.log(`[Helius] Deleted webhook ${webhook.webhookId} for trader ${traderAddress}`);
        return true;
    } catch (error: any) {
        // If webhook not found on Helius, still delete from DB
        if (error?.response?.status === 404) {
            await prisma.traderWebhook.deleteMany({
                where: { traderAddress }
            }).catch(() => {});
            return true;
        }
        console.error('[Helius] Failed to delete webhook:', error?.response?.data || error.message);
        return false;
    }
}

/**
 * Ensure webhook exists for a trader address
 * Call this when creating/updating copy trade config
 */
export async function ensureTraderWebhook(traderAddress: string): Promise<{ success: boolean; error?: string }> {
    try {
        const result = await createTraderWebhook(traderAddress);
        if (result) {
            return { success: true };
        }
        return { success: false, error: 'Failed to create webhook' };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
