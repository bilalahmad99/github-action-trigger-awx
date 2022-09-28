# Trigger job templates on Ansible Tower/AWX from Github Actions

Github action that allows you to trigger job templates on Ansible Tower/AWX.

## Usage

```yaml
name: Trigger Job Template on AWX
uses: bilalahmad99/github-action-trigger-awx@1.1.0
with:
  ansible_tower_user: ${{ secrets.ansibleUser }}
  ansible_tower_pass: ${{ secrets.ansiblePass }}
  ansible_tower_url: ${{ secrets.ansibleUrl }}
  job_template_id: "1254"
  extra_vars: |
   {
      "environment": "dev",
      "test": 1
   }
```
