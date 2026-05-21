import { Context } from "../types";
import { DEFAULT_ALLOWED_ROLES, DEFAULT_CONFIG_PATHS } from "../types/plugin-input";
import { isProtectedConfigFile, isAuthorizedRole } from "../utils/config-protection";

/**
 * Handles push events to detect and revert unauthorized config file modifications.
 *
 * Workflow:
 * 1. Only process pushes to the default branch
 * 2. For each commit, check if any protected config files were modified
 * 3. Verify the committer has an authorized role (admin or billing_manager)
 * 4. If unauthorized, revert the commit by creating a new commit with the parent tree
 */
export async function handlePushEvent(context: Context<"push">) {
  const { logger, payload, octokit, config } = context;
  const { repository, commits, sender, ref } = payload;

  if (!commits || commits.length === 0 || !sender) {
    logger.debug("No commits or sender info in push event, skipping.");
    return;
  }

  const owner = repository.owner.login;
  const repo = repository.name;
  const defaultBranch = repository.default_branch;
  const pushedBranch = ref.replace(/^refs\/heads\//, "");

  if (pushedBranch !== defaultBranch) {
    logger.debug(`Push to non-default branch (${pushedBranch}), skipping.`);
    return;
  }

  const protectedPaths = config.protectedConfigPaths || DEFAULT_CONFIG_PATHS;
  const allowedRoles = config.allowedRoles || DEFAULT_ALLOWED_ROLES;

  for (const commit of commits) {
    const allChangedFiles = [...(commit.added || []), ...(commit.modified || []), ...(commit.removed || [])];
    const modifiedConfigFiles = allChangedFiles.filter((file) => isProtectedConfigFile(file, protectedPaths));

    if (modifiedConfigFiles.length === 0) {
      continue;
    }

    logger.info(`Config file modification detected in commit ${commit.id}`, {
      files: modifiedConfigFiles,
      committer: sender.login,
    });

    const isAuthorized = await isAuthorizedRole(octokit, owner, repo, sender.login, allowedRoles, logger);

    if (isAuthorized) {
      logger.info(`User ${sender.login} is authorized to modify config files.`);
      continue;
    }

    logger.error(`Unauthorized config modification by @${sender.login}. Reverting commit ${commit.id}.`);

    try {
      await revertCommit(octokit, owner, repo, commit.id, sender.login, defaultBranch, logger);
      logger.ok(`Successfully reverted unauthorized commit ${commit.id} by @${sender.login}.`);
    } catch (error) {
      logger.error(`Failed to revert commit ${commit.id}: ${error}`);
    }
  }
}

/**
 * Reverts a commit by creating a new commit using the Git Data API.
 *
 * The new commit's tree is set to the parent commit's tree, effectively
 * undoing the unauthorized change. The commit message identifies the
 * original unauthorized commit and the user who made it.
 */
async function revertCommit(
  octokit: Context["octokit"],
  owner: string,
  repo: string,
  commitSha: string,
  unauthorizedUser: string,
  defaultBranch: string,
  logger: Context["logger"]
): Promise<void> {
  // Get the commit to find its parent
  const { data: commit } = await octokit.rest.repos.getCommit({
    owner,
    repo,
    ref: commitSha,
  });

  const parentSha = commit.parents[0]?.sha;
  if (!parentSha) {
    logger.error(`Cannot revert commit ${commitSha}: no parent commit found (possibly initial commit).`);
    return;
  }

  // Get parent commit's tree SHA
  const { data: parentCommit } = await octokit.rest.repos.getCommit({
    owner,
    repo,
    ref: parentSha,
  });

  // Create a new commit with the parent's tree, effectively reverting the change
  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: `revert: Unauthorized config modification by @${unauthorizedUser}\n\nReverting commit ${commitSha}\n\nOnly admins and billing managers can modify configuration files.`,
    tree: parentCommit.commit.tree.sha,
    parents: [commitSha],
  });

  // Update the branch ref to point to our revert commit
  await octokit.rest.git.updateRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
    sha: newCommit.sha,
  });

  logger.info(`Reverted commit ${commitSha} -> new commit ${newCommit.sha}`);
}
