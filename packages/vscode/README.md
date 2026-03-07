# lumen-vscode

VS Code custom editor for `.lumen` files — schema-driven UI for AI image and video generation.

## Context

Generation pipelines vary wildly: different servers, different models, different parameter schemas. We needed a single file format that captures generation configurations portably, and a viewer that renders the right form UI automatically from any provider's schema.

An `.lumen` file is a JSON array of configurations — each one targeting a service, a pipeline, and a set of parameter values. The extension discovers pipeline schemas from providers (dynamically via HTTP or statically bundled), renders typed form fields, and proxies generation requests. One file can hold configurations across multiple providers for side-by-side comparison.

## Roadmap

- Collection view — show all configurations as expandable cards instead of drilling down through dropdowns
- Generation history per configuration, not just latest result
- Schema caching for graceful offline degradation
- Result feedback loop — drag generated images between cards for iterative workflows
