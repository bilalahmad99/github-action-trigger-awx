import * as core from '@actions/core'
import {wait} from './wait'
import axios from 'axios'
import axiosRetry from 'axios-retry'

function getInputs() {
  const username = core.getInput('ansible_tower_user')
  const password = core.getInput('ansible_tower_pass')
  const token = core.getInput('ansible_tower_token')
  const retries = Number(core.getInput('ansible_tower_retries'))
  const retryInterval = Number(core.getInput('ansible_tower_retry_interval'))
  const url = core.getInput('ansible_tower_url')
  const extraVars = JSON.parse(core.getInput('extra_vars') || '{}')
  const jobTemplateId = core.getInput('job_template_id')
  const workflowTemplateId = core.getInput('workflow_template_id')

  // mask sensitive values
  if (password) core.setSecret(password)
  if (token) core.setSecret(token)

  return {
    username,
    password,
    token,
    retries,
    retryInterval,
    url,
    extraVars,
    jobTemplateId,
    workflowTemplateId
  }
}

function buildAuthConfig(inputs: ReturnType<typeof getInputs>) {
  if (inputs.token) {
    return {headers: {Authorization: `Bearer ${inputs.token}`}}
  }
  return {auth: {username: inputs.username, password: inputs.password}}
}

export async function launchTemplate(inputs: ReturnType<typeof getInputs>) {
  const {url, jobTemplateId, workflowTemplateId, extraVars} = inputs
  const authConfig = buildAuthConfig(inputs)

  const isWorkflow = workflowTemplateId !== ''
  const templateId = isWorkflow ? workflowTemplateId : jobTemplateId
  const templateTypeLabel = isWorkflow ? 'Workflow' : 'Job'
  const urlLocation = isWorkflow
    ? `${url}/api/v2/workflow_job_templates/${templateId}/launch/`
    : `${url}/api/v2/job_templates/${templateId}/launch/`

  core.info(`Launching ${templateTypeLabel} template ${urlLocation}`)

  const response = await axios.post(
    urlLocation,
    {extra_vars: extraVars},
    authConfig
  )

  if (
    response?.data.job !== undefined ||
    response?.data.workflow_job !== undefined
  ) {
    core.info(
      `${templateTypeLabel} Template ${templateId} launched successfully. Status: ${response.status}`
    )
    return response.data.url
  }

  if (response?.data.detail) {
    throw new Error(response.data.detail)
  }

  throw new Error(
    `${templateTypeLabel} Template ${templateId} couldn't be launched`
  )
}

async function getJobStatus(
  jobUrl: string,
  url: string,
  authConfig: object
): Promise<any> {
  let response = await axios.get(url + jobUrl, authConfig)

  while (response?.data.status) {
    const {status} = response.data
    if (status === 'failed' || status === 'successful' || status === 'error') {
      return response.data
    }
    core.info(`Job status: ${status}. Waiting...`)
    await wait(10000)
    response = await axios.get(url + jobUrl, authConfig)
  }

  if (response?.data.detail) {
    throw new Error(response.data.detail)
  }

  throw new Error('Failed to get job status from AWX.')
}

async function fetchJobStdout(
  jobData: any,
  url: string,
  authConfig: object
): Promise<string | null> {
  if (!jobData.related?.stdout) return null

  const response = await axios.get(
    `${url}${jobData.related.stdout}?format=txt`,
    authConfig
  )

  if (!response) {
    core.warning('An error occurred trying to get the AWX output')
    return null
  }

  return response.data
}

function logJobOutput(jobData: any, stdout: string | null) {
  core.info(`Final status: ${jobData.status}`)

  if (stdout) {
    core.info(
      '==============================Ansible Tower output=============================='
    )
    core.info(stdout)
  }

  if (jobData.result_traceback && jobData.result_traceback !== '') {
    core.info(
      '===========================AWX traceback output==========================='
    )
    core.info(jobData.result_traceback)
  }

  if (jobData.status !== 'successful') {
    throw new Error(
      `AWX job ${jobData.id} exited with status: '${jobData.status}'`
    )
  }
}

function exportResourceName(output: string) {
  // matches resource names in paths like /resourceName" or /resourceName\
  const regex = /(\/(\w+)\\)|(\/(\w+)")/g
  const found = output.match(regex)

  if (found) {
    const last = found[found.length - 1]
    const resourceName = last.substring(1, last.length - 1)
    core.setOutput('RESOURCE_NAME', resourceName)
    core.info(`Resource name exported: ${resourceName}`)
  } else {
    core.warning('No resource name exported as output variable.')
  }
}

export async function run(): Promise<void> {
  const inputs = getInputs()
  const {
    jobTemplateId,
    workflowTemplateId,
    retries,
    retryInterval,
    url,
    token,
    username,
    password
  } = inputs

  if (jobTemplateId === '' && workflowTemplateId === '') {
    core.setFailed("Must define 'job_template_id' or 'workflow_template_id'")
    return
  }

  if (jobTemplateId !== '' && workflowTemplateId !== '') {
    core.setFailed(
      "Only 'job_template_id' or 'workflow_template_id' can be passed, not both"
    )
    return
  }

  if (!token && (!username || !password)) {
    core.setFailed(
      "Must provide either 'ansible_tower_token' or both 'ansible_tower_user' and 'ansible_tower_pass'"
    )
    return
  }

  axiosRetry(axios, {
    retries,
    retryDelay: () => retryInterval
  })

  try {
    const authConfig = buildAuthConfig(inputs)
    const jobUrl: string = await launchTemplate(inputs)
    const jobData = await getJobStatus(jobUrl, url, authConfig)
    const stdout = await fetchJobStdout(jobData, url, authConfig)
    logJobOutput(jobData, stdout)

    if (stdout) {
      exportResourceName(stdout)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
