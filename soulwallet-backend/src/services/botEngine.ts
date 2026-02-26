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
const DATA_FETCH_INTERVAL_MS = 30 * 60 * 1000;  // Fetch new data every 30 minutes
const POST_DRIP_INTERVAL_MS = 8 * 60 * 1000;    // Check queue every 8 minutes (drip one post)
const LIKE_INTERVAL_MS = 5 * 60 * 1000;          // Like drip every 5 minutes
const MIN_PRICE_CHANGE = 8;                       // Minimum % change to post about
const MAX_QUEUE_SIZE = 15;                        // Max posts queued at once
const LIKE_BATCH_SIZE = 4;                        // Max likes to add per post per run

// Post queue — posts are queued from data fetch, dripped one at a time
interface QueuedPost {
    type: 'token' | 'news';
    token?: TrendingToken;
    news?: NewsItem;
}
const postQueue: QueuedPost[] = [];

// Track what we've already posted to avoid duplicates
const recentlyPostedTokens = new Map<string, number>();
const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000;

// ============================================================
// DATA SOURCES
// ============================================================

// CryptoPanic API — 3-key rotation for reliability
const CRYPTOPANIC_KEYS = (process.env.CRYPTOPANIC_API_KEYS || '').split(',').filter(Boolean);
let cryptoPanicKeyIndex = 0;

function getNextCryptoPanicKey(): string | null {
    if (CRYPTOPANIC_KEYS.length === 0) return null;
    const key = CRYPTOPANIC_KEYS[cryptoPanicKeyIndex % CRYPTOPANIC_KEYS.length];
    cryptoPanicKeyIndex++;
    return key;
}

interface TrendingToken {
    symbol: string;
    name: string;
    change24h: number;
    volume24h?: number;
    marketCap?: number;
    address?: string;
}

interface NewsItem {
    title: string;
    source: string;
    url: string;
    currencies?: { code: string; title: string }[];
    kind: string;
    sentiment?: string;
    id: number;
}

// Track posted news IDs to avoid duplicates
const postedNewsIds = new Set<number>();

/**
 * Fetch crypto news/social from CryptoPanic (3-key rotation).
 * Returns hot news about major tokens — includes tweets, articles, blog posts.
 */
