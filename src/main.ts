import * as core from '@actions/core'
import {wait} from './wait'
import axios from 'axios'
import axiosRetry from 'axios-retry'

const username: string = core.getInput('ansible_tower_user')
const password: string = core.getInput('ansible_tower_pass')
const retries = Number(core.getInput('ansible_tower_retries'))
const retry_interval = Number(core.getInput('ansible_tower_retry_interval'))
const url: string = core.getInput('ansible_tower_url')
const additionalVars = JSON.parse(core.getInput('extra_vars'))
const jobTemplateId: string = core.getInput('job_template_id')
const workflowTemplateId: string = core.getInput('workflow_template_id')

// add a bit of intermittent fault tolerance in requests made to awx
// start by adding 3 retries at 1 minute interval; may want to expose these later as action inputs
axiosRetry(axios, {
  retries: retries,
  retryDelay: () => {
    return retry_interval
  }
})

const launchTemplate = async () => {
  // determine whether or not we are triggering a workflow or job template based on the id passed in
  let templateId = jobTemplateId
  let urlLocation = `${url}/api/v2/job_templates/${templateId}/launch/`
  let templateTypeLabel = 'Job'

  if (workflowTemplateId !== undefined) {
    templateId = workflowTemplateId
    templateTypeLabel = 'Workflow'
    urlLocation = `${url}/api/v2/workflow_job_templates/${templateId}/launch/`
  }

  console.log(`launching job ${urlLocation} with extra_vars`, additionalVars)

  const response = await axios.post(
    urlLocation,
    {extra_vars: additionalVars},
    {
      auth: {
        username: username,
        password: password
      }
    }
  )
  if (
    response &&
    (response.data.job !== undefined ||
      response.data.workflow_job !== undefined)
  ) {
    console.log(
      `${templateTypeLabel} Template Id ${templateId} launched successfully.`
    )
    console.log(
      `Job ${response.data.job} was created on Ansible Tower: Status ${response.status}.`
    )
    return response.data.url
  }
  if (response && response.data.detail) {
    console.log(
      `${templateTypeLabel} Template ID ${templateId} couldn't be launched, the Ansible API is returning the following error:`
    )
    throw new Error(response.data.detail)
  } else {
    console.log(response)
    throw new Error(
      `${templateTypeLabel} Template ID ${templateId} couldn't be launched, the Ansible API is not working`
    )
  }
}

async function getJobStatus(jobUrl: string) {
  let response = await axios.get(url + jobUrl, {
    auth: {
      username: username,
      password: password
    }
  })

  if (response && response.data.status) {
    if (
      !(response.data.status === 'failed') &&
      !(response.data.status === 'successful') &&
      !(response.data.status === 'error')
    ) {
      console.log('Validating Job status...')
      await wait(10000)
      console.log(`Job status: ${response.data.status}.`)
      response = await getJobStatus(jobUrl)
      return response
    }
    return response.data
  }
  if (response && response.data.detail) {
    console.log('Failed to get job status from AWX.')
    throw new Error(response.data.detail)
  } else {
    console.log(response)
    throw new Error('Failed to get job status from AWX.')
  }
}

async function printJobOutput(jobData: any) {
  console.log('job_data: ', jobData)

  // if the jobData contains a link to the stdout results of the job retrieve that information
  // ( workflows do not currently support this )
  let response
  if (jobData.related.stdout) {
    response = await axios.get(`${url}${jobData.related.stdout}?format=txt`, {
      auth: {
        username: username,
        password: password
      }
    })

    // if there is a response log it
    if (!response) {
      console.log('[warning]: An error ocurred trying to get the AWX output')
    }
  }

  // print job status and any relevant output
  console.log(`Final status: ${jobData.status}`)

  if (response) {
    console.log(
      '******************************Ansible Tower output******************************'
    )
    console.log(response.data)
  }
  if (jobData.result_traceback && jobData.result_traceback !== '') {
    console.log(
      '***************************AWX traceback output***************************'
    )
    console.log(jobData.result_traceback)
  }

  if (jobData.status !== 'successful') {
    throw new Error(
      `Issue running AWX job ${jobData.id}. Job exited with status: '${jobData.status}'`
    )
  }

  return response
}

async function exportResourceName(output: string) {
  const regex = /(\/(\w+)\\)|(\/(\w+)")/g
  const found = output.match(regex)

  if (found) {
    const resourceName = found[found.length - 1].substring(
      1,
      found[found.length - 1].length - 1
    )
    core.setOutput('RESOURCE_NAME', resourceName)
    console.log(`Resource name exported: ${resourceName}`)
  } else {
    console.log('[warning]: No resource name exported as output variable.')
  }
}

async function run(): Promise<void> {
  // make sure at least one template id is defined
  if (jobTemplateId === '' && workflowTemplateId === '') {
    const errmsg = "Must define 'jobTemplateId' or 'workflowTemplateId'"
    console.log(errmsg)
    core.setFailed(errmsg)
    return
  }

  // make sure only one template id is defined
  if (jobTemplateId !== '' && workflowTemplateId !== '') {
    const errmsg =
      "Only 'jobTemplateId' or 'workflowTemplateId' can be passed, not both"
    console.log(errmsg)
    core.setFailed(errmsg)
    return
  }

  try {
    const jobUrl: string = await launchTemplate()
    const jobData = await getJobStatus(jobUrl)
    const jobStdoutResponse = await printJobOutput(jobData)

    // if the stdout was retrieved export that as a resouce
    if (jobStdoutResponse) {
      const output = jobStdoutResponse.data
      await exportResourceName(output)
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
