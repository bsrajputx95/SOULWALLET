import prisma from '../db';
import bcrypt from 'bcryptjs';

// ============================================================
// BOT ACCOUNT DEFINITIONS — 100 bots across 5 personality tiers
// ============================================================

export type BotTier = 'degen' | 'analyst' | 'og' | 'lurker' | 'vibes';

export interface BotAccount {
    username: string;
    tier: BotTier;
}

// VIP accounts that all bots must follow & always max-like
export const VIP_USERNAMES = ['bhavanisingh', 'soulwallet'];

// 100 bot accounts — crypto Twitter-style names
export const BOT_ACCOUNTS: BotAccount[] = [
    // ── Degens (20) — excited, slang-heavy, emojis ──
    { username: 'cupseee', tier: 'degen' },
    { username: '0xrekt', tier: 'degen' },
    { username: 'solmonk', tier: 'degen' },
    { username: 'chaindrift', tier: 'degen' },
    { username: 'ngmi_chad', tier: 'degen' },
    { username: 'degenvault', tier: 'degen' },
    { username: 'apein_larry', tier: 'degen' },
    { username: 'rugproof_', tier: 'degen' },
    { username: 'bagholder99', tier: 'degen' },
    { username: 'ser_pump', tier: 'degen' },
    { username: 'flipmode_', tier: 'degen' },
    { username: 'fomo_king', tier: 'degen' },
    { username: 'degen_szn', tier: 'degen' },
    { username: 'onchain_ape', tier: 'degen' },
    { username: 'wagmi_dan', tier: 'degen' },
    { username: 'yolo_trades', tier: 'degen' },
    { username: 'sol_degen', tier: 'degen' },
    { username: 'memecoin_mike', tier: 'degen' },
    { username: 'rekt_but_ok', tier: 'degen' },
    { username: 'pumpchaser_', tier: 'degen' },

    // ── Analysts (20) — data-driven, charts, numbers ──
    { username: 'onchain_kai', tier: 'analyst' },
    { username: 'blockpulse', tier: 'analyst' },
    { username: 'chartsonly_', tier: 'analyst' },
    { username: 'macro_monk', tier: 'analyst' },
    { username: 'data_drip', tier: 'analyst' },
    { username: 'volume_watch', tier: 'analyst' },
    { username: 'depth_chart', tier: 'analyst' },
    { username: 'flow_tracker', tier: 'analyst' },
    { username: 'orderbook_og', tier: 'analyst' },
    { username: 'metrics_guy', tier: 'analyst' },
    { username: 'signal_lab', tier: 'analyst' },
    { username: 'chain_scope', tier: 'analyst' },
    { username: 'ratio_check', tier: 'analyst' },
    { username: 'onchain_intel', tier: 'analyst' },
    { username: 'pattern_read', tier: 'analyst' },
    { username: 'quant_view', tier: 'analyst' },
    { username: 'market_pulse', tier: 'analyst' },
    { username: 'alpha_metrics', tier: 'analyst' },
    { username: 'stat_trader', tier: 'analyst' },
    { username: 'whale_flow', tier: 'analyst' },

    // ── OGs (20) — experienced, calm, wise ──
    { username: 'satoshi_stan', tier: 'og' },
    { username: 'early_exit', tier: 'og' },
    { username: 'bag_secured', tier: 'og' },
    { username: 'diamond_grips', tier: 'og' },
    { username: 'yieldmaxi', tier: 'og' },
    { username: 'cycle_vet', tier: 'og' },
    { username: 'hodl_sage', tier: 'og' },
    { username: 'bear_survivor', tier: 'og' },
    { username: 'old_wallet', tier: 'og' },
    { username: 'stack_steady', tier: 'og' },
    { username: 'long_game', tier: 'og' },
    { username: 'quiet_gains', tier: 'og' },
    { username: 'patience_pays', tier: 'og' },
    { username: 'been_here', tier: 'og' },
    { username: 'floor_holder', tier: 'og' },
    { username: 'no_leverage', tier: 'og' },
    { username: 'cold_storage', tier: 'og' },
    { username: 'smart_money_', tier: 'og' },
    { username: 'risk_managed', tier: 'og' },
    { username: 'compound_king', tier: 'og' },

    // ── Lurkers (20) — very rare posts, only major events ──
    { username: 'silent_whale', tier: 'lurker' },
    { username: 'ghost_alpha', tier: 'lurker' },
    { username: 'shadow_bid', tier: 'lurker' },
    { username: 'quiet_ape', tier: 'lurker' },
    { username: 'stealth_entry', tier: 'lurker' },
    { username: 'deep_watch', tier: 'lurker' },
    { username: 'rare_signal', tier: 'lurker' },
    { username: 'unseen_move', tier: 'lurker' },
    { username: 'dark_pool_', tier: 'lurker' },
    { username: 'hidden_hand', tier: 'lurker' },
    { username: 'zero_noise', tier: 'lurker' },
    { username: 'last_to_post', tier: 'lurker' },
    { username: 'once_a_week', tier: 'lurker' },
    { username: 'background_', tier: 'lurker' },
    { username: 'low_profile', tier: 'lurker' },
    { username: 'watch_only', tier: 'lurker' },
    { username: 'no_fud_', tier: 'lurker' },
    { username: 'real_ones', tier: 'lurker' },
    { username: 'signal_only', tier: 'lurker' },
    { username: 'rarely_wrong', tier: 'lurker' },

    // ── Vibes (20) — fun, meme-y, community feel ──
    { username: 'sol_summer', tier: 'vibes' },
    { username: 'pump_poet', tier: 'vibes' },
    { username: 'moon_diary', tier: 'vibes' },
    { username: 'green_candle', tier: 'vibes' },
    { username: 'hopium_dealer', tier: 'vibes' },
    { username: 'vibes_only_', tier: 'vibes' },
    { username: 'crypto_mood', tier: 'vibes' },
    { username: 'bullish_aura', tier: 'vibes' },
    { username: 'gm_everyday', tier: 'vibes' },
    { username: 'wen_lambo_', tier: 'vibes' },
    { username: 'chart_poet', tier: 'vibes' },
    { username: 'feel_the_pump', tier: 'vibes' },
    { username: 'good_entry', tier: 'vibes' },
    { username: 'trust_the_bag', tier: 'vibes' },
    { username: 'candle_watcher', tier: 'vibes' },
    { username: 'zen_trader', tier: 'vibes' },
    { username: 'just_vibin_', tier: 'vibes' },
    { username: 'happy_hodler', tier: 'vibes' },
    { username: 'sunrise_sol', tier: 'vibes' },
    { username: 'chill_gains', tier: 'vibes' },
];

