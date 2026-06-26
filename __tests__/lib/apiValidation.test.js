import { validateClaudeRequest, parseClaudeJsonArray, extractClaudeText } from '../../src/lib/apiValidation'

describe('validateClaudeRequest', () => {
  it('accepts valid roast request', () => {
    expect(validateClaudeRequest({ mode: 'roast', streak: 5 }).valid).toBe(true)
  })

  it('accepts valid plan request', () => {
    expect(validateClaudeRequest({ mode: 'plan', events: [], emails: [] }).valid).toBe(true)
  })

  it('accepts valid rollover request', () => {
    expect(validateClaudeRequest({ mode: 'rollover', summary: 'had a great day' }).valid).toBe(true)
  })

  it('rejects null body', () => {
    expect(validateClaudeRequest(null).valid).toBe(false)
  })

  it('rejects missing mode', () => {
    expect(validateClaudeRequest({}).valid).toBe(false)
  })

  it('rejects unknown mode', () => {
    expect(validateClaudeRequest({ mode: 'hack' }).valid).toBe(false)
    expect(validateClaudeRequest({ mode: 'roast; DROP TABLE' }).valid).toBe(false)
  })

  it('rejects rollover without summary', () => {
    expect(validateClaudeRequest({ mode: 'rollover' }).valid).toBe(false)
    expect(validateClaudeRequest({ mode: 'rollover', summary: '' }).valid).toBe(false)
    expect(validateClaudeRequest({ mode: 'rollover', summary: 123 }).valid).toBe(false)
  })

  it('rejects rollover with summary over 4000 chars', () => {
    expect(validateClaudeRequest({ mode: 'rollover', summary: 'x'.repeat(4001) }).valid).toBe(false)
  })

  it('rejects roast with non-numeric streak', () => {
    expect(validateClaudeRequest({ mode: 'roast', streak: 'five' }).valid).toBe(false)
    expect(validateClaudeRequest({ mode: 'roast', streak: -1 }).valid).toBe(false)
    expect(validateClaudeRequest({ mode: 'roast', streak: NaN }).valid).toBe(false)
    expect(validateClaudeRequest({ mode: 'roast', streak: Infinity }).valid).toBe(false)
  })

  it('allows missing streak for roast (defaults to 0 in handler)', () => {
    expect(validateClaudeRequest({ mode: 'roast' }).valid).toBe(true)
  })
})

describe('parseClaudeJsonArray', () => {
  it('parses a clean JSON array', () => {
    const result = parseClaudeJsonArray('[{"title":"Pack bag","note":"Trip soon","priority":"high"}]')
    expect(result.ok).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data[0].title).toBe('Pack bag')
  })

  it('strips json code fences', () => {
    const text = '```json\n[{"title":"A"}]\n```'
    const result = parseClaudeJsonArray(text)
    expect(result.ok).toBe(true)
    expect(result.data[0].title).toBe('A')
  })

  it('handles an empty array', () => {
    const result = parseClaudeJsonArray('[]')
    expect(result.ok).toBe(true)
    expect(result.data).toHaveLength(0)
  })

  it('returns ok:false for invalid JSON', () => {
    expect(parseClaudeJsonArray('{not array}').ok).toBe(false)
    expect(parseClaudeJsonArray('null').ok).toBe(false)
    expect(parseClaudeJsonArray('').ok).toBe(false)
  })

  it('returns ok:false when JSON is valid but not an array', () => {
    expect(parseClaudeJsonArray('{"title":"x"}').ok).toBe(false)
    expect(parseClaudeJsonArray('"just a string"').ok).toBe(false)
  })

  it('includes a descriptive error on failure', () => {
    expect(parseClaudeJsonArray('bad').error).toBeTruthy()
  })
})

describe('extractClaudeText', () => {
  it('extracts text from a well-formed response', () => {
    const msg = { content: [{ type: 'text', text: 'Hello world' }] }
    expect(extractClaudeText(msg)).toBe('Hello world')
  })

  it('returns empty string for malformed/missing response', () => {
    expect(extractClaudeText(null)).toBe('')
    expect(extractClaudeText(undefined)).toBe('')
    expect(extractClaudeText({})).toBe('')
    expect(extractClaudeText({ content: [] })).toBe('')
  })
})
