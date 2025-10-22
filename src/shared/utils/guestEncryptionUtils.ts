/**
 * Simple encryption utilities for guest data
 * Uses a deterministic approach for guest mode encryption
 */

// Simple XOR-based encryption for guest data (not cryptographically secure but better than plaintext)
function simpleEncrypt(text: string, key: string): string {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(encodeURIComponent(result));
}

function simpleDecrypt(encrypted: string, key: string): string {
  try {
    const text = decodeURIComponent(atob(encrypted));
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch (e) {
    console.warn('[guestEncryption] Decryption failed:', e);
    return encrypted; // Return original if decryption fails
  }
}

// Generate a deterministic key based on device fingerprint
function generateGuestEncryptionKey(): string {
  // Use available environment information to create a pseudo-deterministic key
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
  const platform = typeof navigator !== 'undefined' ? navigator.platform : 'unknown';
  const language = typeof navigator !== 'undefined' ? navigator.language : 'unknown';
  const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'unknown';
  
  // Combine these factors to create a key
  const combined = `${userAgent}-${platform}-${language}-${timezone}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to a string key
  return `guest-key-${Math.abs(hash).toString(36)}`;
}

/**
 * Encrypt sensitive fields in guest data
 */
export function encryptGuestDataFields(data: any): any {
  try {
    const key = generateGuestEncryptionKey();
    
    // Define which fields to encrypt (sensitive user data)
    const encryptedData = { ...data };
    
    // Encrypt trip fields
    if (encryptedData.trips && Array.isArray(encryptedData.trips)) {
      encryptedData.trips = encryptedData.trips.map((trip: any) => ({
        ...trip,
        water: trip.water ? simpleEncrypt(trip.water, key) : trip.water,
        location: trip.location ? simpleEncrypt(trip.location, key) : trip.location,
        companions: trip.companions ? simpleEncrypt(trip.companions, key) : trip.companions,
        notes: trip.notes ? simpleEncrypt(trip.notes, key) : trip.notes,
      }));
    }
    
    // Encrypt weather log fields
    if (encryptedData.weatherLogs && Array.isArray(encryptedData.weatherLogs)) {
      encryptedData.weatherLogs = encryptedData.weatherLogs.map((log: any) => ({
        ...log,
        sky: log.sky ? simpleEncrypt(log.sky, key) : log.sky,
        windCondition: log.windCondition ? simpleEncrypt(log.windCondition, key) : log.windCondition,
        windDirection: log.windDirection ? simpleEncrypt(log.windDirection, key) : log.windDirection,
      }));
    }
    
    // Encrypt fish caught fields
    if (encryptedData.fishCaught && Array.isArray(encryptedData.fishCaught)) {
      encryptedData.fishCaught = encryptedData.fishCaught.map((fish: any) => ({
        ...fish,
        species: fish.species ? simpleEncrypt(fish.species, key) : fish.species,
        length: fish.length ? simpleEncrypt(fish.length, key) : fish.length,
        weight: fish.weight ? simpleEncrypt(fish.weight, key) : fish.weight,
        time: fish.time ? simpleEncrypt(fish.time, key) : fish.time,
        details: fish.details ? simpleEncrypt(fish.details, key) : fish.details,
        gear: fish.gear ? fish.gear.map((g: string) => simpleEncrypt(g, key)) : fish.gear,
      }));
    }
    
    // Mark as encrypted
    encryptedData._encrypted = true;
    
    return encryptedData;
  } catch (error) {
    console.warn('[guestEncryption] Failed to encrypt guest data:', error);
    return data; // Return unencrypted if encryption fails
  }
}

/**
 * Decrypt sensitive fields in guest data
 */
export function decryptGuestDataFields(data: any): any {
  if (!data || !data._encrypted) {
    return data; // Return as-is if not encrypted
  }
  
  try {
    const key = generateGuestEncryptionKey();
    
    // Define which fields to decrypt
    const decryptedData = { ...data };
    
    // Decrypt trip fields
    if (decryptedData.trips && Array.isArray(decryptedData.trips)) {
      decryptedData.trips = decryptedData.trips.map((trip: any) => ({
        ...trip,
        water: trip.water ? simpleDecrypt(trip.water, key) : trip.water,
        location: trip.location ? simpleDecrypt(trip.location, key) : trip.location,
        companions: trip.companions ? simpleDecrypt(trip.companions, key) : trip.companions,
        notes: trip.notes ? simpleDecrypt(trip.notes, key) : trip.notes,
      }));
    }
    
    // Decrypt weather log fields
    if (decryptedData.weatherLogs && Array.isArray(decryptedData.weatherLogs)) {
      decryptedData.weatherLogs = decryptedData.weatherLogs.map((log: any) => ({
        ...log,
        sky: log.sky ? simpleDecrypt(log.sky, key) : log.sky,
        windCondition: log.windCondition ? simpleDecrypt(log.windCondition, key) : log.windCondition,
        windDirection: log.windDirection ? simpleDecrypt(log.windDirection, key) : log.windDirection,
      }));
    }
    
    // Decrypt fish caught fields
    if (decryptedData.fishCaught && Array.isArray(decryptedData.fishCaught)) {
      decryptedData.fishCaught = decryptedData.fishCaught.map((fish: any) => ({
        ...fish,
        species: fish.species ? simpleDecrypt(fish.species, key) : fish.species,
        length: fish.length ? simpleDecrypt(fish.length, key) : fish.length,
        weight: fish.weight ? simpleDecrypt(fish.weight, key) : fish.weight,
        time: fish.time ? simpleDecrypt(fish.time, key) : fish.time,
        details: fish.details ? simpleDecrypt(fish.details, key) : fish.details,
        gear: fish.gear ? fish.gear.map((g: string) => simpleDecrypt(g, key)) : fish.gear,
      }));
    }
    
    // Remove encryption marker
    delete decryptedData._encrypted;
    
    return decryptedData;
  } catch (error) {
    console.warn('[guestEncryption] Failed to decrypt guest data:', error);
    return data; // Return encrypted data if decryption fails
  }
}