async function fetchCryptoPanicNews(): Promise<NewsItem[]> {
    const key = getNextCryptoPanicKey();
    if (!key) return [];

    try {
        const res = await axios.get('https://cryptopanic.com/api/v1/posts/', {
            params: {
                auth_token: key,
                filter: 'hot',
                currencies: 'SOL,BTC,ETH,BONK,JUP,WIF,DOGE',
                kind: 'news',
                public: true,
            },
            timeout: 10000,
        });

        const results = res.data?.results || [];
        return results.slice(0, 15).map((item: any) => ({
            title: item.title || '',
            source: item.source?.title || item.domain || 'Unknown',
            url: item.url || '',
            currencies: item.currencies || [],
            kind: item.kind || 'news',
            sentiment: item.votes
                ? (item.votes.positive > item.votes.negative ? 'bullish' : item.votes.negative > item.votes.positive ? 'bearish' : 'neutral')
                : 'neutral',
            id: item.id || 0,
        }));
    } catch (err: any) {
        console.warn('[BotEngine] CryptoPanic fetch failed:', err.message);
        return [];
    }
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
        const solTokens = tokens
            .filter((t: any) => t.chainId === 'solana')
            .slice(0, 10);

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

function wasRecentlyPosted(symbol: string): boolean {
    const lastPosted = recentlyPostedTokens.get(symbol.toUpperCase());
    if (!lastPosted) return false;
    return (Date.now() - lastPosted) < DEDUP_WINDOW_MS;
}

function markAsPosted(symbol: string) {
    recentlyPostedTokens.set(symbol.toUpperCase(), Date.now());
    for (const [key, ts] of recentlyPostedTokens) {
        if (Date.now() - ts > DEDUP_WINDOW_MS) {
            recentlyPostedTokens.delete(key);
        }
    }
}

function pickTierForEvent(change: number): BotTier {
    const absChange = Math.abs(change);
    if (absChange >= 30) {
        const tiers: BotTier[] = ['lurker', 'degen', 'analyst'];
        return tiers[Math.floor(Math.random() * tiers.length)];
    } else if (absChange >= 15) {
        const tiers: BotTier[] = ['analyst', 'degen', 'og'];
        return tiers[Math.floor(Math.random() * tiers.length)];
    } else {
        const tiers: BotTier[] = ['degen', 'vibes', 'analyst', 'og'];
        return tiers[Math.floor(Math.random() * tiers.length)];
    }
}

/**
 * Create a bot post from real market data (price moves).
 */
async function createBotPost(token: TrendingToken): Promise<boolean> {
    try {
        if (wasRecentlyPosted(token.symbol)) return false;

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
                tokenAddress: null,
                tokenSymbol: null,
                tokenName: null,
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

/**
 * Create a bot post from a CryptoPanic news item.
 * These are real headlines from crypto media — tweets, articles, etc.
 */
async function createNewsPost(news: NewsItem): Promise<boolean> {
    try {
        if (postedNewsIds.has(news.id)) return false;

        // Pick tier based on sentiment
        const tierOptions: BotTier[] = news.sentiment === 'bullish'
            ? ['degen', 'vibes', 'analyst']
            : news.sentiment === 'bearish'
                ? ['analyst', 'og', 'lurker']
                : ['analyst', 'og', 'vibes'];
        const tier = tierOptions[Math.floor(Math.random() * tierOptions.length)];
        const bot = await getRandomBot(tier);
        if (!bot) return false;

        // Build human-like news post
        const template = getRandomTemplate(tier, 'trending');
        const content = fillTemplate(template, { headline: news.title });

        const currency = news.currencies?.[0];

        await prisma.post.create({
            data: {
                userId: bot.id,
                content,
                visibility: 'public',
                tokenAddress: null,
                tokenSymbol: null,
                tokenName: null,
                tokenVerified: false,
                tokenPriceAtPost: null,
            },
        });

        postedNewsIds.add(news.id);
        // Prevent set from growing forever
        if (postedNewsIds.size > 500) {
            const oldest = [...postedNewsIds].slice(0, 200);
            oldest.forEach(id => postedNewsIds.delete(id));
        }

        console.log(`[BotEngine] ${bot.username} posted news: "${news.title.substring(0, 60)}..."`);
        return true;
    } catch (err: any) {
        console.error('[BotEngine] News post creation failed:', err.message);
        return false;
    }
}

function formatVolume(vol: number): string {
    if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
    return vol.toFixed(0);
}

/**
 * Data fetch — runs every 30 min. Fills the post queue.
 */
async function runDataFetch() {
    try {
        console.log('[BotEngine] Fetching data...');

        const [news, trending, gainers] = await Promise.all([
            fetchCryptoPanicNews(),
            fetchCoinGeckoTrending(),
            fetchDexScreenerGainers(),
        ]);

        // Queue news items (highest priority)
        const unseenNews = news.filter(n => !postedNewsIds.has(n.id));
        for (const item of unseenNews.slice(0, 5)) {
            if (postQueue.length < MAX_QUEUE_SIZE) {
                postQueue.push({ type: 'news', news: item });
            }
        }

        // Queue token posts
        const allTokens = [...trending, ...gainers];
        const seen = new Set<string>();
        const unique = allTokens.filter(t => {
            const key = t.symbol.toUpperCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        unique.sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h));

        for (const token of unique) {
            if (postQueue.length >= MAX_QUEUE_SIZE) break;
            if (Math.abs(token.change24h) < MIN_PRICE_CHANGE) continue;
            if (wasRecentlyPosted(token.symbol)) continue;
            postQueue.push({ type: 'token', token });
        }

        console.log(`[BotEngine] Data fetch done: queue has ${postQueue.length} items (${news.length} news, ${trending.length} trending, ${gainers.length} gainers)`);
    } catch (err: any) {
        console.error('[BotEngine] Data fetch error:', err.message);
    }
}

/**
 * Post drip — runs every 6-10 min. Pops one post from queue and publishes it.
 * This creates natural staggering between bot posts.
 */
async function runPostDrip() {
    try {
        if (postQueue.length === 0) return;

        const item = postQueue.shift()!;
        let posted = false;

        if (item.type === 'news' && item.news) {
            posted = await createNewsPost(item.news);
        } else if (item.type === 'token' && item.token) {
            posted = await createBotPost(item.token);
        }

        if (posted) {
            console.log(`[BotEngine] Dripped 1 post (${postQueue.length} remaining in queue)`);
        }
    } catch (err: any) {
        console.error('[BotEngine] Post drip error:', err.message);
    }

    // Schedule next drip with random 5-15 min jitter for organic feel
    const jitter = (5 * 60 * 1000) + Math.random() * (10 * 60 * 1000); // 5-15 min
    setTimeout(() => runPostDrip(), jitter);
}

// ============================================================
// LIKE ENGINE (drip-feed)
// ============================================================

const likeTargets = new Map<string, number>();

async function getLikeTarget(post: { id: string; userId: string }): Promise<number> {
    if (likeTargets.has(post.id)) return likeTargets.get(post.id)!;

    const postUser = await prisma.user.findUnique({
        where: { id: post.userId },
        select: { username: true },
    });

    let target: number;
    if (postUser && VIP_USERNAMES.includes(postUser.username)) {
        target = 90 + Math.floor(Math.random() * 11); // 90-100
    } else {
        const botUsernames = BOT_ACCOUNTS.map(b => b.username);
        if (postUser && botUsernames.includes(postUser.username)) {
            target = 5 + Math.floor(Math.random() * 16); // 5-20
        } else {
            target = 3 + Math.floor(Math.random() * 27); // 3-29
        }
    }

    likeTargets.set(post.id, target);
    return target;
}

async function runLikeEngine() {
    try {
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

            const botIds = bots.map(b => b.id);
            const existingLikes = await prisma.like.count({
                where: {
                    postId: post.id,
                    userId: { in: botIds },
                },
            });

            if (existingLikes >= target) continue;

            const remaining = target - existingLikes;
            const toAdd = Math.min(remaining, LIKE_BATCH_SIZE, 1 + Math.floor(Math.random() * LIKE_BATCH_SIZE));

            const alreadyLiked = await prisma.like.findMany({
                where: { postId: post.id, userId: { in: botIds } },
                select: { userId: true },
            });
            const alreadyLikedSet = new Set(alreadyLiked.map(l => l.userId));

            const eligible = bots.filter(b => !alreadyLikedSet.has(b.id) && b.id !== post.userId);
            if (eligible.length === 0) continue;

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
// CLEANUP
// ============================================================

function cleanupLikeTargets() {
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

let dataFetchInterval: NodeJS.Timeout | null = null;
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

        // Step 3: Start data fetch (every 30 min, first run after 1 min)
        setTimeout(() => {
            runDataFetch();
        }, 60 * 1000);

        dataFetchInterval = setInterval(() => {
            runDataFetch();
        }, DATA_FETCH_INTERVAL_MS);

        // Step 4: Start post drip (first one after 3 min, then self-scheduling with random gaps)
        setTimeout(() => {
            runPostDrip();
        }, 3 * 60 * 1000);

        // Step 5: Start like engine (every 5 min, first run after 2 min)
        setTimeout(() => {
            runLikeEngine();
        }, 2 * 60 * 1000);

        likeInterval = setInterval(() => {
            runLikeEngine();
        }, LIKE_INTERVAL_MS);

        // Step 6: Cleanup interval (every hour)
        cleanupInterval = setInterval(() => {
            cleanupLikeTargets();
        }, 60 * 60 * 1000);

        console.log('[BotEngine] Initialized successfully — 100 bots active');
        console.log(`[BotEngine] Data fetch: every ${DATA_FETCH_INTERVAL_MS / 60000} min | Sources: CryptoPanic (${CRYPTOPANIC_KEYS.length} keys), CoinGecko, DexScreener`);
        console.log(`[BotEngine] Post drip: every 5-15 min (random gaps) | Target: 6-10 posts/hr`);
        console.log(`[BotEngine] Like engine: every ${LIKE_INTERVAL_MS / 60000} min`);
    } catch (err: any) {
        console.error('[BotEngine] Initialization failed:', err.message);
    }
}

/**
 * Stop the bot engine (for graceful shutdown).
 */
export function stopBotEngine() {
    if (dataFetchInterval) clearInterval(dataFetchInterval);
    if (likeInterval) clearInterval(likeInterval);
    if (cleanupInterval) clearInterval(cleanupInterval);
    console.log('[BotEngine] Stopped');
}
