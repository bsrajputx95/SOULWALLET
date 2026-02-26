import prisma from '../db';
import axios from 'axios';
import {
    seedBotAccounts,
    seedBotFollows,
    getBotUsers,
    getRandomBot,
    getRandomTemplate,
    fillTemplate,
    VIP_USERNAMES,
    BOT_ACCOUNTS,
    BotTier,
} from './botAccounts';

// ============================================================
// BOT ENGINE — Post, Like & Follow automation
// ============================================================

// ── Configuration ──
const POST_INTERVAL_MS = 30 * 60 * 1000;   // Post check every 30 minutes
const LIKE_INTERVAL_MS = 5 * 60 * 1000;    // Like drip every 5 minutes
const MIN_PRICE_CHANGE = 8;                 // Minimum % change to post about
const MAX_POSTS_PER_RUN = 3;                // Max posts per 30-min run
const LIKE_BATCH_SIZE = 4;                  // Max likes to add per post per run

// Track what we've already posted to avoid duplicates
const recentlyPostedTokens = new Map<string, number>(); // symbol -> timestamp
const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000; // Don't re-post same token within 4 hours

// ============================================================
// DATA SOURCES (free, no API keys needed)
// ============================================================

interface TrendingToken {
    symbol: string;
    name: string;
    change24h: number;
    volume24h?: number;
    marketCap?: number;
    address?: string;
}

/**
 * Fetch trending tokens from CoinGecko (free, no key).
 */
async function fetchCoinGeckoTrending(): Promise<TrendingToken[]> {
    try {
        const res = await axios.get('https://api.coingecko.com/api/v3/search/trending', {
            timeout: 10000,
        });
        const coins = res.data?.coins || [];
        return coins.slice(0, 10).map((c: any) => ({
            symbol: c.item?.symbol || 'UNKNOWN',
            name: c.item?.name || 'Unknown',
            change24h: c.item?.data?.price_change_percentage_24h?.usd || 0,
            marketCap: c.item?.data?.market_cap ? parseFloat(c.item.data.market_cap.replace(/[$,]/g, '')) : 0,
            address: c.item?.platforms?.solana || null,
        }));
    } catch (err: any) {
        console.warn('[BotEngine] CoinGecko trending fetch failed:', err.message);
        return [];
    }
}

/**
 * Fetch top gainers from DexScreener (Solana, free).
 */
async function fetchDexScreenerGainers(): Promise<TrendingToken[]> {
    try {
        const res = await axios.get('https://api.dexscreener.com/token-boosts/top/v1', {
            timeout: 10000,
        });
        const tokens = Array.isArray(res.data) ? res.data : [];
        // Filter Solana tokens only
        const solTokens = tokens
            .filter((t: any) => t.chainId === 'solana')
            .slice(0, 10);

        // Fetch price data for these tokens
        const results: TrendingToken[] = [];
        for (const t of solTokens) {
            try {
                const detail = await axios.get(`https://api.dexscreener.com/tokens/v1/solana/${t.tokenAddress}`, {
                    timeout: 8000,
                });
                const pairs = Array.isArray(detail.data) ? detail.data : [];
                if (pairs.length > 0) {
                    const best = pairs[0];
                    const change = parseFloat(best.priceChange?.h24 || '0');
                    if (Math.abs(change) >= MIN_PRICE_CHANGE) {
                        results.push({
                            symbol: best.baseToken?.symbol || 'UNKNOWN',
                            name: best.baseToken?.name || 'Unknown',
                            change24h: change,
                            volume24h: parseFloat(best.volume?.h24 || '0'),
                            address: t.tokenAddress,
                        });
                    }
                }
            } catch {
                // Skip individual token errors
            }
        }
        return results;
    } catch (err: any) {
        console.warn('[BotEngine] DexScreener fetch failed:', err.message);
        return [];
    }
}

// ============================================================
// POST ENGINE
// ============================================================

/**
 * Check if a token was recently posted about (deduplication).
 */
function wasRecentlyPosted(symbol: string): boolean {
    const lastPosted = recentlyPostedTokens.get(symbol.toUpperCase());
    if (!lastPosted) return false;
    return (Date.now() - lastPosted) < DEDUP_WINDOW_MS;
}

function markAsPosted(symbol: string) {
    recentlyPostedTokens.set(symbol.toUpperCase(), Date.now());
    // Cleanup old entries
    for (const [key, ts] of recentlyPostedTokens) {
        if (Date.now() - ts > DEDUP_WINDOW_MS) {
            recentlyPostedTokens.delete(key);
        }
    }
}

/**
 * Pick the right bot tier for a given event.
 */
