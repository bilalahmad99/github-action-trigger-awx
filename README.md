# Trigger job templates on Ansible Tower/AWX from Github Actions

![CI](https://github.com/bilalahmad99/github-action-trigger-awx/actions/workflows/test.yml/badge.svg)
![CodeQL](https://github.com/bilalahmad99/github-action-trigger-awx/actions/workflows/codeql-analysis.yml/badge.svg)
[![GitHub release](https://img.shields.io/github/v/release/bilalahmad99/github-action-trigger-awx)](https://github.com/bilalahmad99/github-action-trigger-awx/releases)

Github action that allows you to trigger job or workflow templates on Ansible Tower/AWX.

## Authentication

Two authentication methods are supported:

**Token (recommended)** — Use an AWX OAuth2 token:
```yaml
ansible_tower_token: ${{ secrets.ansibleToken }}
```

**Basic auth (legacy)** — Use username and password:
```yaml
ansible_tower_user: ${{ secrets.ansibleUser }}
ansible_tower_pass: ${{ secrets.ansiblePass }}
```

## Example Usage

### Trigger a Job Template
```yaml
name: Trigger Job Template on AWX
uses: bilalahmad99/github-action-trigger-awx@v2.1.0
with:
  ansible_tower_token: ${{ secrets.ansibleToken }}
  ansible_tower_url: ${{ secrets.ansibleUrl }}
  job_template_id: "1254"
  extra_vars: |
    {
      "environment": "dev",
      "version": "1.0.0"
    }
```

### Trigger a Workflow Template
```yaml
name: Trigger Workflow Template on AWX
uses: bilalahmad99/github-action-trigger-awx@v2.1.0
with:
  ansible_tower_token: ${{ secrets.ansibleToken }}
  ansible_tower_url: ${{ secrets.ansibleUrl }}
  workflow_template_id: "42"
```

## Inputs

| Name | Required | Default | Description |
|:-|:-|:-|:-|
| `ansible_tower_url` | ✅ | — | Base URL of the Tower/AWX instance; e.g. `https://awx.example.net` |
| `ansible_tower_token` | ⚠️ | — | OAuth2 token for authentication (preferred) |
| `ansible_tower_user` | ⚠️ | — | Username for basic auth |
| `ansible_tower_pass` | ⚠️ | — | Password for basic auth |
| `job_template_id` | ⚠️ | — | ID of the job template to launch |
| `workflow_template_id` | ⚠️ | — | ID of the workflow template to launch |
| `extra_vars` | ❌ | `{}` | JSON string of extra variables to pass to the template |
| `ansible_tower_retries` | ❌ | `3` | Number of times to retry an AWX API request |
| `ansible_tower_retry_interval` | ❌ | `60000` | Milliseconds to wait between retries |

> ⚠️ Either `job_template_id` or `workflow_template_id` must be defined, but not both.  
> ⚠️ Either `ansible_tower_token` or `ansible_tower_user`/`ansible_tower_pass` must be provided.

## Outputs

| Name | Description |
|:-|:-|
| `RESOURCE_NAME` | Resource name parsed from job stdout (job templates only) |

> **Note:** Workflow template runs do not export stdout outputs.
