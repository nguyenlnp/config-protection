import { Context } from "../types";

/**
 * Checks if a file path matches any of the protected config file paths.
 * Matching is case-insensitive to catch variations like .UBIQUITY-OS.CONFIG.YML.
 */
export function isProtectedConfigFile(filePath: string, protectedPaths: string[]): boolean {
  const lowerFilePath = filePath.toLowerCase();
  return protectedPaths.some((protectedPath) => lowerFilePath === protectedPath.toLowerCase());
}

/**
 * Checks if a user has an authorized role (admin or billing_manager) in the repository/organization.
 *
 * Authorization check order:
 * 1. Repository collaborator permission (admin)
 * 2. Organization billing_manager role (org-level check)
 * 3. Repository maintain permission (treated as admin-equivalent)
 */
export async function isAuthorizedRole(
  octokit: Context["octokit"],
  owner: string,
  repo: string,
  username: string,
  allowedRoles: string[],
  logger: Context["logger"]
): Promise<boolean> {
  try {
    // Check repository collaborator permission level
    const { data: permission } = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });

    const repoPermission = permission.permission;
    logger.debug(`User ${username} has repository permission level: ${repoPermission}`);

    // admin permission maps to repository admin
    if (repoPermission === "admin" && allowedRoles.includes("admin")) {
      return true;
    }

    // maintain permission is treated as admin-equivalent for config protection
    if (repoPermission === "maintain" && allowedRoles.includes("admin")) {
      return true;
    }

    // For billing_manager, we need to check org-level membership
    if (allowedRoles.includes("billing_manager")) {
      const isBillingManager = await checkBillingManager(octokit, owner, username, logger);
      if (isBillingManager) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error(`Error checking permission for user ${username}: ${error}`);
    // On error, deny by default (safe default — fail closed)
    return false;
  }
}

/**
 * Checks if a user is a billing manager of the organization.
 * Billing managers are organization members with the billing_manager role.
 * If the owner is not an organization (e.g., a personal repo), this returns false.
 */
async function checkBillingManager(
  octokit: Context["octokit"],
  org: string,
  username: string,
  logger: Context["logger"]
): Promise<boolean> {
  try {
    const { data: membership } = await octokit.rest.orgs.getMembershipForUser({
      org,
      username,
    });

    logger.debug(`User ${username} org membership role: ${membership.role}`);
    return membership.role === "billing_manager";
  } catch (error) {
    // If we can't check org membership (e.g., repo owned by a user, not an org),
    // the user is not a billing manager
    logger.debug(`Could not check billing_manager status for ${username}: ${error}`);
    return false;
  }
}
