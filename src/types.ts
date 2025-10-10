/**
 * Type definitions for Python documentation mappings
 */

export interface Info {
    title: string;
    url: string;
    anchor?: string;
}

export interface InventoryEntry {
    name: string;
    uri: string;
    anchor: string;
    description?: string; // Added optional description property
}

/**
 * Parameter information for hover display
 */
export interface ParameterInfo {
    name: string;
    type?: string;
    required?: boolean;
    description: string;
    default?: string;
}

/**
 * Return type information
 */
export interface ReturnInfo {
    type: string;
    description?: string;
}

/**
 * Deprecation information
 */
export interface DeprecationInfo {
    version?: string;
    message: string;
    alternative?: string;
}

/**
 * Related symbol information for "See Also"
 */
export interface RelatedSymbol {
    name: string;
    description: string;
    type?: string;
}

/**
 * Performance/complexity information
 */
export interface PerformanceInfo {
    time?: string;
    space?: string;
    note?: string;
}
