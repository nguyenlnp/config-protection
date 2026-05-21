# Config Protection Plugin

A UbiquityOS plugin that protects configuration files from unauthorized modifications by automatically reverting changes made by users without admin or billing_manager permissions.

## How It Works

1. **Listens for push events** on the default branch
2. **Detects config file changes** by checking if protected file paths (e.g., `.ubiquity-os.config.yml`) were modified
3. **Verifies committer permissions** — checks if the user has `admin` or `billing_manager` role
4. **Auto-reverts unauthorized changes** — if the committer lacks proper authorization, the commit is immediately reverted

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `protectedConfigPaths` | `string[]` | `.ubiquity-os.config.yml`, `.ubiquity-os.config.yaml`, `ubiquity-os.config.yml`, `ubiquity-os.config.yaml`, `.github/ubiquity-os.config.yml`, `.github/ubiquity-os.config.yaml` | List of config file paths to protect |
| `allowedRoles` | `string[]` | `admin`, `billing_manager` | Roles allowed to modify config files |

## Example Configuration

```yaml
# .ubiquity-os.config.yml (plugin settings)
protectedConfigPaths:
  - .ubiquity-os.config.yml
  - .github/ubiquity-os.config.yml
allowedRoles:
  - admin
  - billing_manager
```

## Events

- `push` — Monitors pushes to the default branch for config file changes

## Revert Behavior

When an unauthorized modification is detected:

1. The plugin retrieves the parent commit
2. Creates a new commit with the parent's tree (effectively undoing the change)
3. Updates the branch reference to point to the revert commit
4. The revert commit message identifies the unauthorized user and original commit SHA

## Development

### Prerequisites

- Node.js >= 24.11.0
- Bun (recommended) or npm

### Setup

```bash
bun install
```

### Testing

```bash
bun run test
```

### Local Development

```bash
bun run dev:bun
```
