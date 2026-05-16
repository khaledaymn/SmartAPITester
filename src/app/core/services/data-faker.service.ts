import { Injectable } from '@angular/core';
import { faker } from '@faker-js/faker';

/**
 * DataFakerService
 *
 * Generates realistic random data based on sample JSON structure.
 * Analyzes object keys and value types to intelligently replace data with Faker-generated values.
 * Handles nested objects and arrays recursively.
 *
 * @example
 * const sampleData = {
 *   id: '123',
 *   email: 'user@example.com',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   address: '123 Main St',
 *   phoneNumber: '+1234567890',
 *   isActive: true,
 *   price: 99.99
 * };
 *
 * const fakeData = this.dataFaker.generateData(sampleData);
 * // Returns an object with same structure but all values randomized
 */
@Injectable({
  providedIn: 'root',
})
export class DataFakerService {
  /**
   * Mapping of explicit @ tags to their faker generation methods
   * Allows users to override automatic key-matching with explicit tags
   *
   * @example
   * "email": "@email" -> faker.internet.email()
   * "location": "@fullAddress" -> faker.location.streetAddress({ fullAddress: true })
   * "coords": "@lat" -> faker.location.latitude()
   */
  private readonly EXPLICIT_TAG_MAP: Record<string, () => any> = {
    // Identity Tags
    '@name': () => faker.person.fullName(),
    '@firstName': () => faker.person.firstName(),
    '@lastName': () => faker.person.lastName(),
    '@fullName': () => faker.person.fullName(),
    '@job': () => faker.person.jobTitle(),
    '@jobTitle': () => faker.person.jobTitle(),
    '@jobDescriptor': () => faker.person.jobDescriptor(),
    '@expense_category': () => faker.number.int({ min: 0, max: 3 }),

    // Contact Tags
    '@email': () => faker.internet.email(),
    '@emailAddress': () => faker.internet.email(),
    '@phone': () => {
      const prefixes = ['010', '011', '012', '015'];
      const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      return randomPrefix + faker.string.numeric(8);
    },
    '@phone_eg': () => {
      const prefixes = ['010', '011', '012', '015'];
      const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      return randomPrefix + faker.string.numeric(8);
    },
    '@website': () => faker.internet.url(),
    '@url': () => faker.internet.url(),

    // Address Tags
    '@address': () => faker.location.streetAddress(),
    '@fullAddress': () => faker.location.streetAddress({ useFullAddress: true }),
    '@city': () => faker.location.city(),
    '@country': () => faker.location.country(),
    '@zipCode': () => faker.location.zipCode(),
    '@postalCode': () => faker.location.zipCode(),
    '@lat': () => faker.location.latitude(),
    '@latitude': () => faker.location.latitude(),
    '@long': () => faker.location.longitude(),
    '@longitude': () => faker.location.longitude(),

    // Commerce Tags
    '@price': () => faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    '@amount': () => faker.number.float({ min: 10, max: 1000, fractionDigits: 2 }),
    '@currency': () => faker.finance.currencyCode(),
    '@iban': () => faker.finance.iban(),
    '@company': () => faker.company.name(),
    '@companyName': () => faker.company.name(),

    // System Tags
    '@uuid': () => faker.string.uuid(),
    '@guid': () => faker.string.uuid(),
    '@ipv4': () => faker.internet.ipv4(),
    '@ipv6': () => faker.internet.ipv6(),
    '@password': () => faker.internet.password({ length: 16, memorable: false }),
    '@color': () => faker.color.rgb(),
    '@hexColor': () => faker.color.rgb(),

    // Content Tags
    '@sentence': () => faker.lorem.sentence(),
    '@paragraph': () => faker.lorem.paragraph(),
    '@word': () => faker.lorem.word(),
    '@title': () => faker.lorem.sentence(3),
    '@description': () => faker.lorem.paragraph(),

    // Enum Tags (Backend-specific)
    '@invoice_status': () => faker.number.int({ min: 1, max: 4 }),
    '@gender': () => faker.number.int({ min: 1, max: 3 }),
    '@general_size': () => faker.number.int({ min: 1, max: 5 }),
  };
  /**
   * Generates random data based on sample object structure.
   * Recursively processes nested objects and arrays.
   *
   * @param sampleData - The sample object to use as a template
   * @returns A new object with same structure but randomized values
   *
   * @description
   * This method traverses the entire object tree:
   * 1. For each property, it checks if value is an object or array
   * 2. If object/array, recursively processes each element
   * 3. If primitive, applies smart key-based or type-based faker generation
   * 4. Maintains the original structure and data types
   */
  generateData(sampleData: any): any {
    // Handle null, undefined, and non-objects
    if (sampleData === null || sampleData === undefined) {
      return sampleData;
    }

    // Handle arrays recursively
    if (Array.isArray(sampleData)) {
      return sampleData.map((item) => this.generateData(item));
    }

    // Handle objects (but not Date or other special types)
    if (typeof sampleData === 'object' && !(sampleData instanceof Date)) {
      const result: any = {};

      for (const key in sampleData) {
        if (Object.prototype.hasOwnProperty.call(sampleData, key)) {
          const value = sampleData[key];

          // Recursively process nested objects and arrays
          if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
            result[key] = this.generateData(value);
          } else if (value instanceof Date) {
            // Preserve Date objects
            result[key] = new Date(value);
          } else {
            // Generate fake data based on key name or type
            result[key] = this.generateFakeValue(key, value);
          }
        }
      }

      return result;
    }

