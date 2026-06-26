import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import TaskRow from '../../src/components/TaskRow'

const defaultProps = {
  emoji:    '💧',
  title:    'Drink water',
  desc:     'Before anything else.',
  done:     false,
  onToggle: jest.fn(),
}

beforeEach(() => jest.clearAllMocks())

describe('TaskRow', () => {
  it('renders the title and description', () => {
    render(<TaskRow {...defaultProps} />)
    expect(screen.getByText('Drink water')).toBeInTheDocument()
    expect(screen.getByText('Before anything else.')).toBeInTheDocument()
  })

  it('renders the emoji', () => {
    render(<TaskRow {...defaultProps} />)
    expect(screen.getByText('💧')).toBeInTheDocument()
  })

  it('calls onToggle when clicked', () => {
    render(<TaskRow {...defaultProps} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onToggle on Enter key', () => {
    render(<TaskRow {...defaultProps} />)
    fireEvent.keyDown(screen.getByRole('checkbox'), { key: 'Enter' })
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onToggle on Space key', () => {
    render(<TaskRow {...defaultProps} />)
    fireEvent.keyDown(screen.getByRole('checkbox'), { key: ' ' })
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1)
  })

  it('has aria-checked=false when not done', () => {
    render(<TaskRow {...defaultProps} done={false} />)
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'false')
  })

  it('has aria-checked=true when done', () => {
    render(<TaskRow {...defaultProps} done={true} />)
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
  })

  it('shows strikethrough on title when done', () => {
    render(<TaskRow {...defaultProps} done={true} />)
    const title = screen.getByText('Drink water')
    expect(title).toHaveStyle({ textDecoration: 'line-through' })
  })

  it('shows FORM button when hasForm=true and not done', () => {
    const onForm = jest.fn()
    render(<TaskRow {...defaultProps} hasForm={true} onForm={onForm} />)
    expect(screen.getByText('🏊 Open FORM')).toBeInTheDocument()
  })

  it('hides FORM button when done', () => {
    render(<TaskRow {...defaultProps} done={true} hasForm={true} onForm={jest.fn()} />)
    expect(screen.queryByText('🏊 Open FORM')).toBeNull()
  })

  it('FORM button click does not call onToggle', () => {
    const onForm = jest.fn()
    render(<TaskRow {...defaultProps} hasForm={true} onForm={onForm} />)
    fireEvent.click(screen.getByText('🏊 Open FORM'))
    expect(defaultProps.onToggle).not.toHaveBeenCalled()
  })

  it('shows delete button for one-off tasks', () => {
    const onDelete = jest.fn()
    render(<TaskRow {...defaultProps} isOneOff={true} onDelete={onDelete} />)
    expect(screen.getByLabelText(/delete task/i)).toBeInTheDocument()
  })

  it('calls onDelete when delete button clicked, not onToggle', () => {
    const onDelete = jest.fn()
    render(<TaskRow {...defaultProps} isOneOff={true} onDelete={onDelete} />)
    fireEvent.click(screen.getByLabelText(/delete task/i))
    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(defaultProps.onToggle).not.toHaveBeenCalled()
  })

  it('does not show delete button for daily tasks', () => {
    render(<TaskRow {...defaultProps} isOneOff={false} />)
    expect(screen.queryByLabelText(/delete task/i)).toBeNull()
  })

  it('renders without desc gracefully', () => {
    render(<TaskRow {...defaultProps} desc={undefined} />)
    expect(screen.getByText('Drink water')).toBeInTheDocument()
  })
})
