# lumen-vscode

VS Code custom editor for `.lumen` files — schema-driven UI for AI image and video generation.

## Context

Generation pipelines vary wildly: different models expose different parameter schemas, validation rules, and outputs. Lumen standardizes those schemas into one editing surface so a workspace can manage one inference server cleanly.

An `.lumen` file is a JSON array of configurations for one managed server. Each config targets a pipeline on that server and stores a set of parameter values. The extension starts the server, discovers its schemas over HTTP, renders typed form fields, and proxies generation requests.

## Roadmap

- Collection view — show all configurations as expandable cards instead of drilling down through dropdowns
- Generation history per configuration, not just latest result
- Result feedback loop — drag generated images between cards for iterative workflows
