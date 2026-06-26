import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import PinScreen from '../../src/components/PinScreen'

// Mock next-auth signIn
jest.mock('next-auth/react', () => ({ signIn: jest.fn() }))
import { signIn } from 'next-auth/react'

const baseProps = {
  mode:     'locked',
  input:    '',
  error:    '',
  shaking:  false,
  onDigit:  jest.fn(),
  onDelete: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

describe('PinScreen', () => {
  it('renders the lock title in locked mode', () => {
    render(<PinScreen {...baseProps} />)
    expect(screen.getByText('Welcome back 🌿')).toBeInTheDocument()
  })

  it('renders setup title in setup mode', () => {
    render(<PinScreen {...baseProps} mode="setup" />)
    expect(screen.getByText('Choose your PIN')).toBeInTheDocument()
  })

  it('renders confirm title in confirm mode', () => {
    render(<PinScreen {...baseProps} mode="confirm" />)
    expect(screen.getByText('Confirm your PIN')).toBeInTheDocument()
  })

  it('renders all 10 digit buttons', () => {
    render(<PinScreen {...baseProps} />)
    for (let i = 0; i <= 9; i++) {
      expect(screen.getByLabelText(String(i))).toBeInTheDocument()
    }
  })

  it('calls onDigit with the correct digit when a key is pressed', () => {
    render(<PinScreen {...baseProps} />)
    fireEvent.click(screen.getByLabelText('5'))
    expect(baseProps.onDigit).toHaveBeenCalledWith('5')
  })

  it('calls onDelete when ⌫ is pressed', () => {
    render(<PinScreen {...baseProps} />)
    fireEvent.click(screen.getByLabelText('Delete'))
    expect(baseProps.onDelete).toHaveBeenCalledTimes(1)
  })

  it('displays 4 dot indicators', () => {
    render(<PinScreen {...baseProps} />)
    expect(screen.getByRole('status', { name: /0 of 4 digits entered/i })).toBeInTheDocument()
  })

  it('updates dot count aria-label as digits are entered', () => {
    render(<PinScreen {...baseProps} input="12" />)
    expect(screen.getByRole('status', { name: /2 of 4 digits entered/i })).toBeInTheDocument()
  })

  it('shows error message when error prop is set', () => {
    render(<PinScreen {...baseProps} error="Wrong PIN. Try again." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong PIN. Try again.')
  })

  it('does not show error element when error is empty', () => {
    render(<PinScreen {...baseProps} error="" />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows "Forgot PIN?" link only in locked mode', () => {
    render(<PinScreen {...baseProps} mode="locked" />)
    expect(screen.getByText(/forgot pin/i)).toBeInTheDocument()
  })

  it('hides "Forgot PIN?" link in setup mode', () => {
    render(<PinScreen {...baseProps} mode="setup" />)
    expect(screen.queryByText(/forgot pin/i)).toBeNull()
  })

  it('calls signIn when "Forgot PIN?" is clicked', () => {
    render(<PinScreen {...baseProps} mode="locked" />)
    fireEvent.click(screen.getByText(/forgot pin/i))
    expect(signIn).toHaveBeenCalledWith('google')
  })
})
