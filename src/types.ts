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
