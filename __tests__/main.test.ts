import {wait} from '../src/wait'
import * as core from '@actions/core'
import axios from 'axios'
import {expect, test, jest, beforeEach, describe} from '@jest/globals'

jest.mock('@actions/core')
jest.mock('axios-retry', () => () => {})

const mockedCore = core as jest.Mocked<typeof core>
const mockedAxios = axios as jest.Mocked<typeof axios>

// ── wait utility ─────────────────────────────────────────────────────────────

describe('wait', () => {
  test('throws on invalid number', async () => {
    await expect(wait(parseInt('foo', 10))).rejects.toThrow(
      'milliseconds not a number'
    )
  })

  test('resolves after ~500ms', async () => {
    const start = Date.now()
    await wait(500)
    expect(Date.now() - start).toBeGreaterThan(450)
  })
})

// ── helpers ───────────────────────────────────────────────────────────────────

function mockInputs(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    ansible_tower_url: 'https://awx.example.com',
    ansible_tower_token: 'mytoken',
    ansible_tower_user: '',
    ansible_tower_pass: '',
    ansible_tower_retries: '3',
    ansible_tower_retry_interval: '1000',
    extra_vars: '{}',
    job_template_id: '',
    workflow_template_id: ''
  }
  mockedCore.getInput.mockImplementation(
    (name: string) => overrides[name] ?? defaults[name] ?? ''
  )
}

// ── input validation ──────────────────────────────────────────────────────────

describe('run() input validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('fails when neither template id is provided', async () => {
    mockInputs()
    const {run} = await import('../src/main')
    await run()
    expect(mockedCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Must define')
    )
  })

  test('fails when both template ids are provided', async () => {
    mockInputs({job_template_id: '1', workflow_template_id: '2'})
    const {run} = await import('../src/main')
    await run()
    expect(mockedCore.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('not both')
    )
  })
})

// ── launchTemplate ────────────────────────────────────────────────────────────

describe('launchTemplate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('launches job template and returns job url', async () => {
    jest.spyOn(mockedAxios, 'post').mockResolvedValueOnce({
      status: 201,
      data: {job: 42, url: '/api/v2/jobs/42/'}
    })

    const {launchTemplate} = await import('../src/main')
    const result = await launchTemplate({
      url: 'https://awx.example.com',
      jobTemplateId: '10',
      workflowTemplateId: '',
      extraVars: {},
      token: 'tok',
      username: '',
      password: '',
      retries: 3,
      retryInterval: 1000
    })

    expect(result).toBe('/api/v2/jobs/42/')
  })

  test('throws when API returns error detail', async () => {
    jest.spyOn(mockedAxios, 'post').mockResolvedValueOnce({
      status: 400,
      data: {detail: 'Template not found'}
    })

    const {launchTemplate} = await import('../src/main')
    await expect(
      launchTemplate({
        url: 'https://awx.example.com',
        jobTemplateId: '99',
        workflowTemplateId: '',
        extraVars: {},
        token: 'tok',
        username: '',
        password: '',
        retries: 3,
        retryInterval: 1000
      })
    ).rejects.toThrow('Template not found')
  })
})
