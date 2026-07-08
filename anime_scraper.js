const dns = require('dns');
const crypto = require('crypto');
const cheerio = require('cheerio');
const { ANIME } = require('@consumet/extensions');

// Disable TLS reject unauthorized warning
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// 1. Set DNS servers to Cloudflare and Google to bypass local ISP blocks
try {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
} catch (e) {
  // Ignore DNS set errors
}

// 2. Patch dns.lookup to bypass local OS host resolution blocks
const originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  let cb = callback;
  let opts = options;
  if (typeof options === 'function') {
    cb = options;
    opts = {};
  }
  
  dns.resolve4(hostname, (err, addresses) => {
    if (err || !addresses || addresses.length === 0) {
      return originalLookup(hostname, opts, cb);
    }
    
    if (opts && opts.all) {
      const results = addresses.map(addr => ({ address: addr, family: 4 }));
      return cb(null, results);
    } else {
      return cb(null, addresses[0], 4);
    }
  });
};

// ---------------------------------------------------------------------------
// POW Captcha Solver Implementation for weneverbeenfree.com (BYFMS)
// ---------------------------------------------------------------------------
const be = 512;
const lt = be - 1;
const dr = 2;
const lr = 2654435761;
const hr = 2246822519;
const re = (t, e) => (t << e | t >>> 32 - e) >>> 0;
const ht = (t, e) => Math.imul(t, e) >>> 0;

function ye(t) {
    t[0] = t[0] + t[1] >>> 0;
    t[3] = re(t[3] ^ t[0], 16);
    t[2] = t[2] + t[3] >>> 0;
    t[1] = re(t[1] ^ t[2], 12);
    t[0] = t[0] + t[1] >>> 0;
    t[3] = re(t[3] ^ t[0], 8);
    t[2] = t[2] + t[3] >>> 0;
    t[1] = re(t[1] ^ t[2], 7);
}

function gr(t) {
    const e = new Uint32Array([1779033703, 3144134277, 1013904242, 2773480762]);
    for (let i = 0; i < t.length; i++) {
        e[0] = e[0] + t[i] >>> 0;
        e[0] = re(e[0], 7);
        ye(e);
    }
    for (let i = 0; i < 8; i++) ye(e);
    const r = new Uint32Array(be);
    for (let i = 0; i < be; i++) {
        ye(e);
        r[i] = (e[0] ^ e[2]) >>> 0;
    }
    for (let i = 0; i < dr; i++) {
        for (let s = 0; s < be; s++) {
            const a = r[s] & lt;
            let c = r[s] + r[a] >>> 0;
            c = re(c, 13);
            c = (c ^ ht(r[(s + 1) & lt], lr)) >>> 0;
            r[s] = c;
            e[0] = (e[0] ^ c) >>> 0;
            ye(e);
        }
    }
    const n = new Uint32Array(8);
    const o = be / 8;
    for (let i = 0; i < 8; i++) {
        ye(e);
        let s = e[0];
        const a = i * o;
        for (let c = 0; c < o; c++) {
            const d = r[a + c];
            s = s + d >>> 0;
            s = re(s, 5);
            s = (s ^ ht(d, hr)) >>> 0;
        }
        n[i] = (s ^ e[2]) >>> 0;
    }
    return n;
}

function wr(t) {
    let e = 0;
    for (let r = 0; r < t.length; r++) {
        const n = t[r];
        if (n === 0) {
            e += 32;
            continue;
        }
        return e + Math.clz32(n);
    }
    return e;
}

function yr(t) {
    const e = new Uint8Array(t.length);
    for (let r = 0; r < t.length; r++) {
        e[r] = t.charCodeAt(r) & 255;
    }
    return e;
}

const pr = () => new Promise(t => { setTimeout(t, 0) });

async function Er(t, e, r = 20000) {
    if (e <= 0) return "0";
    const o = t + ":";
    const i = Date.now();
    let s = 0;
    const a = 1024;
    for (; ;) {
        for (let c = 0; c < a; c++) {
            const d = gr(yr(o + s));
            if (wr(d) >= e) return String(s);
            s++;
        }
        if (Date.now() - i > r) return null;
        await pr();
    }
}