// ============================================================
// POST TEMPLATES — per personality tier
// Placeholders: {token}, {symbol}, {change}, {volume}, {headline}
// ============================================================

export const POST_TEMPLATES: Record<BotTier, string[]> = {
    degen: [
        'bro ${symbol} just ripped ${change}% while i was sleeping 😭',
        '${symbol} pumping and i\'m sitting on the sidelines. pain fr',
        'ok who else aped into ${symbol} at +${change}%? just me? 🫡',
        '${symbol} going crazy rn. this is why i don\'t close my charts 📈',
        'lmao ${symbol} really said "you should\'ve bought yesterday" 💀',
        'ngmi if you\'re not watching ${symbol} right now. volume is insane',
        'i literally sold ${symbol} last week. watching it pump ${change}% now. cool cool cool 🙃',
        '${symbol} casually doing ${change}% while BTC is flat. memecoins are undefeated',
        'ser... ${symbol} volume just 3x\'d. something is cooking 👀',
        'woke up to ${symbol} at +${change}%. today is a good day 🔥',
    ],
    analyst: [
        '${symbol} volume spiked ${change}% in the last hour. worth monitoring — could signal accumulation 📊',
        'interesting pattern on ${symbol} — volume rising but price consolidating. someone\'s building a position',
        '${symbol} just broke a key resistance with ${change}% move. watching for confirmation on the next candle',
        'on-chain data shows significant ${symbol} accumulation. smart money has been loading quietly',
        '${symbol} at +${change}% with rising volume confirms the trend. key level to watch next 📈',
        'the ${symbol} order flow has shifted bullish — bid depth 2x what it was yesterday',
        '${symbol} volume-to-mcap ratio just hit levels we haven\'t seen in weeks. keeping this on close watch',
        'notable: ${symbol} making a ${change}% move while broader market is flat. divergence worth tracking',
        '${symbol} just reclaimed its 20-day moving average with conviction. volume confirms 📊',
        'significant wallet activity on ${symbol} detected. on-chain metrics turning bullish',
    ],
    og: [
        '${symbol} at +${change}%. seen this setup before — usually has more room to run. not financial advice',
        'been in crypto long enough to know when ${symbol} moves like this, you pay attention',
        '${symbol} doing its thing. if you know, you know. patience always wins',
        'remember when everyone was bearish on ${symbol}? +${change}% later... narratives change fast',
        'the ${symbol} move is interesting but i\'m more focused on the fundamentals. short term noise',
        '${symbol} at these levels is what we waited for last cycle. not making the same mistake twice',
        '+${change}% on ${symbol}. nice. but the real move hasn\'t started yet imo',
        '${symbol} showing strength. accumulating during the dips always pays off eventually',
        'every cycle has a ${symbol} moment. we might be in one',
        'watching ${symbol} closely. the smart money moved in weeks ago — we\'re just seeing the result now',
    ],
    lurker: [
        'don\'t post often but ${symbol} at +${change}% is worth noting. last time this happened was right before a major move',
        'breaking my silence for this — ${symbol} is doing something i haven\'t seen in months 👀',
        'i only post when something actually matters. ${symbol} right now qualifies',
        'rare post. ${symbol} just hit a level that historically triggers massive runs. watching carefully',
        '${symbol} at +${change}%. haven\'t been this interested in a setup in weeks',
        'this ${symbol} move is different from the usual pump and dump. on-chain backs it up',
        'coming out of lurk mode for ${symbol}. the volume profile is genuinely unusual',
        'i watch everything and post almost nothing. ${symbol} right now is an exception. +${change}%',
    ],
    vibes: [
        '${symbol} up ${change}% and the vibes are immaculate today ☀️',
        'good morning to ${symbol} holders only 🫡 +${change}%',
        '${symbol} really said "trust the process" and delivered 🚀',
        'the energy around ${symbol} right now is unmatched. +${change}% and climbing',
        'manifested this ${symbol} pump. you\'re welcome 🧘‍♂️✨',
        'portfolio green, weather\'s nice, ${symbol} pumping. today is a vibe 💚',
        '${symbol} carrying my whole portfolio rn ngl 😅 +${change}%',
        'sending good energy to all ${symbol} holders. we ride at dawn 🌅',
        '${symbol} +${change}% — the universe is bullish fr',
        'not sure what\'s happening with ${symbol} but i like it 📈💜',
    ],
};

