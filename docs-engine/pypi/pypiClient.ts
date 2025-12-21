import * as https from 'https';
import { DocKey, HoverDoc, ResolutionSource } from '../../shared/types';

export class PyPiClient {
    async getPackageMetadata(packageName: string): Promise<{ url: string | null, links: Record<string, string> }> {
        try {
            const metadata = await this.fetchJson(`https://pypi.org/pypi/${packageName}/json`);
            if (!metadata || !metadata.info) return { url: null, links: {} };

            const info = metadata.info;
            const links: Record<string, string> = {};

            if (info.project_urls) {
                for (const [key, value] of Object.entries(info.project_urls)) {
                    if (typeof value === 'string') {
                        links[key] = value;
                    }
                }
            }

            if (info.home_page && !Object.values(links).includes(info.home_page)) {
                links['Homepage'] = info.home_page;
            }

            // Determine best URL for "url" field
            let bestUrl: string | null = null;
            const docKey = Object.keys(links).find(k => k.toLowerCase() === 'documentation');
            if (docKey) {
                bestUrl = links[docKey];
            } else if (info.home_page) {
                bestUrl = info.home_page;
            } else if (Object.keys(links).length > 0) {
                bestUrl = Object.values(links)[0];
            }

            return { url: bestUrl, links };
        } catch (e) {
            // Logger.log(`PyPI lookup failed for ${packageName}: ${e}`);
            return { url: null, links: {} };
        }
    }

    async getPackageUrl(packageName: string): Promise<string | null> {
        const { url } = await this.getPackageMetadata(packageName);
        return url;
    }

    async findDocs(key: DocKey): Promise<HoverDoc | null> {
        const { url, links } = await this.getPackageMetadata(key.package);
        if (url) {
            return {
                title: key.package,
                content: `Documentation for ${key.package} (PyPI)`,
                url: url,
                links: links,
                source: ResolutionSource.PyPI,
                confidence: 0.7
            };
        }
        return null;
    }

    private fetchJson(url: string): Promise<any> {
        return new Promise((resolve, reject) => {
            const req = https.get(url, { timeout: 5000 }, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`Status code: ${res.statusCode}`));
                    return;
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timed out'));
            });

            req.on('error', reject);
        });
    }
}