function base64urlDecode(str) {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4 === 0 ? 0 : 4 - base64.length % 4;
    return Buffer.from(base64 + '='.repeat(pad), 'base64');
}

// ---------------------------------------------------------------------------
// BYFMS Video Stream Extractor
// ---------------------------------------------------------------------------
async function extractByse(client, iframeUrl) {
    const embedUrl = new URL(iframeUrl);
    const host = embedUrl.origin;
    const pathParts = embedUrl.pathname.split('/');
    const fileCode = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
    
    const requestHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': iframeUrl,
        'Origin': host,
        'X-Embed-Origin': 'hianimes.ru',
        'X-Embed-Referer': 'https://hianimes.ru/',
        'X-Embed-Parent': iframeUrl,
        'Content-Type': 'application/json'
    };
    
    // 1. Get captcha details
    const captchaRes = await client.post(`${host}/api/videos/${fileCode}/embed/captcha`, {}, { headers: requestHeaders });
    const captchaData = captchaRes.data;
    const nonce = captchaData.pow_nonce;
    const difficulty = captchaData.pow_difficulty;
    const token = captchaData.pow_token;
    
    // 2. Solve POW challenge
    const solution = await Er(nonce, difficulty);
    if (!solution) throw new Error("POW solver failed");
    
    // 3. Verify captcha
    const verifyRes = await client.post(`${host}/api/videos/${fileCode}/embed/captcha/verify`, {
        pow_token: token,
        solution: solution
    }, { headers: requestHeaders });
    
    const verifyData = verifyRes.data;
    if (verifyData.status !== 'ok' || !verifyData.token) {
        throw new Error("Captcha verification failed");
    }
    
    // 4. Request Playback Config
    requestHeaders['X-Captcha-Token'] = verifyData.token;
    const dummyFingerprint = {
        token: "0.2222222222222222:1234567890123:dummy_fingerprint_token_for_validation",
        viewer_id: "00000000-0000-0000-0000-000000000000",
        device_id: "00000000-0000-0000-0000-000000000000",
        confidence: 0.95
    };
    
    const playbackRes = await client.post(`${host}/api/videos/${fileCode}/embed/playback`, {
        fingerprint: dummyFingerprint
    }, { headers: requestHeaders });
    
    const playback = playbackRes.data.playback;
    if (!playback) {
        throw new Error("Failed to retrieve playback data from server");
    }
    
    // 5. Decrypt Playback payload
    const versionNum = parseInt(playback.version, 10);
    const index1 = versionNum ^ 0;
    const index2 = 31 - versionNum ^ 0;
    
    const keyBuf1 = base64urlDecode(playback.key_parts[index1 - 1]);
    const keyBuf2 = base64urlDecode(playback.key_parts[index2 - 1]);
    const key = Buffer.concat([keyBuf1, keyBuf2]);
    
    const iv = base64urlDecode(playback.iv);
    const payload = base64urlDecode(playback.payload);
    
    const tagLength = 16;
    const ciphertext = payload.subarray(0, payload.length - tagLength);
    const tag = payload.subarray(payload.length - tagLength);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(ciphertext, null, 'utf8');
    decrypted += decipher.final('utf8');
    
    const config = JSON.parse(decrypted);
    
    return {
        headers: {
            'Referer': host + '/'
        },
        sources: config.sources.map(s => ({
            url: s.url,
            isM3U8: s.mime_type === 'application/vnd.apple.mpegurl',
            quality: s.label
        })),
        subtitles: (config.tracks || []).map(t => ({
            url: t.file,
            lang: t.label,
            label: t.label,
            kind: t.kind,
            default: t.default
        }))
    };
}

// ---------------------------------------------------------------------------
// Custom HianimesRu Scraper Class
// ---------------------------------------------------------------------------
class HianimesRu extends ANIME.Hianime {
    constructor(baseUrl = 'https://hianimes.ru') {
        super();
        this.baseUrl = baseUrl;
        
        // Re-assign arrow functions on the instance to override them
        this.scrapeCard = this.customScrapeCard.bind(this);
        this.fetchAnimeInfo = this.customFetchAnimeInfo.bind(this);
        this.fetchEpisodeSources = this.customFetchEpisodeSources.bind(this);
    }

