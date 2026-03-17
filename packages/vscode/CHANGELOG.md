# Changelog

## 0.1.4

- Rename the extension listing to `Lumen for Modal` so it can publish to the VS Code Marketplace

## 0.1.3

- Build the extension in GitHub Actions before calling `vsce publish`

## 0.1.2

- Fix the remaining CI install path in release tooling so Marketplace publish can run from GitHub Actions

## 0.1.1

- Fix the publish workflow so GitHub Actions can install repo tooling from the public registry

## 0.1.0

- Initial public preview of the Lumen VS Code extension
- Workspace home for `lumen.config.json`
- Schema-driven editor for `.lumen` configs
- Managed local Modal dev server lifecycle
- Pipeline scaffolding and bundled agent skill installation