function pickTierForEvent(change: number): BotTier {
    const absChange = Math.abs(change);
    if (absChange >= 30) {
        // Major move - lurkers come out
        const tiers: BotTier[] = ['lurker', 'degen', 'analyst'];
        return tiers[Math.floor(Math.random() * tiers.length)];
    } else if (absChange >= 15) {
        // Solid move
        const tiers: BotTier[] = ['analyst', 'degen', 'og'];
        return tiers[Math.floor(Math.random() * tiers.length)];
    } else {
        // Normal move 
        const tiers: BotTier[] = ['degen', 'vibes', 'analyst', 'og'];
        return tiers[Math.floor(Math.random() * tiers.length)];
    }
}

/**
 * Create a bot post from real market data.
 */
async function createBotPost(token: TrendingToken): Promise<boolean> {
    try {
        if (wasRecentlyPosted(token.symbol)) {
            return false;
        }

        const tier = pickTierForEvent(token.change24h);
        const bot = await getRandomBot(tier);
        if (!bot) return false;

        const template = getRandomTemplate(tier, 'token');
        const content = fillTemplate(template, {
            symbol: token.symbol,
            change: Math.abs(token.change24h).toFixed(1),
            volume: token.volume24h ? formatVolume(token.volume24h) : undefined,
        });

        await prisma.post.create({
            data: {
                userId: bot.id,
                content,
                visibility: 'public',
                tokenAddress: token.address || null,
                tokenSymbol: token.symbol,
                tokenName: token.name,
                tokenVerified: false,
                tokenPriceAtPost: null,
            },
        });

        markAsPosted(token.symbol);
        console.log(`[BotEngine] ${bot.username} posted about ${token.symbol} (+${token.change24h.toFixed(1)}%)`);
        return true;
    } catch (err: any) {
        console.error('[BotEngine] Post creation failed:', err.message);
        return false;
    }
}

function formatVolume(vol: number): string {
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
    return vol.toFixed(0);
}

/**
 * Main post engine — runs every 30 minutes.
 */
async function runPostEngine() {
    try {
        console.log('[BotEngine] Running post engine...');

        // Fetch data from both sources
        const [trending, gainers] = await Promise.all([
            fetchCoinGeckoTrending(),
            fetchDexScreenerGainers(),
        ]);

        // Merge and deduplicate
        const allTokens = [...trending, ...gainers];
        const seen = new Set<string>();
        const unique = allTokens.filter(t => {
            const key = t.symbol.toUpperCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort by absolute change (most noteworthy first)
        unique.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));

        // Post about the top noteworthy tokens (max 3 per run)
        let postCount = 0;
        for (const token of unique) {
            if (postCount >= MAX_POSTS_PER_RUN) break;
            if (Math.abs(token.change24h) < MIN_PRICE_CHANGE && postCount > 0) break;

            const posted = await createBotPost(token);
            if (posted) postCount++;

            // Small delay between posts to look natural
            if (postCount < MAX_POSTS_PER_RUN) {
                await sleep(2000 + Math.random() * 3000);
            }
        }

        console.log(`[BotEngine] Post engine done: ${postCount} posts created`);
    } catch (err: any) {
        console.error('[BotEngine] Post engine error:', err.message);
    }
}

// ============================================================
// LIKE ENGINE (drip-feed)
// ============================================================

// Track like targets per post
const likeTargets = new Map<string, number>(); // postId -> target like count

/**
 * Determine how many bot likes a post should get.
 */
async function getLikeTarget(post: { id: string; userId: string }): Promise<number> {
    // Check cache
    if (likeTargets.has(post.id)) return likeTargets.get(post.id)!;

    // Check if post belongs to a VIP
    const postUser = await prisma.user.findUnique({
        where: { id: post.userId },
        select: { username: true },
    });

    let target: number;
    if (postUser && VIP_USERNAMES.includes(postUser.username)) {
        // VIP: 90-100 likes
        target = 90 + Math.floor(Math.random() * 11);
    } else {
        // Check if post is from a bot
        const botUsernames = BOT_ACCOUNTS.map(b => b.username);
        if (postUser && botUsernames.includes(postUser.username)) {
            // Bot post: 5-20 likes from other bots
            target = 5 + Math.floor(Math.random() * 16);
        } else {
            // Regular user: random under 30
            target = 3 + Math.floor(Math.random() * 27);
        }
    }

    likeTargets.set(post.id, target);
    return target;
}

/**
 * Main like engine — runs every 5 minutes.
 * Drip-feeds likes on recent posts.
 */
