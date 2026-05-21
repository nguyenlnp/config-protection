import { StaticDecode, Type as T } from "@sinclair/typebox";

/**
 * Default config paths that should be protected.
 */
const DEFAULT_CONFIG_PATHS = [
  ".ubiquity-os.config.yml",
  ".ubiquity-os.config.yaml",
  "ubiquity-os.config.yml",
  "ubiquity-os.config.yaml",
  ".github/ubiquity-os.config.yml",
  ".github/ubiquity-os.config.yaml",
];

/**
 * Default roles that are allowed to modify config files.
 */
const DEFAULT_ALLOWED_ROLES = ["admin", "billing_manager"];

export const pluginSettingsSchema = T.Object(
  {
    /**
     * List of config file paths to protect (relative to repo root).
     * Defaults to common UbiquityOS config file locations.
     */
    protectedConfigPaths: T.Optional(
      T.Array(T.String(), {
        default: DEFAULT_CONFIG_PATHS,
      })
    ),
    /**
     * Roles that are allowed to modify config files.
     * Defaults to admin and billing_manager.
     */
    allowedRoles: T.Optional(
      T.Array(T.String(), {
        default: DEFAULT_ALLOWED_ROLES,
      })
    ),
  },
  { default: {} }
);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;

export { DEFAULT_CONFIG_PATHS, DEFAULT_ALLOWED_ROLES };