    async fetchHome() {
        const fetch = require('node-fetch') || globalThis.fetch;
        const cheerio = require('cheerio');
        const res = await fetch(`${this.baseUrl}/home`);
        const html = await res.text();
        const $ = cheerio.load(html);
        
        const parseList = (selector) => {
            const list = [];
            $(selector).each((i, el) => {
                const card = $(el);
                const title = card.find('.film-name, .dynamic-name').text().trim();
                let id = card.find('a').first().attr('href') || '';
                id = id.replace(/^\/+/, '').split('?')[0]; // strip leading slash
                const poster = card.find('img').attr('data-src') || card.find('img').attr('src');
                const epsInfo = card.find('.tick-sub, .tick-dub, .tick-eps').text().replace(/\s+/g, ' ').trim();
                if (id && title) {
                    list.push({ id, title, poster, epsInfo });
                }
            });
            return list;
        };

        const spotlight = [];
        $('.deslide-item').each((i, el) => {
            const card = $(el);
            const title = card.find('.desi-head-title').text().trim();
            let id = card.find('.desi-buttons a').attr('href') || '';
            id = id.replace(/^\/watch\//, '').replace(/^\/+/, '').split('?')[0];
            const poster = card.find('img.film-poster-img').attr('data-src') || card.find('img').attr('src');
            const description = card.find('.desi-description').text().trim();
            if (id && title) {
                spotlight.push({ id, title, poster, description });
            }
        });

        let schedule = [];
        try {
            const acRes = await fetch('https://animecountdown.com/');
            const acHtml = await acRes.text();
            const $ac = cheerio.load(acHtml);
            $ac('.countdown-content-main-columns-column-items-item').slice(0, 12).each((i, el) => {
                const item = $ac(el);
                const title = item.find('countdown-content-main-columns-column-items-item-right-title').text().trim();
                const ep = item.find('countdown-content-main-columns-column-items-item-right-episode').text().trim();
                const timeStr = item.find('countdown-content-main-columns-column-items-item-right-countdown').attr('data-time');
                if (title && timeStr) {
                    const timestamp = Date.now() + parseInt(timeStr, 10) * 1000;
                    schedule.push({ time: timestamp, title, ep, id: '' });
                }
            });
        } catch (e) {
            console.error("AnimeCountdown schedule fetch failed", e);
        }

        return {
            spotlight,
            schedule,
            trending: parseList('#anime-trending .item'),
            topAiring: parseList('#top-viewed-day ul li'),
            mostPopular: parseList('#top-viewed-week ul li'),
            mostFavorite: parseList('#top-viewed-month ul li'),
            latestCompleted: parseList('.film_list-wrap .flw-item').slice(0, 10),
            latestEpisode: parseList('.film_list-wrap .flw-item')
        };
    }

    search(query, page = 1) {
        if (0 >= page) {
            page = 1;
        }
        const searchUrl = `${this.baseUrl}/filter?keyword=${encodeURIComponent(query)}&page=${page}`;
        return this.scrapeCardPage(searchUrl);
    }

    async customScrapeCard($) {
        try {
            const results = [];
            $('.flw-item').each((i, ele) => {
                try {
                    const card = $(ele);
                    // Use film-poster-ahref to bypass malformed a href in film-name
                    const posterAh = card.find('.film-poster-ahref');
                    const atag = card.find('.film-name a');
                    const href = posterAh.attr('href') || atag.attr('href');
                    if (!href) return;
                    
                    const id = href.split('/').filter(Boolean).pop().split('?')[0];
                    if (!id) return;
                    
                    const type = card.find('.fdi-item').first()?.text().replace(' (? eps)', '').replace(/\s\(\d+ eps\)/g, '');
                    results.push({
                        id: id,
                        title: atag.text().trim() || posterAh.attr('title') || '',
                        url: `${this.baseUrl}/info/${id}`,
                        image: card.find('img').attr('data-src') || card.find('img').attr('src'),
                        duration: card.find('.fdi-duration').text(),
                        watchList: 'none',
                        japaneseTitle: atag.attr('data-jname') || '',
                        type: type,
                        nsfw: card.find('.tick-rate').text() === '18+',
                        sub: parseInt(card.find('.tick-item.tick-sub').text()) || 0,
                        dub: parseInt(card.find('.tick-item.tick-dub').text()) || 0,
                        episodes: parseInt(card.find('.tick-item.tick-eps').text()) || 0,
                    });
                } catch (cardErr) {
                    // Ignore card error
                }
            });
            return results;
        } catch (err) {
            throw new Error('Something went wrong: ' + err.message);
        }
    }

    async customFetchAnimeInfo(id) {
        const info = {
            id: id,
            title: '',
        };
        try {
            const animeUrl = `${this.baseUrl}/info/${id}`;
            const { data } = await this.client.get(animeUrl);
            const $ = cheerio.load(data);
            
            // Safe parse of #syncData
            const syncText = $('#syncData').text();
            if (syncText) {
                try {
                    const syncData = JSON.parse(syncText);
                    info.malID = Number(syncData.mal_id);
                    info.alID = Number(syncData.anilist_id);
                } catch (e) {}
            }
            
            info.title = $('h2.film-name > a.text-white').text().trim() || $('.anisc-detail h2.film-name').text().trim();
            info.japaneseTitle = $('div.anisc-info div:nth-child(2) span.name').text().trim();
            info.image = $('img.film-poster-img').attr('src');
            info.description = $('div.film-description').text().trim();
            info.type = $('span.item').last().prev().prev().text().toUpperCase();
            info.url = `${this.baseUrl}/info/${id}`;
            info.recommendations = await this.scrapeCard($);
            info.relatedAnime = [];
            
            const hasSub = $('div.film-stats div.tick div.tick-item.tick-sub').length > 0;
            const hasDub = $('div.film-stats div.tick div.tick-item.tick-dub').length > 0;
            if (hasSub) info.hasSub = hasSub;
            if (hasDub) info.hasDub = hasDub;

            // Fetch episode list
            const episodesAjax = await this.client.get(`${this.baseUrl}/ajax/v2/episode/list/${id.split('-').pop()}`, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    Referer: `${this.baseUrl}/watch/${id}`,
                },
            });
            
            const epData = episodesAjax.data;
            info.episodes = [];
            
            if (Array.isArray(epData.episodes)) {
                // JSON format: { episodes: [1, 2, 3...] }
                const dubs = new Set(epData.dubEpisodes || []);
                info.totalEpisodes = epData.episodes.length;
                epData.episodes.forEach((num) => {
                    info.episodes.push({
                        id: `${id}$episode$${num}`,
                        number: num,
                        title: `Episode ${num}`,
                        isFiller: false,
                        isSubbed: true,
                        isDubbed: dubs.has(num),
                        url: `${this.baseUrl}/watch/${id}?ep=${num}`
                    });
                });
            } else if (epData.html) {
                // Cheerio fallback
                const $$ = cheerio.load(epData.html);
                info.totalEpisodes = $$('div.detail-infor-content > div > a').length;
                $$('div.detail-infor-content > div > a').each((i, el) => {
                    const href = $$(el).attr('href');
                    const epNum = parseInt($$(el).attr('data-number'));
                    info.episodes.push({
                        id: `${id}$episode$${epNum}`,
                        number: epNum,
                        title: $$(el).attr('title') || `Episode ${epNum}`,
                        isFiller: $$(el).hasClass('ssl-item-filler'),
                        isSubbed: true,
                        isDubbed: epNum <= (parseInt($('div.film-stats div.tick div.tick-item.tick-dub').text()) || 0),
                        url: `${this.baseUrl}${href}`
                    });
                });
            }
            
            return info;
        } catch (err) {
            throw new Error(err.message);
        }
    }

    async customFetchEpisodeSources(episodeId, server = 'VidCloud', subOrDub = 'SUB') {
        if (episodeId.startsWith('http')) {
            // Try extracting using BYFMS/Megacloud solver for any direct link
            try {
                return await extractByse(this.client, episodeId);
            } catch (e) {
                throw new Error("MegaCloud extraction failed: " + e.message);
            }
        }
        
        if (!episodeId.includes('$episode$')) {
            throw new Error('Invalid episode id');
        }
        
        const [animeId, epNum] = episodeId.split('$episode$');
        const movieId = animeId.split('-').pop();
        
        try {
            const { data } = await this.client.get(`${this.baseUrl}/ajax/v2/episode/servers?episodeId=${epNum}&mov_id=${movieId}`);
            const htmlString = Array.isArray(data.html) ? data.html.join('') : (data.html || '');
            const $ = cheerio.load(htmlString);
            
            // Prioritize DUB if available
            let activeSubOrDub = subOrDub || 'SUB';
            const hasRequestedType = $(`.servers-${activeSubOrDub.toLowerCase()} .server-item`).length > 0;
            
            if (!hasRequestedType) {
                // Fallback to the other type if the requested one isn't available
                const fallbackType = activeSubOrDub === 'SUB' ? 'DUB' : 'SUB';
                const hasFallback = $(`.servers-${fallbackType.toLowerCase()} .server-item`).length > 0;
                
                if (hasFallback) {
                    console.error(`[HianimesRu] Requested ${activeSubOrDub} not found. Falling back to ${fallbackType}!`);
                    activeSubOrDub = fallbackType;
                } else {
                    console.error("[HianimesRu] No servers found for SUB or DUB.");
                }
            } else {
                console.error(`[HianimesRu] Using requested language: ${activeSubOrDub}`);
            }
            
            // Prioritize BYFMS (server-id 1)
            let serverId = '';
            const findServerId = (sid) => {
                const item = $(`.servers-${activeSubOrDub.toLowerCase()} .server-item[data-server-id="${sid}"]`);
                return item.attr('data-id');
            };
            
            serverId = findServerId(1); // BYFMS
            if (!serverId) {
                serverId = findServerId(2); // DGHG (myvidplay.com fallback)
            }
            if (!serverId) {
                serverId = findServerId(4); // Vidplay
            }
            
            if (!serverId) {
                throw new Error("No usable server found");
            }
            
            const sourcesRes = await this.client.get(`${this.baseUrl}/ajax/v2/episode/sources?id=${serverId}`);
            const iframeLink = sourcesRes.data.link;
            
            return await this.fetchEpisodeSources(iframeLink);
        } catch (err) {
            throw err;
        }
    }
}

