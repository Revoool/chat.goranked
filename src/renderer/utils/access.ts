/**
 * Utility functions for checking user access/permissions
 */

/**
 * Check if user has access to a page/subject
 * @param subject - Page subject (e.g., 'account-orders')
 * @returns true if user has access
 */
export function hasAccess(subject: string): boolean {
  try {
    const userAbilityPages = JSON.parse(
      localStorage.getItem('userAbilityPages') || '[]'
    );
    
    // If no pages defined, allow access (for backward compatibility)
    if (!userAbilityPages || userAbilityPages.length === 0) {
      return true;
    }
    
    // Check if user has access to this subject
    return userAbilityPages.some((page: any) => {
      if (typeof page === 'string') {
        return page === subject;
      }
      if (typeof page === 'object' && page.slug) {
        return page.slug === subject;
      }
      return false;
    });
  } catch (error) {
    console.error('Error checking access:', error);
    // On error, allow access (fail open)
    return true;
  }
}

/**
 * Check if user has permission for a rule
 * @param subject - Subject slug
 * @param rule - Rule name (e.g., 'show', 'edit')
 * @returns true if user has permission
 */
export function hasPermission(subject: string, rule: string = 'show'): boolean {
  try {
    const userAbilityRules = JSON.parse(
      localStorage.getItem('userAbilityRules') || '[]'
    );
    
    // If no rules defined, allow access
    if (!userAbilityRules || userAbilityRules.length === 0) {
      return true;
    }
    
    // Check if user has permission
    return userAbilityRules.some((ruleItem: any) => {
      if (typeof ruleItem === 'object' && ruleItem.slug) {
        return ruleItem.slug === subject && ruleItem[rule] === 1;
      }
      return false;
    });
  } catch (error) {
    console.error('Error checking permission:', error);
    return true;
  }
}