async function runLikeEngine() {
    try {
        // Get posts from the last 24 hours
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentPosts = await prisma.post.findMany({
            where: {
                createdAt: { gte: since },
                visibility: 'public',
            },
            select: { id: true, userId: true, likesCount: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        if (recentPosts.length === 0) return;

        const bots = await getBotUsers();
        if (bots.length === 0) return;

        let totalLikesAdded = 0;

        for (const post of recentPosts) {
            const target = await getLikeTarget(post);

            // Get current bot likes on this post
            const botIds = bots.map(b => b.id);
            const existingLikes = await prisma.like.count({
                where: {
                    postId: post.id,
                    userId: { in: botIds },
                },
            });

            if (existingLikes >= target) continue; // Already hit target

            // Add a few likes this run (drip-feed)
            const remaining = target - existingLikes;
            const toAdd = Math.min(remaining, LIKE_BATCH_SIZE, 1 + Math.floor(Math.random() * LIKE_BATCH_SIZE));

            // Pick random bots who haven't liked yet
            const alreadyLiked = await prisma.like.findMany({
                where: { postId: post.id, userId: { in: botIds } },
                select: { userId: true },
            });
            const alreadyLikedSet = new Set(alreadyLiked.map(l => l.userId));

            // Don't let a bot like its own post
            const eligible = bots.filter(b => !alreadyLikedSet.has(b.id) && b.id !== post.userId);
            if (eligible.length === 0) continue;

            // Shuffle and pick  
            const shuffled = eligible.sort(() => Math.random() - 0.5);
            const selected = shuffled.slice(0, toAdd);

            for (const bot of selected) {
                try {
                    await prisma.like.create({
                        data: { postId: post.id, userId: bot.id },
                    });
                    await prisma.post.update({
                        where: { id: post.id },
                        data: { likesCount: { increment: 1 } },
                    });
                    totalLikesAdded++;
                } catch (err: any) {
                    // Unique constraint = already liked, skip
                    if (err.code !== 'P2002') {
                        console.error('[BotEngine] Like error:', err.message);
                    }
                }
            }
        }

        if (totalLikesAdded > 0) {
            console.log(`[BotEngine] Like engine: +${totalLikesAdded} likes dripped`);
        }
    } catch (err: any) {
        console.error('[BotEngine] Like engine error:', err.message);
    }
}

// ============================================================
// CLEANUP — evict stale like targets
// ============================================================

function cleanupLikeTargets() {
    // Keep map from growing forever — clear entries older than 48h
    // Since we can't easily track age, just clear if map is too large
    if (likeTargets.size > 500) {
        likeTargets.clear();
    }
}

// ============================================================
// INITIALIZATION & CRON SCHEDULING
// ============================================================

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let postInterval: NodeJS.Timeout | null = null;
let likeInterval: NodeJS.Timeout | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Initialize the bot engine:
 * 1. Seed bot accounts (if not exist)
 * 2. Seed follows (all bots → VIPs)  
 * 3. Start post cron (every 30 min)
 * 4. Start like cron (every 5 min)
 */
export async function initBotEngine() {
    try {
        console.log('[BotEngine] Initializing...');

        // Step 1: Seed bot accounts
        const { created, skipped } = await seedBotAccounts();
        console.log(`[BotEngine] Bot accounts: ${created} created, ${skipped} already existed`);

        // Step 2: Seed follows (bots → VIPs)
        const { follows } = await seedBotFollows();
        console.log(`[BotEngine] Bot follows: ${follows} new follows created`);

        // Step 3: Start post engine (every 30 min)
        // Run first one after a 1-minute delay to not slow down server startup
        setTimeout(() => {
            runPostEngine();
        }, 60 * 1000);

        postInterval = setInterval(() => {
            runPostEngine();
        }, POST_INTERVAL_MS);

        // Step 4: Start like engine (every 5 min)
        // Run first one after 2-minute delay
        setTimeout(() => {
            runLikeEngine();
        }, 2 * 60 * 1000);

        likeInterval = setInterval(() => {
            runLikeEngine();
        }, LIKE_INTERVAL_MS);

        // Step 5: Cleanup interval (every hour)
        cleanupInterval = setInterval(() => {
            cleanupLikeTargets();
        }, 60 * 60 * 1000);

        console.log('[BotEngine] Initialized successfully — 100 bots active');
        console.log(`[BotEngine] Post engine: every ${POST_INTERVAL_MS / 60000} min`);
        console.log(`[BotEngine] Like engine: every ${LIKE_INTERVAL_MS / 60000} min`);
    } catch (err: any) {
        console.error('[BotEngine] Initialization failed:', err.message);
    }
}

/**
 * Stop the bot engine (for graceful shutdown).
 */
export function stopBotEngine() {
    if (postInterval) clearInterval(postInterval);
    if (likeInterval) clearInterval(likeInterval);
    if (cleanupInterval) clearInterval(cleanupInterval);
    console.log('[BotEngine] Stopped');
}