// ---------------------------------------------------------------------------
// Provider mapping
// ---------------------------------------------------------------------------
const action = process.argv[2];
const arg1 = process.argv[3];
const providerName = (process.argv[4] || 'kickassanime').toLowerCase();
const subOrDubArg = (process.argv[5] || 'SUB').toUpperCase();

function getProvider(name) {
  if (name === 'hianime' || name === 'zoro') {
    return new HianimesRu();
  }
  
  // Default to KickAssAnime (kaa.lt)
  const provider = new ANIME.KickAssAnime();
  provider.baseUrl = 'https://kaa.lt';
  return provider;
}

async function main() {
  try {
    const provider = getProvider(providerName);

    if (action === 'search') {
      if (!arg1) {
        console.log(JSON.stringify({ error: 'Missing search query' }));
        return;
      }
      const results = await provider.search(arg1);
      console.log(JSON.stringify(results));
    } else if (action === 'info') {
      if (!arg1) {
        console.log(JSON.stringify({ error: 'Missing anime ID' }));
        return;
      }
      const info = await provider.fetchAnimeInfo(arg1);
      console.log(JSON.stringify(info));
    } else if (action === 'sources') {
      if (!arg1) {
        console.log(JSON.stringify({ error: 'Missing episode ID' }));
        return;
      }
      const sources = await provider.fetchEpisodeSources(arg1, 'VidCloud', subOrDubArg);
      console.log(JSON.stringify(sources));
    } else if (action === 'home') {
      const homeProvider = new HianimesRu();
      const data = await homeProvider.fetchHome();
      console.log(JSON.stringify(data));
    } else {
      console.log(JSON.stringify({ error: `Unknown action: ${action}` }));
    }
  } catch (err) {
    console.log(JSON.stringify({ error: err.message || String(err) }));
  }
}

main();