// ── Trending / news templates (no token-specific data needed) ──
export const TRENDING_TEMPLATES: Record<BotTier, string[]> = {
    degen: [
        '${headline} — bullish or bearish? i\'m going full degen on this one 🔥',
        'just saw this: ${headline}. if you know, you know. aping in',
        '${headline}. everyone panicking but this is literally the buy signal 😤',
    ],
    analyst: [
        '${headline} — this could have significant implications for the broader market. watching closely 📊',
        'worth noting: ${headline}. let\'s see how order flow reacts over the next few hours',
        '${headline}. the data will tell us more than the headline. staying objective',
    ],
    og: [
        '${headline}. seen similar situations play out before. patience is key here',
        '${headline} — interesting development. the market will sort itself out. it always does',
        '${headline}. not the first time, won\'t be the last. stay focused on fundamentals',
    ],
    lurker: [
        'rare post. ${headline}. this is actually significant and most people won\'t realize until later',
        'breaking silence because: ${headline}. pay attention to this one',
    ],
    vibes: [
        '${headline}. bullish energy today ☀️ let\'s see where this goes',
        '${headline} — good vibes or bad vibes? i\'m choosing good vibes always 💜',
        'woke up to ${headline}. crypto never sleeps and neither do i apparently 😅',
    ],
};

// ============================================================
// SEED FUNCTIONS
// ============================================================

const BOT_PASSWORD_HASH = '$2a$10$BotAccountNoLoginAllowed000000000000000000000000000000';

/**
 * Create all 100 bot accounts in the database.
 * Skips any that already exist (by username).
 */