    // Handle primitive types directly
    return sampleData;
  }

  /**
   * Generates a fake value based on explicit @ tags, key name (smart detection), or value type.
   *
   * @param key - The property key name (used for smart detection)
   * @param value - The original value (used to check for @ tags and type fallback)
   * @returns Randomly generated value matching the detected type
   *
   * @description
   * Priority order:
   * 1. Explicit @ tag detection - supports both single tags (e.g., "@email") and template strings (e.g., "Invoice @uuid")
   * 2. Smart key-based detection (checks key name against known patterns)
   * 3. Type-based fallback (uses typeof to determine generation method)
   * 4. Default alphanumeric string for unknown cases
   *
   * @example
   * generateFakeValue('anything', '@email') -> 'john@example.com'
   * generateFakeValue('anything', 'Invoice @uuid') -> 'Invoice 550e8400-e29b-41d4-a716-446655440000'
   * generateFakeValue('email', 'user@example.com') -> 'jane@test.com' (key-based, no @ tag)
   */
  private generateFakeValue(key: string, value: any): any {
    // PRIORITY 1: Check for explicit @ tag override (with template system support)
    if (typeof value === 'string' && !value.includes('@') && !value.startsWith('[FILE_')) {
      return value;
    }
    if (typeof value === 'string') {
      // Check if string contains @ tags (either single tag or template)
      if (value.includes('@')) {
        const isJustSingleTag = /^@\w+$/.test(value); // Check if entire value is a single tag like "@invoice_status"

        // Use regex to find and replace all @tagName patterns
        const replacedValue = value.replace(/@(\w+)/g, (match, tagName) => {
          const fullTag = `@${tagName}`;
          const fakeValueGenerator = this.EXPLICIT_TAG_MAP[fullTag];
          if (fakeValueGenerator) {
            const generatedValue = fakeValueGenerator();
            console.log(`[DataFaker] Replacing ${fullTag} -> ${generatedValue}`);
            return String(generatedValue);
          } else {
            console.warn(`[DataFaker] Unrecognized tag "${fullTag}". Keeping original.`);
            return match;
          }
        });

        // If the original template was just a single tag, ensure we return the correct type
        if (isJustSingleTag) {
          const tagName = value.slice(1); // Remove @ prefix
          const fakeValueGenerator = this.EXPLICIT_TAG_MAP[value];
          if (fakeValueGenerator) {
            const result = fakeValueGenerator();
            // If the tag is one of the enum tags, ensure it's returned as a number
            if (['@invoice_status', '@gender', '@general_size'].includes(value)) {
              return typeof result === 'number' ? result : Number(result);
            }
            return result;
          }
        }

        // If the result is different from the original, it means we did replacements
        if (replacedValue !== value) {
          return replacedValue;
        }
      }

      // Check for file upload tags (special case, not @ prefixed)
      if (
        value === '[FILE_UPLOAD]' ||
        value === '[FILE_PDF]' ||
        value === '[FILE_ZIP]' ||
        value === '[FILE_DOCX]' ||
        value === '[FILE_TXT]'
      ) {
        return value;
      }
    }

    // PRIORITY 3: Smart key-based detection
    const keyLower = key.toLowerCase();

    // Preserve time-like values as-is
    if (
      keyLower.includes('time') ||
      (typeof value === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(value))
    ) {
      return value;
    }

    if (this.matchesPattern(keyLower, ['email', 'mail', 'emailaddress'])) {
      return faker.internet.email();
    }

    if (this.matchesPattern(keyLower, ['name', 'fullname', 'username'])) {
      return faker.person.fullName();
    }

    if (this.matchesPattern(keyLower, ['phone', 'phonenumber', 'telephone', 'mobile'])) {
      const prefixes = ['010', '011', '012', '015'];
      const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];

      return randomPrefix + faker.string.numeric(8);
    }

    if (this.matchesPattern(keyLower, ['firstname', 'first_name'])) {
      return faker.person.firstName();
    }

    if (this.matchesPattern(keyLower, ['lastname', 'last_name', 'surname'])) {
      return faker.person.lastName();
    }

    // if (this.matchesPattern(keyLower, ['phone', 'phonenumber', 'telephone', 'mobile'])) {
    //   return faker.phone.number();
    // }

    if (this.matchesPattern(keyLower, ['id', 'uuid', 'uniqueid', 'identifier'])) {
      if (!value.includes('@')) {
        return value;
      }
      return faker.string.uuid();
    }

    if (this.matchesPattern(keyLower, ['address', 'streetaddress', 'street'])) {
      return faker.location.streetAddress();
    }

    if (this.matchesPattern(keyLower, ['price', 'amount', 'balance', 'cost', 'salary', 'wage'])) {
      return faker.number.int({ min: 4000, max: 15000 });
    }

    if (this.matchesPattern(keyLower, ['city', 'municipality'])) {
      return faker.location.city();
    }

    if (this.matchesPattern(keyLower, ['country', 'nation'])) {
      return faker.location.country();
    }

    if (this.matchesPattern(keyLower, ['zip', 'zipcode', 'postal', 'postalcode'])) {
      return faker.location.zipCode();
    }

    if (
      this.matchesPattern(keyLower, ['description', 'bio', 'text', 'content', 'comment', 'message'])
    ) {
      return faker.lorem.sentence();
    }

    if (this.matchesPattern(keyLower, ['title', 'subject', 'headline'])) {
      return faker.lorem.sentence(3);
    }

    if (this.matchesPattern(keyLower, ['price', 'amount', 'balance', 'cost', 'salary', 'wage'])) {
      return faker.number.float({ min: 10, max: 1000, fractionDigits: 2 });
    }

    if (this.matchesPattern(keyLower, ['url', 'website', 'link', 'uri'])) {
      return faker.internet.url();
    }

    if (
      this.matchesPattern(keyLower, [
        'date',
        'timestamp',
        'createdat',
        'updatedat',
        'createdon',
        'updatedon',
      ])
    ) {
      return faker.date.recent().toISOString();
    }

    if (this.matchesPattern(keyLower, ['company', 'organization', 'business'])) {
      return faker.company.name();
    }

    if (this.matchesPattern(keyLower, ['ipaddress', 'ip', 'ipv4', 'ipv6'])) {
      return faker.internet.ipv4();
    }

    if (this.matchesPattern(keyLower, ['color', 'hex'])) {
      return faker.color.rgb();
    }

    // Type-Based Fallback Detection
    const valueType = typeof value;

    if (valueType === 'string') {
      return faker.string.alphanumeric(8);
    }

    if (valueType === 'number') {
      // Check if original value was float-like
      if (Number.isInteger(value)) {
        return faker.number.int({ min: 1, max: 100 });
      } else {
        return faker.number.float({ min: 1, max: 100, fractionDigits: 2 });
      }
    }

    if (valueType === 'boolean') {
      return faker.datatype.boolean();
    }

    // Default fallback
    return faker.string.alphanumeric(8);
  }

  /**
   * Helper method to check if a key matches any pattern in the list.
   *
   * @param key - The key to check (already converted to lowercase)
   * @param patterns - Array of patterns to match against
   * @returns True if the key contains any of the patterns, false otherwise
   *
   * @description
   * Uses simple string inclusion check. The pattern is considered a match if it's
   * found anywhere in the key string (e.g., 'email' matches 'userEmail', 'emailAddress', 'email')
   */
  private matchesPattern(key: string, patterns: string[]): boolean {
    return patterns.some((pattern) => key.includes(pattern));
  }
}
