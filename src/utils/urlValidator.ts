/**
 * Utility for validating URLs and related configurations
 * Centralizes URL validation logic used across multiple components
 */

export interface URLValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

export class URLValidator {
    /**
     * Validate a URL string
     * Returns validation result with any errors or warnings
     */
    public static validateURL(url: string, options?: {
        requireProtocol?: 'http' | 'https' | 'any';
        mustEndWith?: string;
        shouldContain?: string[];
    }): URLValidationResult {
        const result: URLValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (!url || typeof url !== 'string' || url.trim() === '') {
            result.isValid = false;
            result.errors.push('URL is empty or invalid');
            return result;
        }

        // Parse URL
        let parsedUrl: URL;
        try {
            parsedUrl = new URL(url);
        } catch (e) {
            result.isValid = false;
            result.errors.push(`Invalid URL format: "${url}"`);
            return result;
        }

        // Check protocol requirements
        if (options?.requireProtocol) {
            if (options.requireProtocol === 'any') {
                if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                    result.isValid = false;
                    result.errors.push('URL must use http:// or https://');
                }
            } else {
                const requiredProtocol = `${options.requireProtocol}:`;
                if (parsedUrl.protocol !== requiredProtocol) {
                    result.isValid = false;
                    result.errors.push(`URL must use ${options.requireProtocol}://`);
                }
            }
        }

        // Check if URL ends with required string
        if (options?.mustEndWith && !url.endsWith(options.mustEndWith)) {
            result.warnings.push(`URL should end with ${options.mustEndWith} for proper URL resolution`);
        }

        // Check if URL contains required strings
        if (options?.shouldContain) {
            const missingPatterns = options.shouldContain.filter(pattern => !url.includes(pattern));
            if (missingPatterns.length > 0) {
                result.warnings.push(`URL may not be valid (expected to contain: ${missingPatterns.join(' or ')})`);
            }
        }

        return result;
    }

    /**
     * Validate inventory URL (Intersphinx format)
     */
    public static validateInventoryURL(url: string): URLValidationResult {
        return this.validateURL(url, {
            requireProtocol: 'any',
            shouldContain: ['objects.inv', '_objects']
        });
    }

    /**
     * Validate base URL (should end with /)
     */
    public static validateBaseURL(url: string): URLValidationResult {
        return this.validateURL(url, {
            requireProtocol: 'any',
            mustEndWith: '/'
        });
    }

    /**
     * Validate a name field (alphanumeric, underscore, hyphen only)
     */
    public static validateName(name: string): URLValidationResult {
        const result: URLValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        if (!name || typeof name !== 'string' || name.trim() === '') {
            result.isValid = false;
            result.errors.push('Name is empty or invalid');
            return result;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            result.warnings.push(`Name "${name}" contains unusual characters (expected alphanumeric, underscore, or hyphen)`);
        }

        return result;
    }

    /**
     * Check if URL is potentially reachable (basic check)
     * This is a synchronous check and doesn't actually make a request
     */
    public static isURLReachable(url: string): boolean {
        try {
            const parsedUrl = new URL(url);
            // Basic checks: has protocol, has hostname
            return ['http:', 'https:'].includes(parsedUrl.protocol) &&
                parsedUrl.hostname.length > 0;
        } catch {
            return false;
        }
    }
}