export async function seedBotAccounts(): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    // Pre-hash a dummy password (bots never login via API)
    const hashedPassword = await bcrypt.hash('bot_no_login_' + Date.now(), 10);

    for (const bot of BOT_ACCOUNTS) {
        try {
            const existing = await prisma.user.findUnique({ where: { username: bot.username } });
            if (existing) {
                skipped++;
                continue;
            }

            await prisma.user.create({
                data: {
                    username: bot.username,
                    email: `${bot.username}@soulwallet.bot`,
                    password: hashedPassword,
                    profileImage: null, // No profile image for now
                },
            });
            created++;
        } catch (err: any) {
            // Unique constraint violation = already exists
            if (err.code === 'P2002') {
                skipped++;
            } else {
                console.error(`[BotSeed] Failed to create ${bot.username}:`, err.message);
            }
        }
    }

    console.log(`[BotSeed] Done: ${created} created, ${skipped} skipped`);
    return { created, skipped };
}

/**
 * Make all 100 bots follow the VIP accounts (@bhavanisingh, @soulwallet).
 * Also updates follower/following counters.
 */
export async function seedBotFollows(): Promise<{ follows: number }> {
    let follows = 0;

    // Find VIP user IDs
    const vipUsers = await prisma.user.findMany({
        where: { username: { in: VIP_USERNAMES } },
        select: { id: true, username: true },
    });

    if (vipUsers.length === 0) {
        console.warn('[BotSeed] No VIP users found. Skipping follows.');
        return { follows: 0 };
    }

    // Find all bot user IDs
    const botUsernames = BOT_ACCOUNTS.map(b => b.username);
    const botUsers = await prisma.user.findMany({
        where: { username: { in: botUsernames } },
        select: { id: true, username: true },
    });

    for (const vip of vipUsers) {
        for (const bot of botUsers) {
            try {
                // Check if already following
                const existing = await prisma.follow.findFirst({
                    where: { followerId: bot.id, followingId: vip.id },
                });
                if (existing) continue;

                await prisma.follow.create({
                    data: { followerId: bot.id, followingId: vip.id },
                });

                // Update counters
                await prisma.user.update({
                    where: { id: vip.id },
                    data: { followers: { increment: 1 } },
                });
                await prisma.user.update({
                    where: { id: bot.id },
                    data: { following: { increment: 1 } },
                });

                follows++;
            } catch (err: any) {
                // Unique constraint = already following
                if (err.code !== 'P2002') {
                    console.error(`[BotSeed] Follow error ${bot.username} -> ${vip.username}:`, err.message);
                }
            }
        }
    }

    console.log(`[BotSeed] Follows created: ${follows}`);
    return { follows };
}

/**
 * Get all bot user IDs from the database (cached for performance).
 */
let cachedBotIds: { id: string; username: string; tier: BotTier }[] | null = null;

export async function getBotUsers(): Promise<{ id: string; username: string; tier: BotTier }[]> {
    if (cachedBotIds) return cachedBotIds;

    const botUsernames = BOT_ACCOUNTS.map(b => b.username);
    const users = await prisma.user.findMany({
        where: { username: { in: botUsernames } },
        select: { id: true, username: true },
    });

    cachedBotIds = users.map(u => {
        const bot = BOT_ACCOUNTS.find(b => b.username === u.username)!;
        return { id: u.id, username: u.username, tier: bot.tier };
    });

    return cachedBotIds;
}

/**
 * Get a random bot from a specific tier, or any tier if not specified.
 */
export async function getRandomBot(tier?: BotTier): Promise<{ id: string; username: string; tier: BotTier } | null> {
    const bots = await getBotUsers();
    const filtered = tier ? bots.filter(b => b.tier === tier) : bots;
    if (filtered.length === 0) return null;
    return filtered[Math.floor(Math.random() * filtered.length)];
}

/**
 * Get a random post template for a given tier.
 */
export function getRandomTemplate(tier: BotTier, type: 'token' | 'trending' = 'token'): string {
    const templates = type === 'trending' ? TRENDING_TEMPLATES[tier] : POST_TEMPLATES[tier];
    return templates[Math.floor(Math.random() * templates.length)];
}

/**
 * Fill template placeholders with real data.
 */
export function fillTemplate(template: string, data: { symbol?: string; change?: string; volume?: string; headline?: string }): string {
    let result = template;
    if (data.symbol) result = result.replace(/\$\{symbol\}/g, `$${data.symbol}`);
    if (data.change) result = result.replace(/\$\{change\}/g, data.change);
    if (data.volume) result = result.replace(/\$\{volume\}/g, data.volume);
    if (data.headline) result = result.replace(/\$\{headline\}/g, data.headline);
    return result;
}
