# Trigger job templates on Ansible Tower/AWX from Github Actions

Github action that allows you to trigger job or workflow templates on Ansible Tower/AWX.

## Example Usage

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

## Inputs

|Name|Default Value|Description|
|:-|:-|:-|
|ansible_tower_url|None|The base url of the Tower/AWX instance; e.g. 'https://awx.example.net'|
|ansible_tower_user|None|The username to use when logging into the Tower/AWX API|
|ansible_tower_pass|None|The password to use when logging into the Tower/AWX API|
|ansible_tower_retries|3|The number of times to retry a given Tower/AWX API request|
|ansible_tower_retry_interval|60000|The number of milliseconds to wait in between retries of a given Tower/AWX API Request|
|extra_vars|None|A json string of any extra variables to be set along to the launched workflow or job template.|
|job_template_id|None|The id of the job template to launch|
|workflow_template_id|None|The id of the workflow template to launch|

## Outputs

When a job template is successfully completed the stdout results are exported.

---
**NOTE**

* Either **job_template_id** or **workflow_template_id** must be defined.
* Workflow template runs do not export any outputs.
---
